// src/email/mailer.mjs
// Sends real emails via Gmail SMTP using nodemailer.
// Requires GMAIL_USER + GMAIL_APP_PASSWORD in .env
// App Password setup: myaccount.google.com → Security → 2-Step → App passwords

import { createTransport } from "nodemailer";
import config from "../config/config.mjs";

let _transporter = null;

function getTransport() {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null; // will fall back to console log

  _transporter = createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return _transporter;
}

/**
 * Send the 6-digit verification code to the user's email.
 * Falls back gracefully if Gmail credentials aren't configured.
 */
export async function sendVerificationCode(toEmail, code) {
  const transport = getTransport();

  if (!transport) {
    console.log(`[Mailer] No Gmail credentials set — code for ${toEmail}: ${code}`);
    return { ok: false, reason: "no_credentials" };
  }

  try {
    await transport.sendMail({
      from:    `"EdgeLine OS" <${process.env.GMAIL_USER}>`,
      to:      toEmail,
      subject: `Your EdgeLine OS verification code: ${code}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;
          background:#050e0c;color:#e2eeea;border-radius:12px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(135deg,#0a1f18,#061410);
            border-bottom:1px solid rgba(20,184,166,.25);">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:1.6rem;font-weight:900;color:#14b8a6;">EdgeLine OS</span>
            </div>
            <p style="margin:6px 0 0;color:rgba(226,238,234,.55);font-size:0.88rem;">
              Autonomous AI Sports Trading · World Cup
            </p>
          </div>
          <div style="padding:32px;">
            <h2 style="margin:0 0 8px;font-size:1.2rem;font-weight:800;">
              Verify your account
            </h2>
            <p style="margin:0 0 24px;color:rgba(226,238,234,.65);font-size:0.92rem;">
              Enter this code on the EdgeLine OS registration page to verify your email address.
            </p>
            <div style="text-align:center;padding:24px;background:rgba(20,184,166,.08);
              border:1px solid rgba(20,184,166,.25);border-radius:10px;margin-bottom:24px;">
              <span style="font-size:2.4rem;font-weight:900;letter-spacing:0.18em;
                color:#14b8a6;font-family:monospace;">${code}</span>
              <p style="margin:10px 0 0;font-size:0.78rem;color:rgba(226,238,234,.4);">
                Expires in 10 minutes
              </p>
            </div>
            <p style="margin:0;font-size:0.80rem;color:rgba(226,238,234,.35);">
              If you didn't request this, you can safely ignore this email.
              Do not share this code with anyone.
            </p>
          </div>
          <div style="padding:16px 32px;background:rgba(0,0,0,.25);
            font-size:0.75rem;color:rgba(226,238,234,.25);text-align:center;">
            EdgeLine OS · Powered by TxLINE Oracle · Solana Mainnet
          </div>
        </div>`,
      text: `Your EdgeLine OS verification code is: ${code}\n\nExpires in 10 minutes. Do not share this code.`,
    });

    console.log(`[Mailer] Code sent to ${toEmail}`);
    return { ok: true };
  } catch (err) {
    console.error(`[Mailer] Failed to send to ${toEmail}: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

export async function sendWelcomeEmail(toEmail, name) {
  const transport = getTransport();
  if (!transport) return;

  try {
    await transport.sendMail({
      from:    `"EdgeLine OS" <${process.env.GMAIL_USER}>`,
      to:      toEmail,
      subject: `Welcome to EdgeLine OS, ${name}!`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;
          background:#050e0c;color:#e2eeea;border-radius:12px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(135deg,#0a1f18,#061410);
            border-bottom:1px solid rgba(20,184,166,.25);">
            <span style="font-size:1.6rem;font-weight:900;color:#14b8a6;">EdgeLine OS</span>
          </div>
          <div style="padding:32px;">
            <h2 style="margin:0 0 12px;">Welcome, ${name}! 👋</h2>
            <p style="color:rgba(226,238,234,.65);">
              Your account is ready. You now have access to live World Cup trading powered by
              4 autonomous AI agents and on-chain Solana verification.
            </p>
            <div style="margin:24px 0;padding:16px;background:rgba(20,184,166,.08);
              border-radius:8px;border-left:3px solid #14b8a6;">
              <strong>Get started:</strong><br>
              <span style="color:rgba(226,238,234,.6);font-size:0.88rem;">
                Click ▶ Run agents → Watch Live Matches → See AI signals fire in real time
              </span>
            </div>
          </div>
        </div>`,
      text: `Welcome to EdgeLine OS, ${name}! Your account is ready. Visit the dashboard to start trading.`,
    });
  } catch (err) {
    console.warn(`[Mailer] Welcome email failed: ${err.message}`);
  }
}
