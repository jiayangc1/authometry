import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response, next).catch(next);
  };
}

export function sendApiError(error: unknown, request: Request, response: Response): void {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(500, "internal_error", "The request could not be completed.");
  if (!(error instanceof ApiError)) console.error(request.id, error);
  response.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      requestId: request.id,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  });
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      admin?: {
        userId: string;
        email: string;
        workspaceId: string;
        role: string;
        tokenScopes?: string[];
      };
    }
  }
}
