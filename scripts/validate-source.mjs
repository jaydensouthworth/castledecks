import assert from 'node:assert/strict';
import {readFileSync, readdirSync, lstatSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'site/dist');
const files = [];
const forbiddenDirectory = /^(recovery|analysis|work|private|backups|saves|\.openai|\.aws|\.codex|\.agents)$/i;
const forbiddenExtension = /\.(swf|as|fla|jar|exe|zip|tar|gz|7z|bundle|pem|key)$/i;
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (['.git', 'node_modules', 'coverage', 'test-results', 'playwright-report'].includes(entry)) continue;
    const full = path.join(directory, entry), info = lstatSync(full), relative = path.relative(root, full);
    assert(!info.isSymbolicLink(), `Symlink excluded from source: ${relative}`);
    assert(!forbiddenDirectory.test(entry), `Private directory excluded from source: ${relative}`);
    assert(!forbiddenExtension.test(entry), `Archive, original source or credential excluded: ${relative}`);
    assert(!/^\.env(?:\.|$)/.test(entry) || entry === '.env.example', `Local environment excluded: ${relative}`);
    if (info.isDirectory()) walk(full);
    else { assert(info.isFile(), `Regular file required: ${relative}`); files.push(full); }
  }
}
walk(root);

for (const file of files) {
  if (file.endsWith('.mjs')) execFileSync(process.execPath, ['--check', file], {stdio: 'pipe'});
  if (!/\.(mjs|html|css|json|md|yml)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  assert(!/https:\/\/chatgpt\.com\/space\//.test(content), `Private project link excluded: ${path.relative(root, file)}`);
  assert(!/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|AKIA[A-Z0-9]{16})/.test(content), `Possible credential: ${path.relative(root, file)}`);
  if (file.startsWith(dist + path.sep) && /\.(html|css|mjs)$/.test(file)) {
    const refs = file.endsWith('.html')
      ? [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1])
      : file.endsWith('.css')
        ? [...content.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1])
        : [...content.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)].map(m => m[1]);
    for (const ref of refs) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
      const clean = ref.split(/[?#]/)[0];
      if (!clean) continue;
      const target = path.resolve(path.dirname(file), clean);
      assert(target === dist || target.startsWith(dist + path.sep), `Resource escapes static source: ${ref}`);
      assert(existsSync(target) || (file.endsWith('.html') && !path.extname(target) && existsSync(target + '.html')), `Missing resource ${ref} referenced by ${path.relative(root, file)}`);
    }
  }
}
const html = readFileSync(path.join(dist, 'battle.html'), 'utf8');
const script = readFileSync(path.join(dist, 'battle.mjs'), 'utf8');
const links = [...html.matchAll(/<link\b[^<>]*>/g)];
assert.equal(links.length, (html.match(/<link\b/g) ?? []).length, 'Malformed link tag');
const styles = links.filter(([tag]) => /rel="stylesheet"/.test(tag)).map(([tag]) => tag.match(/href="([^"]+)"/)?.[1]);
for (const sheet of ['battle.css', 'live-action-bar.css', 'menus.css', 'armory-catalog.css'])
  assert.equal(styles.filter(href => href?.split('?')[0] === './' + sheet).length, 1, `Missing or duplicate stylesheet ${sheet}`);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate game element IDs');
const uiScripts = files.filter(file => file.endsWith('.mjs') && path.dirname(file) === dist).map(file => readFileSync(file, 'utf8')).join('\n');
const dynamicIds = [...uiScripts.matchAll(/\bid="([a-zA-Z][\w-]*)"/g)].map(match => match[1]);
for (const match of script.matchAll(/\$\(['"]#([a-zA-Z][\w-]*)['"]\)/g))
  assert(ids.includes(match[1]) || dynamicIds.includes(match[1]), `Missing game element: ${match[1]}`);
for (const required of ['battle.html', 'battle.css', 'battle.mjs', 'index.html', 'images/highland-background.png', 'images/regal-great-hall.png'])
  assert(files.includes(path.join(dist, required)), `Missing runtime asset: ${required}`);
console.log(JSON.stringify({sourceFiles: files.length, runtimeFiles: files.filter(f => f.startsWith(dist + path.sep)).length, javascriptModules: files.filter(f => f.endsWith('.mjs') && f.startsWith(dist + path.sep)).length, markupIds: ids.length, privateAssetsExcluded: true}));
