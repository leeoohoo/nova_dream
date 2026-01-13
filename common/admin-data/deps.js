import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function uniq(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((value) => {
    const resolved = typeof value === 'string' && value.trim() ? path.resolve(value) : '';
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    out.push(resolved);
  });
  return out;
}

function buildRequireCandidates() {
  const workspaceRoot = path.resolve(__dirname, '../..');
  const workspaceParent = path.dirname(workspaceRoot);

  const bases = uniq([
    process.cwd(),
    workspaceRoot,
    path.join(workspaceRoot, 'deepseek_cli'),
    path.join(workspaceRoot, 'aide'),
    workspaceParent,
    path.join(workspaceParent, 'deepseek_cli'),
    path.join(workspaceParent, 'aide'),
  ]);

  return bases.map((base) => createRequire(path.join(base, 'package.json')));
}

const REQUIRE_CANDIDATES = buildRequireCandidates();

export function resolveFromWorkspace(specifier) {
  const name = typeof specifier === 'string' ? specifier.trim() : '';
  if (!name) {
    throw new Error('specifier is required');
  }
  for (const req of REQUIRE_CANDIDATES) {
    try {
      return req.resolve(name);
    } catch {
      // try next candidate
    }
  }
  throw new Error(`[common/admin-data] dependency not found: ${name}`);
}

export function requireFromWorkspace(specifier) {
  const name = typeof specifier === 'string' ? specifier.trim() : '';
  if (!name) {
    throw new Error('specifier is required');
  }
  for (const req of REQUIRE_CANDIDATES) {
    try {
      return req(name);
    } catch {
      // try next candidate
    }
  }
  throw new Error(`[common/admin-data] dependency not found: ${name}`);
}

