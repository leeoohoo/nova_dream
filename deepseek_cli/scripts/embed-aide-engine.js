#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const defaultExternalAideRoot = path.resolve(projectRoot, '..', 'aide');
const internalAideRoot = path.resolve(projectRoot, 'aide');

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const skipIfPresent = args.includes('--skip-if-present');

function readArgValue(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return '';
  const v = args[idx + 1];
  return typeof v === 'string' ? v.trim() : '';
}

function resolveExternalAideRoot() {
  const fromArg = readArgValue('--aide-root');
  if (fromArg) return path.resolve(fromArg);
  const fromEnv = typeof process.env.MODEL_CLI_AIDE_EMBED_ROOT === 'string' ? process.env.MODEL_CLI_AIDE_EMBED_ROOT.trim() : '';
  if (fromEnv) return path.resolve(fromEnv);
  return defaultExternalAideRoot;
}

function isDirectory(dirPath) {
  const p = typeof dirPath === 'string' ? dirPath.trim() : '';
  if (!p) return false;
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(filePath) {
  const p = typeof filePath === 'string' ? filePath.trim() : '';
  if (!p) return false;
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  const p = typeof dirPath === 'string' ? dirPath.trim() : '';
  if (!p) return;
  fs.mkdirSync(p, { recursive: true });
}

function rmForce(targetPath) {
  const p = typeof targetPath === 'string' ? targetPath.trim() : '';
  if (!p) return;
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function copyDir(srcDir, destDir) {
  fs.cpSync(srcDir, destDir, {
    recursive: true,
    force: true,
    dereference: false,
    filter: (src) => {
      const base = path.basename(src);
      if (base === 'node_modules') return false;
      if (base === '.git') return false;
      if (base === '.DS_Store') return false;
      return true;
    },
  });
}

function listFilesRecursive(dirPath) {
  const results = [];
  const root = typeof dirPath === 'string' ? dirPath.trim() : '';
  if (!root) return results;
  if (!isDirectory(root)) return results;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function patchEmbeddedAideCommonImports(aideRoot) {
  const root = typeof aideRoot === 'string' ? aideRoot.trim() : '';
  if (!root) return;
  const sharedRoot = path.join(root, 'shared');
  if (!isDirectory(sharedRoot)) return;

  const COMMON_IMPORT_RE = /(['"])((?:\.\.\/)+)common\//g;
  const candidates = listFilesRecursive(sharedRoot).filter((filePath) =>
    ['.js', '.mjs', '.cjs'].includes(path.extname(filePath).toLowerCase())
  );

  candidates.forEach((filePath) => {
    let src = '';
    try {
      src = fs.readFileSync(filePath, 'utf8');
    } catch {
      return;
    }
    const next = src.replace(COMMON_IMPORT_RE, (_match, quote, relPrefix) => `${quote}../${relPrefix}common/`);
    if (next === src) return;
    try {
      fs.writeFileSync(filePath, next, 'utf8');
    } catch {
      // ignore write errors
    }
  });
}

function run(command, commandArgs, options) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    const err = new Error(`${command} exited with code ${result.status}`);
    err.exitCode = result.status;
    throw err;
  }
}

function main() {
  const externalAideRoot = resolveExternalAideRoot();
  if (!isDirectory(externalAideRoot)) {
    console.error(`[embed:aide] AIDE root not found: ${externalAideRoot}`);
    console.error('[embed:aide] Provide via --aide-root <path> or MODEL_CLI_AIDE_EMBED_ROOT.');
    process.exit(1);
  }

  const expectedEntrypoint = path.join(externalAideRoot, 'dist', 'cli.js');
  if (!skipBuild) {
    run(process.execPath, [path.join(externalAideRoot, 'scripts', 'build-engine.js'), '--skip-if-present'], {
      cwd: externalAideRoot,
    });
    run(
      process.execPath,
      [path.join(externalAideRoot, 'scripts', 'build-cli-ui-plugin.js'), '--release', '--skip-if-present'],
      {
        cwd: externalAideRoot,
      }
    );
  }

  if (!isFile(expectedEntrypoint)) {
    console.error(`[embed:aide] AIDE dist entry not found: ${expectedEntrypoint}`);
    console.error('[embed:aide] Ensure AIDE is built (dist/cli.js).');
    process.exit(1);
  }

  if (skipIfPresent && isFile(path.join(internalAideRoot, 'dist', 'cli.js'))) {
    console.log(`[embed:aide] Already present: ${internalAideRoot}`);
  } else {
    rmForce(internalAideRoot);
    ensureDir(internalAideRoot);

    const includeDirs = ['dist', 'shared', 'subagents', 'mcp_servers', 'electron', 'ui_apps', 'build_resources'];
    includeDirs.forEach((name) => {
      const src = path.join(externalAideRoot, name);
      if (!isDirectory(src)) return;
      copyDir(src, path.join(internalAideRoot, name));
    });

    ['package.json', 'package-lock.json', 'README.md'].forEach((name) => {
      const src = path.join(externalAideRoot, name);
      if (!isFile(src)) return;
      fs.copyFileSync(src, path.join(internalAideRoot, name));
    });

    patchEmbeddedAideCommonImports(internalAideRoot);

    console.log(`[embed:aide] Embedded AIDE runtime into: ${internalAideRoot}`);
  }

  // Sync AIDE UI Apps plugin as a built-in plugin (so it shows up without "install engine").
  const pluginId = 'aide-builtin';
  const pluginSrc = path.join(externalAideRoot, 'ui_apps', 'plugins', pluginId);
  const pluginDest = path.join(projectRoot, 'ui_apps', 'plugins', pluginId);
  if (!isDirectory(pluginSrc)) {
    console.warn(`[embed:aide] Plugin not found: ${pluginSrc}`);
    return;
  }
  rmForce(pluginDest);
  ensureDir(path.dirname(pluginDest));
  copyDir(pluginSrc, pluginDest);
  console.log(`[embed:aide] Synced built-in plugin: ${pluginDest}`);
}

main();
