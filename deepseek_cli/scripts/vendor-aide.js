#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const externalAideRoot = path.resolve(projectRoot, '..', 'aide');
const internalAideRoot = path.resolve(projectRoot, 'aide');

const INCLUDE_DIRS = ['src', 'shared', 'subagents', 'mcp_servers', 'electron', 'cli-ui'];

function isDirectory(dirPath) {
  if (!dirPath) return false;
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
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
      if (base === '.DS_Store') return false;
      return true;
    },
  });
}

function main() {
  if (!isDirectory(externalAideRoot)) {
    console.error(`[sync:aide] External aide directory not found: ${externalAideRoot}`);
    console.error('[sync:aide] Expected monorepo layout: <repo>/deepseek_cli and <repo>/aide');
    process.exit(1);
  }

  try {
    fs.rmSync(internalAideRoot, { recursive: true, force: true });
  } catch {
    // ignore
  }

  fs.mkdirSync(internalAideRoot, { recursive: true });
  INCLUDE_DIRS.forEach((name) => {
    const src = path.join(externalAideRoot, name);
    if (!isDirectory(src)) return;
    const dest = path.join(internalAideRoot, name);
    copyDir(src, dest);
  });

  console.log(`[sync:aide] Vendored aide into: ${internalAideRoot}`);
}

main();

