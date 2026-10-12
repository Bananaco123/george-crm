import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const repository = 'Bananaco123/george-crm';
const branch = 'gh-pages';

function api(method, path, body) {
  const args = ['api', `repos/${repository}/${path}`, '--method', method];
  if (body) args.push('--input', '-');
  return JSON.parse(execFileSync('gh', args, {
    cwd: root, input: body ? JSON.stringify(body) : undefined,
    encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  }));
}

// Tests and build must succeed before any remote state changes.
execFileSync(process.execPath, ['--test', 'src/data.test.mjs', 'src/conversations.test.mjs', 'src/destinationData.test.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/run.mjs', 'build'], { cwd: root, stdio: 'inherit' });

let parent;
try { parent = api('GET', `git/ref/heads/${branch}`).object.sha; }
catch (error) { if (!String(error.stderr).includes('404')) throw error; }

const dist = join(root, 'dist');
const files = [];
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`不发布符号链接：${path}`);
    if (entry.isDirectory()) collect(path);
    else if (entry.isFile()) files.push({ path: relative(dist, path).replaceAll('\\', '/'), content: readFileSync(path) });
  }
}
collect(dist);
files.push({ path: '.nojekyll', content: Buffer.from('') });
const treeEntries = files.map(file => {
  const blob = api('POST', 'git/blobs', { content: file.content.toString('base64'), encoding: 'base64' });
  return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
});
const tree = api('POST', 'git/trees', { tree: treeEntries });
const source = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const commit = api('POST', 'git/commits', {
  message: `发布 CRM 网站（源码 ${source}）`, tree: tree.sha, parents: parent ? [parent] : [],
});
if (parent) api('PATCH', `git/refs/heads/${branch}`, { sha: commit.sha, force: false });
else api('POST', 'git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });
if (api('GET', `git/ref/heads/${branch}`).object.sha !== commit.sha) throw new Error('发布分支校验失败');

console.log(`发布分支已更新：${commit.sha}`);
console.log('等待 GitHub Pages 构建完成后访问 https://bananaco123.github.io/george-crm/');
