import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createStaticServer} from '../scripts/serve.mjs';

async function withServer(t) {
  const server = createStaticServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return ({path = '/', method = 'GET'} = {}) => new Promise((resolve, reject) => {
    const req = request({host: '127.0.0.1', port: server.address().port, path, method}, response => {
      const parts = []; response.on('data', part => parts.push(part));
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body: Buffer.concat(parts).toString()}));
    }); req.on('error', reject); req.end();
  });
}
test('dev server serves the index and extensionless game modes', async t => {
  const get = await withServer(t);
  assert.equal((await get()).status, 200);
  const result = await get({path: '/battle?mode=test'});
  assert.equal(result.status, 200); assert.match(result.body, /<html/); assert.match(result.headers['content-type'], /text\/html/);
});
test('dev server serves modules with JavaScript MIME and HEAD without a body', async t => {
  const get = await withServer(t), result = await get({path: '/battle.mjs', method: 'HEAD'});
  assert.equal(result.status, 200); assert.equal(result.body, ''); assert.match(result.headers['content-type'], /javascript/); assert.ok(Number(result.headers['content-length']) > 100);
  const image = await get({path: '/images/command-hall.webp', method: 'HEAD'});
  assert.equal(image.status, 200); assert.equal(image.headers['content-type'], 'image/webp'); assert.ok(Number(image.headers['content-length']) > 100);
});
test('dev server rejects traversal, hidden files and malformed paths', async t => {
  const get = await withServer(t);
  for (const path of ['/../package.json', '/%2e%2e/package.json', '/.git/config', '/%00', '/%5c..']) assert.equal((await get({path})).status, 403);
  assert.equal((await get({path: '/%zz'})).status, 400);
});
test('dev server has no mutation route and missing files return 404', async t => {
  const get = await withServer(t);
  assert.equal((await get({path: '/unknown'})).status, 404);
  const post = await get({path: '/battle', method: 'POST'}); assert.equal(post.status, 405); assert.equal(post.headers.allow, 'GET, HEAD');
});
