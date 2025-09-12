const http = require('http');

const port = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || '';

// Read authorized users from environment variables instead of a local file
let authUsers = [];
const authUsersEnv = process.env.AUTH_USERS_JSON || process.env.AUTH_USERS || '';
if (authUsersEnv) {
  try {
    const parsed = JSON.parse(authUsersEnv);
    authUsers = Array.isArray(parsed) ? parsed : parsed.AUTH_USERS || [];
  } catch (err) {
    console.error('Invalid AUTH_USERS env', err);
  }
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
