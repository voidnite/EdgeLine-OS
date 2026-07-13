// src/email/sms.mjs
// Sends real SMS verification codes via Twilio.
// Requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER in .env
//
// Twilio free trial setup (3 minutes):
//   1. Sign up at https://www.twilio.com/try-twilio
//   2. Dashboard → Account Info → copy Account SID + Auth Token
//   3. Click "Get a trial phone number" in the console
//   4. Paste all three into .env

import twilio from "twilio";

let _client = null;

function getClient() {
  if (_client) return _client;

  const sid   = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!sid || !token) return null;

  _client = twilio(sid, token);
  return _client;
}

/**
 * Send a real SMS verification code.
 * Returns { ok: true, sid } on success or { ok: false, reason } on failure.
 */
export async function sendSmsCode(toPhone, code) {
  const from   = process.env.TWILIO_PHONE_NUMBER?.trim();
  const client = getClient();

  if (!client) {
    console.warn("[SMS] Twilio credentials not set — add TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN to .env");
    return { ok: false, reason: "no_credentials" };
  }

  if (!from) {
    console.warn("[SMS] TWILIO_PHONE_NUMBER not set in .env");
    return { ok: false, reason: "no_phone_number" };
  }

  // Ensure number has + prefix
  const dest = toPhone.startsWith("+") ? toPhone : `+${toPhone.replace(/\D/g,"")}`;

  try {
    const msg = await client.messages.create({
      from,
      to:   dest,
      body: `Your EdgeLine OS verification code is: ${code}\n\nExpires in 10 minutes. Do not share this code.`,
    });

    console.log(`[SMS] Code sent to ${dest} — SID: ${msg.sid}`);
    return { ok: true, sid: msg.sid };
  } catch (err) {
    console.error(`[SMS] Failed to send to ${dest}: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}
