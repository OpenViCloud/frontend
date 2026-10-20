// The site must never ship the repo's internal docs (docs/features/public-site/user-stories.md#us-site-02 AC-3).
// Customer pages are written under site/src/content/; a stray copy or symlink of docs/ would publish
// internal design notes, and credentials.local.md files hold real test passwords.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(siteDir, 'dist');
const repoDocsDir = join(siteDir, '..', 'docs');

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const problems = [];

if (!existsSync(distDir)) {
  console.error('check-dist: dist/ does not exist — run the build first');
  process.exit(1);
}
const distFiles = walk(distDir);
for (const required of ['index.html', 'vi/index.html', 'docs/index.html', 'vi/docs/index.html', '404.html', 'robots.txt', 'config.json']) {
  if (!existsSync(join(distDir, required))) problems.push(`missing ${required}`);
}

for (const file of distFiles) {
  if (/credentials/i.test(relative(distDir, file))) problems.push(`credential-like file: ${relative(distDir, file)}`);
}

// In the Docker build only site/ is in the context, so the repo docs/ is absent and the hash check
// cannot run there; CI runs this script from the checkout, where it can.
let docsCompared = 0;
if (existsSync(repoDocsDir)) {
  const docHashes = new Map();
  for (const file of walk(repoDocsDir)) {
    if (statSync(file).size === 0) continue;
    docHashes.set(sha256(file), relative(repoDocsDir, file));
    docsCompared += 1;
  }
  for (const file of distFiles) {
    const match = docHashes.get(sha256(file));
    if (match !== undefined) problems.push(`${relative(distDir, file)} is a copy of docs/${match}`);
  }
}

// CI passes --require-docs: comparing against zero files would read as a pass while checking nothing.
if (process.argv.includes('--require-docs') && docsCompared === 0) {
  problems.push(`compared against 0 files in ${repoDocsDir} — the copy check did not run`);
}

if (problems.length > 0) {
  console.error(`check-dist: FAIL — ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`check-dist: OK — ${distFiles.length} dist files, compared against ${docsCompared} repo docs files`);
