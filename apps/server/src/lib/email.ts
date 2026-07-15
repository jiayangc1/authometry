import nodemailer from "nodemailer";
import { env } from "../env.js";

export function emailEnabled(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!emailEnabled()) return;
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
  });
  await transporter.sendMail({ from: env.SMTP_FROM, ...input });
}
