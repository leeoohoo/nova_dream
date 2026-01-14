import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { copyDir, ensureDir, isDirectory, writeJson, writeText } from './fs.js';

function packageRoot() {
  // src/lib/template.js -> src -> package root
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..');
}

export function getTemplateDir(name) {
  const root = packageRoot();
  const dir = path.join(root, 'templates', name);
  if (!isDirectory(dir)) throw new Error(`template not found: ${name}`);
  return dir;
}

export function copyTemplate({ templateName, destDir }) {
  const srcDir = getTemplateDir(templateName);
  ensureDir(destDir);

  copyDir(srcDir, destDir, {
    filter: (src) => {
      const base = path.basename(src);
      if (base === 'node_modules') return false;
      if (base === '.DS_Store') return false;
      return true;
    },
  });
}

export function writeScaffoldManifest({ destPluginDir, pluginId, pluginName, version, appId, withBackend = true }) {
  const manifest = {
    manifestVersion: 1,
    id: pluginId,
    name: pluginName,
    version: version || '0.1.0',
    description: 'A ChatOS UI Apps plugin.',
    ...(withBackend ? { backend: { entry: 'backend/index.mjs' } } : {}),
    apps: [
      {
        id: appId,
        name: 'My App',
        description: 'A ChatOS module app.',
        entry: { type: 'module', path: `apps/${appId}/index.mjs` },
        ai: {
          // Keep the default scaffold dependency-free: prompt is safe, MCP server is opt-in.
          mcpPrompt: {
            title: 'My App · MCP Prompt',
            zh: `apps/${appId}/mcp-prompt.zh.md`,
            en: `apps/${appId}/mcp-prompt.en.md`,
          },
        },
      },
    ],
  };

  writeJson(path.join(destPluginDir, 'plugin.json'), manifest);
  return manifest;
}

export function writeScaffoldPackageJson({ destDir, projectName }) {
  const pkg = {
    name: projectName,
    private: true,
    type: 'module',
    scripts: {
      dev: 'chatos-uiapp dev',
      validate: 'chatos-uiapp validate',
      pack: 'chatos-uiapp pack',
      'install:chatos': 'chatos-uiapp install --host-app chatos',
    },
    devDependencies: {
      '@chatos/ui-apps-devkit': '^0.1.0',
    },
  };

  writeJson(path.join(destDir, 'package.json'), pkg);
  return pkg;
}

export function writeScaffoldConfig({ destDir, pluginDir = 'plugin', appId = '' }) {
  const cfg = {
    pluginDir,
    appId,
  };
  writeJson(path.join(destDir, 'chatos.config.json'), cfg);
  return cfg;
}

export function maybeReplaceTokensInFile(filePath, replacements) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let next = raw;
  for (const [key, value] of Object.entries(replacements || {})) {
    next = next.split(key).join(String(value));
  }
  if (next !== raw) {
    writeText(filePath, next);
  }
}
