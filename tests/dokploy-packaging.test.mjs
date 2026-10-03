import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';

const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
const nginx = await readFile(new URL('../nginx.conf', import.meta.url), 'utf8');

// Contract checks only: actual Nginx syntax/HTTP behavior also needs a container smoke test.
test('production image serves only the static runtime on port 80', () => {
  assert.match(dockerfile, /^FROM nginx:1\.30\.5-alpine3\.24$/m);
  assert.match(dockerfile, /^COPY site\/dist\/ \/usr\/share\/nginx\/html\/$/m);
  assert.match(dockerfile, /^COPY nginx\.conf \/etc\/nginx\/conf\.d\/default\.conf$/m);
  assert.match(dockerfile, /^EXPOSE 80$/m);
  assert.doesNotMatch(dockerfile, /npm|cargo|COPY \. /);
});

test('extensionless HTML routing preserves real 404 responses', () => {
  assert.match(nginx, /listen 80;/);
  assert.match(nginx, /root \/usr\/share\/nginx\/html;/);
  assert.match(nginx, /try_files \$uri \$uri\.html \$uri\/ =404;/);
  assert.doesNotMatch(nginx, /try_files[^;]*\/index\.html/);
});

test('native modules have a JavaScript MIME type and mutable assets revalidate', () => {
  assert.match(nginx, /location ~ \\\.mjs\$\s*\{\s*types \{ text\/javascript mjs; \}\s*try_files \$uri =404;/);
  assert.match(nginx, /add_header Cache-Control "no-cache" always;/);
  assert.match(nginx, /add_header X-Content-Type-Options "nosniff" always;/);
  assert.doesNotMatch(nginx, /immutable/);
});

test('expected route targets and module entrypoint are shipped', async () => {
  for (const file of ['index.html', 'battle.html', 'lab.html', 'phone-preview.html', 'battle.mjs']) {
    await access(new URL(`../site/dist/${file}`, import.meta.url));
  }
});
