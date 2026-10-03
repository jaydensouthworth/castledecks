import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const defaultRoot = fileURLToPath(new URL('../site/dist/', import.meta.url));
const types = {'.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png'};

// Local development only. Match the production host's extensionless HTML routes.
export function createStaticServer({root = defaultRoot} = {}) {
  root = path.resolve(root);
  return createServer(async (request, response) => {
    const finish = (status, body) => { response.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8'}); response.end(request.method === 'HEAD' ? undefined : body); };
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); finish(405, 'Method not allowed'); return; }
    let pathname;
    try { pathname = decodeURIComponent(request.url.split(/[?#]/)[0]); }
    catch { finish(400, 'Invalid path'); return; }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(segment => segment === '..' || segment.startsWith('.'))) { finish(403, 'Forbidden'); return; }
    let target = path.resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) { finish(403, 'Forbidden'); return; }
    try {
      let info;
      try { info = await stat(target); }
      catch (error) {
        if (error.code !== 'ENOENT' || path.extname(target)) throw error;
        target += '.html'; info = await stat(target);
      }
      if (info.isDirectory()) { target = path.join(target, 'index.html'); info = await stat(target); }
      if (!info.isFile()) { finish(404, 'Not found'); return; }
      const body = await readFile(target);
      response.writeHead(200, {'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) { finish(error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Unable to read file'); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  createStaticServer().listen(port, '127.0.0.1', () => console.log(`Castledecks: http://127.0.0.1:${port}/battle`));
}
