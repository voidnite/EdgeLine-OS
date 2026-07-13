// src/email/mailer.mjs
// Sends real emails via Gmail.
// Uses port 465 (SSL) first, falls back to port 587 (TLS) for restricted networks.
// Both use HTTPS-level encryption and work on most corporate/ISP networks.

import { createTransport } from "nodemailer";

let _transporter = null;

async function getTransport() {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !pass) return null;

  // Try port 465 (SSL) first
  const t465 = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    socketTimeout: 8000,
  });

  try {
    await t465.verify();
    console.log("[Mailer] Gmail connected via port 465 ✅");
    _transporter = t465;
    return _transporter;
  } catch {
    // Port 465 blocked — try port 587 with STARTTLS
    const t587 = createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      socketTimeout: 8000,
    });
    try {
      await t587.verify();
      console.log("[Mailer] Gmail connected via port 587 ✅");
      _transporter = t587;
      return _transporter;
    } catch (err587) {
      console.error(`[Mailer] Both ports failed. Last error: ${err587.message}`);
      return null;
    }
  }
}

export async function sendVerificationCode(toEmail, code) {
  const transport = await getTransport();

  if (!transport) {
    console.warn(`[Mailer] Gmail unavailable — code for ${toEmail}: ${code}`);
    return { ok: false, reason: "smtp_unavailable" };
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
            <span style="font-size:1.6rem;font-weight:900;color:#14b8a6;">EdgeLine OS</span>
            <p style="margin:6px 0 0;color:rgba(226,238,234,.55);font-size:0.88rem;">
              Autonomous AI Sports Trading · World Cup
            </p>
          </div>
          <div style="padding:32px;">
            <h2 style="margin:0 0 8px;font-size:1.2rem;font-weight:800;">Verify your account</h2>
            <p style="margin:0 0 24px;color:rgba(226,238,234,.65);font-size:0.92rem;">
              Enter this code on the EdgeLine OS registration page.
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
    console.error(`[Mailer] Send failed: ${err.message}`);
    // Reset transporter so next call retries port negotiation
    _transporter = null;
    return { ok: false, reason: err.message };
  }
}

export async function sendWelcomeEmail(toEmail, name) {
  const transport = await getTransport();
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
              Your account is ready. You now have access to live World Cup trading.
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
      text: `Welcome to EdgeLine OS, ${name}! Your account is ready.`,
    });
  } catch (err) {
    console.warn(`[Mailer] Welcome email failed: ${err.message}`);
  }
}
