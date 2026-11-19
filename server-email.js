// ZledgerCraft - optional Resend transactional email.
// Uses the HTTP API through fetch so the app needs no email SDK at runtime.
const DEFAULT_ENDPOINT = 'https://api.resend.com/emails';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function emailConfiguration(env = process.env) {
  const apiKey = text(env.RESEND_API_KEY);
  const from = text(env.RESEND_FROM);
  const publicUrl = text(env.ZL_PUBLIC_URL).replace(/\/+$/, '');
  if (!apiKey || !from || !publicUrl) return null;
  try {
    const parsed = new URL(publicUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  } catch {
    return null;
  }
  return {
    apiKey,
    from,
    publicUrl,
    endpoint: text(env.RESEND_API_URL) || DEFAULT_ENDPOINT,
  };
}

export async function sendEmail(
  { to, subject, text: bodyText, html },
  config,
  { fetchImpl = fetch, timeoutMs = 15_000 } = {},
) {
  if (!config) throw new Error('Email is not configured.');
  const recipients = (Array.isArray(to) ? to : String(to ?? '').split(','))
    .map((item) => text(item))
    .filter(Boolean);
  if (!recipients.length) throw new Error('An email recipient is required.');
  let response;
  try {
    response = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: recipients,
        subject,
        text: bodyText,
        ...(html ? { html } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`Email delivery failed: ${error.message || 'network error'}`);
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A successful send can still have an empty/non-JSON body.
  }
  if (!response.ok) {
    const detail = payload?.message || payload?.error || '';
    throw new Error(`Email delivery failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return { ok: true, id: payload?.id || '' };
}

export async function sendPasswordResetEmail(
  { to, username, resetLink, expiresMinutes = 30 },
  config,
  options,
) {
  const safeUser = text(username);
  const minutes = Math.max(1, Number(expiresMinutes) || 30);
  const link = String(resetLink);
  return sendEmail(
    {
      to,
      subject: 'Reset your ZledgerCraft password',
      text: [
        `A password reset was requested for @${safeUser}.`,
        '',
        `Open this link within ${minutes} minutes:`,
        link,
        '',
        'If you did not request this, ignore this email. Your password will not change.',
      ].join('\n'),
      html: `<p>A password reset was requested for <strong>@${escapeHtml(safeUser)}</strong>.</p>
<p>Open this link within ${minutes} minutes:</p>
<p><a href="${escapeHtml(link)}">Reset your password</a></p>
<p>If you did not request this, ignore this email. Your password will not change.</p>`,
    },
    config,
    options,
  );
}

export async function sendBackupFailureEmail(
  { to, backupName, error },
  config,
  options,
) {
  const safeName = text(backupName || 'server backup');
  const safeError = text(error || 'Unknown error');
  return sendEmail(
    {
      to,
      subject: `ZledgerCraft backup upload failed: ${safeName}`,
      text: [
        `The offsite backup upload failed for ${safeName}.`,
        '',
        safeError,
        '',
        'The local verified snapshot was kept. Check R2 configuration and retry.',
      ].join('\n'),
      html: `<p>The offsite backup upload failed for <strong>${escapeHtml(safeName)}</strong>.</p>
<p>${escapeHtml(safeError)}</p>
<p>The local verified snapshot was kept. Check R2 configuration and retry.</p>`,
    },
    config,
    options,
  );
}

export const RESEND_DEFAULTS = Object.freeze({ endpoint: DEFAULT_ENDPOINT });
