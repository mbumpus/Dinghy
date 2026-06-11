// Minimal static server for previewing the single-file app
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  const file = req.url === '/' ? '/frigate_config_builder.html' : decodeURIComponent(req.url.split('?')[0]);
  const fp = path.join(root, file);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const type = fp.endsWith('.html') ? 'text/html' : fp.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}).listen(8741, () => console.log('serving on 8741'));
