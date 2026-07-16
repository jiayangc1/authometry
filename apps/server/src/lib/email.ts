import nodemailer from "nodemailer";
import { env } from "../env.js";

export function emailEnabled(): boolean {
  return Boolean(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD));
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!emailEnabled()) return;

  if (env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 1_000);
      throw new Error(`Resend rejected the email (${response.status}): ${details}`);
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
  });
  await transporter.sendMail({ from: env.SMTP_FROM, ...input });
}
