import http from 'node:http';

const port = Number(process.env.OAUTH_RELAY_PORT || 4010);

http
  .createServer((request, response) => {
    const path = request.url?.startsWith('/') ? request.url : '/';
    response.writeHead(302, {
      Location: `http://localhost:4007${path}`,
      'Cache-Control': 'no-store',
    });
    response.end();
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`OAuth callback relay listening on http://127.0.0.1:${port}`);
  });
