// Cloudflare Worker proxy: keep the browser on books.lengkhawm.online while
// forwarding /api/* to the deployed Neon Function. Cookies remain same-origin.
const UPSTREAM = 'https://br-noisy-meadow-bdo80kpa-zledgercraft.compute.c-8.us-east-2.aws.neon.tech';

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const target = new URL(UPSTREAM);
    target.pathname = incoming.pathname;
    target.search = incoming.search;

    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', incoming.host);
    headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''));
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) headers.set('x-forwarded-for', clientIp);

    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });
    const responseHeaders = new Headers(response.headers);
    if (incoming.protocol === 'https:') {
      responseHeaders.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
