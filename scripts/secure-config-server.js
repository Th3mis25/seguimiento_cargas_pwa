const http = require('http');

const port = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || '';

http.createServer((req, res) => {
  if (req.url === '/secure-config.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ API_TOKEN }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
}).listen(port, () => {
  console.log(`Secure config server running on http://localhost:${port}`);
});
