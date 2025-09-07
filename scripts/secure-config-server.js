const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || '';

const authUsersPath = path.join(__dirname, '../secure-config.json');
let authUsers = [];
try {
  authUsers = JSON.parse(fs.readFileSync(authUsersPath, 'utf8')).AUTH_USERS || [];
} catch (err) {
  console.error('Unable to read secure-config.json', err);
}

http.createServer((req, res) => {
  if (req.url === '/secure-config.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ AUTH_USERS: authUsers, API_TOKEN }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
}).listen(port, () => {
  console.log(`Secure config server running on http://localhost:${port}`);
});
