import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ZodError } from "zod";
import { adminAuthRouter, requireAdmin, requireCsrf } from "./auth/admin.js";
import { dashboardRouter } from "./api/dashboard.js";
import { configurationRouter } from "./api/configuration.js";
import { settingsRouter } from "./api/settings.js";
import { agentsRouter } from "./api/agents.js";
import { pool } from "./db.js";
import { env } from "./env.js";
import { ApiError, sendApiError } from "./lib/http.js";
import { migrate } from "./migrate.js";
import { authorizationRouter, authorizeApiRouter } from "./oauth/authorization.js";
import { discoveryRouter, deviceApiRouter, resourceRouter } from "./oauth/resources.js";
import { tokenRouter } from "./oauth/tokens.js";
import { dispatchPendingWebhooks, runRetention } from "./workers.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((request, response, next) => {
    request.id =
      request.get("x-request-id") ?? `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    response.set("x-request-id", request.id);
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
      ...(env.NODE_ENV === "production" ? {} : { hsts: false }),
    }),
  );
  app.use(
    cors({
      origin: env.NODE_ENV === "development" ? env.PUBLIC_ORIGIN : false,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.use(cookieParser(env.COOKIE_SECRET));

  app.get("/health/live", (_request, response) =>
    response.json({ status: "ok", service: "authometry-api" }),
  );
  app.get("/health/ready", async (_request, response, next) => {
    try {
      await pool.query("SELECT 1");
      response.json({ status: "ready", database: "connected" });
    } catch {
      next(new ApiError(503, "database_unavailable", "The database is not ready."));
    }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === "test" ? 10_000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const tokenLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: env.NODE_ENV === "test" ? 10_000 : 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  app.post(
    [
      "/api/v1/auth/bootstrap",
      "/api/v1/auth/login",
      "/api/v1/auth/forgot-password",
      "/api/v1/auth/reset-password",
      "/api/v1/auth/invitation",
      "/api/v1/authorize/login",
      "/api/v1/authorize/device",
    ],
    authLimiter,
  );
  app.get("/api/v1/auth/invitation", authLimiter);

  function mountProtocol(prefix: string): void {
    app.use(`${prefix}/.well-known`, discoveryRouter);
    app.use(`${prefix}/oauth`, authorizationRouter);
    app.use(`${prefix}/oauth`, tokenLimiter, tokenRouter);
    app.use(`${prefix}/oauth`, resourceRouter);
  }
  mountProtocol("");
  mountProtocol("/w/:workspaceSlug");
  mountProtocol("/w/:workspaceSlug/:environmentSlug");
  mountProtocol("/:environmentSlug");
  app.use("/api/v1/auth", adminAuthRouter);
  app.use("/api/v1/authorize", authorizeApiRouter);
  app.use("/api/v1/authorize", deviceApiRouter);
  app.use("/api/v1", requireAdmin, requireCsrf, agentsRouter);
  app.use("/api/v1", requireAdmin, requireCsrf, dashboardRouter);
  app.use("/api/v1", requireAdmin, requireCsrf, configurationRouter);
  app.use("/api/v1", requireAdmin, requireCsrf, settingsRouter);

  app.use((request, _response, next) => {
    next(new ApiError(404, "not_found", `No route matches ${request.method} ${request.path}.`));
  });
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      sendApiError(
        new ApiError(
          422,
          "validation_failed",
          "Check the highlighted fields and try again.",
          error.flatten(),
        ),
        request,
        response,
      );
      return;
    }
    sendApiError(error, request, response);
  });
  return app;
}

async function main(): Promise<void> {
  await migrate();
  const app = createApp();
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    process.stdout.write(`Authometry API listening on http://0.0.0.0:${env.PORT}\n`);
  });
  void dispatchPendingWebhooks().catch((error: unknown) => console.error("webhook_worker", error));
  void runRetention().catch((error: unknown) => console.error("retention_worker", error));
  setInterval(
    () =>
      void dispatchPendingWebhooks().catch((error: unknown) =>
        console.error("webhook_worker", error),
      ),
    30_000,
  ).unref();
  setInterval(
    () => void runRetention().catch((error: unknown) => console.error("retention_worker", error)),
    60 * 60 * 1000,
  ).unref();
  const shutdown = (signal: string): void => {
    process.stdout.write(`Received ${signal}; shutting down.\n`);
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
