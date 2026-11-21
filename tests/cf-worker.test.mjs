import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../cf-api-worker.mjs';

test('Cloudflare API proxy forwards the real client IP and HSTS', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url: url.toString(), options };
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await worker.fetch(
      new Request('https://books.lengkhawm.online/api/auth/me', {
        headers: {
          'cf-connecting-ip': '203.0.113.9',
          'x-zl-client-ip': '198.51.100.7',
          'x-zl-proxy-secret': 'attacker-supplied',
        },
      }),
      { ZL_PROXY_SECRET: 'proxy-test-secret' },
    );
    assert.equal(captured.url, 'https://br-noisy-meadow-bdo80kpa-zledgercraft.compute.c-8.us-east-2.aws.neon.tech/api/auth/me');
    assert.equal(captured.options.headers.get('x-zl-client-ip'), '203.0.113.9');
    assert.equal(captured.options.headers.get('x-zl-proxy-secret'), 'proxy-test-secret');
    assert.equal(captured.options.headers.get('cf-connecting-ip'), '203.0.113.9');
    assert.equal(captured.options.headers.get('x-forwarded-for'), '203.0.113.9');
    assert.equal(captured.options.headers.get('x-forwarded-host'), 'books.lengkhawm.online');
    assert.equal(captured.options.headers.get('x-forwarded-proto'), 'https');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('strict-transport-security'), /max-age=31536000/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
