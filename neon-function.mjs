// Neon Function adapter for the existing Node request handler.
// The normal server still uses serve.mjs + node:http; this file translates a
// Web Request into the minimal Node request/response shape requestHandler uses.
import { requestHandler } from './serve.mjs';

function nodeRequest(request, body) {
  const headers = {};
  for (const [name, value] of request.headers) headers[name.toLowerCase()] = value;
  const url = new URL(request.url);
  const forwarded = String(headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    socket: {
      remoteAddress:
        forwarded || headers['cf-connecting-ip'] || headers['x-real-ip'] || 'unknown',
    },
    async *[Symbol.asyncIterator]() {
      if (body.length) yield body;
    },
  };
}

export default {
  async fetch(request) {
    const body =
      request.method === 'GET' || request.method === 'HEAD'
        ? Buffer.alloc(0)
        : Buffer.from(await request.arrayBuffer());
    const req = nodeRequest(request, body);
    const headers = new Headers();
    const chunks = [];
    let status = 200;
    let resolveResponse;
    const finished = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      resolveResponse();
    };
    const setHeader = (name, value) => {
      const key = String(name).toLowerCase();
      const values = Array.isArray(value) ? value : [value];
      if (key === 'set-cookie') {
        headers.delete(key);
        for (const item of values) headers.append(key, String(item));
        return;
      }
      headers.delete(key);
      headers.set(key, values.map(String).join(', '));
    };
    const res = {
      headersSent: false,
      setHeader,
      writeHead(code, values = {}) {
        status = Number(code) || 200;
        this.headersSent = true;
        for (const [name, value] of Object.entries(values || {})) setHeader(name, value);
      },
      write(chunk) {
        if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk));
      },
      end(chunk) {
        if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk));
        finish();
      },
      destroy() {
        finish();
      },
    };
    try {
      await requestHandler(req, res);
    } catch (error) {
      console.error(`Neon Function request failed: ${error.message}`);
      if (!res.headersSent) {
        status = 500;
        headers.set('content-type', 'text/plain; charset=utf-8');
        chunks.push(Buffer.from('Internal server error'));
      }
      finish();
    }
    await finished;
    const payload = chunks.length ? Buffer.concat(chunks) : null;
    return new Response(payload, { status, headers });
  },
};
