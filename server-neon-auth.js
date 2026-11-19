// Minimal server-side client for Neon Managed Better Auth. The browser talks to
// this server, which keeps the Neon Auth URL and cookies off the static app.
const TIMEOUT_MS = 12_000;

export function neonAuthConfiguration(env = process.env) {
  const baseUrl = String(env.NEON_AUTH_BASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl) return null;
  return {
    baseUrl,
    publicUrl: String(env.ZL_PUBLIC_URL || `http://localhost:${env.PORT || 4173}`).replace(/\/+$/, ''),
  };
}

async function call(config, path, { method = 'POST', body, cookie = '' } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  headers.origin = config.publicUrl;
  let response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, status: 503, error: `Neon Auth is unreachable: ${error.message}` };
  }
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error:
        payload?.message ||
        payload?.error?.message ||
        payload?.error ||
        `Neon Auth rejected the request (${response.status}).`,
      payload,
    };
  }
  return { ok: true, status: response.status, payload, setCookie: response.headers.get('set-cookie') || '' };
}

export async function neonSignIn(config, email, password) {
  return call(config, '/sign-in/email', { body: { email, password } });
}

export async function neonSignUp(config, { email, password, name }) {
  return call(config, '/sign-up/email', { body: { email, password, name } });
}

export async function neonForgotPassword(config, email) {
  return call(config, '/forget-password', {
    body: { email, redirectTo: `${config.publicUrl}/` },
  });
}

export async function neonResetPassword(config, token, newPassword) {
  return call(config, '/reset-password', { body: { token, newPassword } });
}

export async function neonSession(config, cookie) {
  return call(config, '/get-session', { method: 'GET', cookie });
}

export async function neonSignOut(config, cookie) {
  return call(config, '/sign-out', { body: {}, cookie });
}
