import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { resolveAidePath } from '../src/aide-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const legacyModulePath = resolveAidePath({
  projectRoot,
  relativePath: 'shared/data/legacy.js',
  purpose: 'electron admin defaults',
});
const legacy = await import(pathToFileURL(legacyModulePath).href);
const sessionRootModulePath = resolveAidePath({
  projectRoot,
  relativePath: 'shared/session-root.js',
  purpose: 'electron session root',
});
const sessionRootModule = await import(pathToFileURL(sessionRootModulePath).href);
export const resolveSessionRoot = sessionRootModule.resolveSessionRoot;
export const persistSessionRoot = sessionRootModule.persistSessionRoot;
const {
  buildAdminSeed,
  extractVariables,
  loadBuiltinPromptFiles,
  parseMcpServers,
  parseModelsWithDefault,
  safeRead,
} = legacy;

export function createAdminDefaultsManager({ defaultPaths, adminDb, adminServices } = {}) {
  if (!defaultPaths) {
    throw new Error('defaultPaths is required');
  }
  if (!adminDb) {
    throw new Error('adminDb is required');
  }
  if (!adminServices) {
    throw new Error('adminServices is required');
  }

  function setSubagentModels({ model, plugins } = {}) {
    const targetModel = typeof model === 'string' ? model.trim() : '';
    if (!targetModel) {
      throw new Error('model is required');
    }
    const pluginRoots = [defaultPaths.pluginsDir, defaultPaths.pluginsDirUser].filter(Boolean);
    const existingRoots = pluginRoots.filter((root) => {
      try {
        return fs.existsSync(root) && fs.statSync(root).isDirectory();
      } catch {
        return false;
      }
    });
    if (existingRoots.length === 0) {
      throw new Error(`Plugins directory not found: ${defaultPaths.pluginsDir}`);
    }
    const candidates = Array.from(
      new Set(
        existingRoots.flatMap((root) => {
          try {
            return fs
              .readdirSync(root, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .map((entry) => entry.name);
          } catch {
            return [];
          }
        })
      )
    );
    const pluginList =
      Array.isArray(plugins) && plugins.length > 0
        ? candidates.filter((p) => plugins.includes(p))
        : candidates;
    if (pluginList.length === 0) {
      throw new Error('No plugins matched selection');
    }
    const summary = { model: targetModel, scanned: 0, updated: 0, skipped: 0, errors: [] };
    pluginList.forEach((pluginId) => {
      let scannedAny = false;
      existingRoots.forEach((root) => {
        const manifestPath = path.join(root, pluginId, 'plugin.json');
        if (!fs.existsSync(manifestPath)) {
          return;
        }
        scannedAny = true;
        summary.scanned += 1;
        try {
          const raw = fs.readFileSync(manifestPath, 'utf8');
          const manifest = JSON.parse(raw);
          let changed = false;
          if (Array.isArray(manifest.agents)) {
            manifest.agents = manifest.agents.map((agent) => {
              const next = { ...agent, model: targetModel };
              if (next.model !== agent.model) changed = true;
              return next;
            });
          }
          if (Array.isArray(manifest.commands)) {
            manifest.commands = manifest.commands.map((command) => {
              const next = { ...command, model: targetModel };
              if (next.model !== command.model) changed = true;
              return next;
            });
          }
          if (changed) {
            fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
            summary.updated += 1;
          }
        } catch (err) {
          summary.errors.push({ plugin: pluginId, error: err.message || String(err) });
        }
      });
      if (!scannedAny) {
        summary.skipped += 1;
      }
    });
    return summary;
  }

  function readDefaultMcpServers() {
    const raw =
      safeRead(path.join(path.resolve(defaultPaths.defaultsRoot || ''), 'shared', 'defaults', 'mcp.config.json')) ||
      safeRead(defaultPaths.mcpConfig);
    return parseMcpServers(raw);
  }

  function readDefaultModels() {
    const raw =
      safeRead(path.join(path.resolve(defaultPaths.defaultsRoot || ''), 'shared', 'defaults', 'models.yaml')) ||
      safeRead(defaultPaths.models);
    return parseModelsWithDefault(raw).entries;
  }

  function refreshModelsFromDefaults() {
    const now = new Date().toISOString();
    const existing = adminServices.models.list() || [];
    const existingMap = new Map(existing.map((m) => [m.name, m]));

    readDefaultModels().forEach((model) => {
      if (!model?.name) return;
      const prev = existingMap.get(model.name);
      const payload = {
        id: prev?.id,
        name: model.name,
        provider: prev?.provider || model.provider || '',
        model: prev?.model || model.model || '',
        reasoningEffort: prev?.reasoningEffort ?? model.reasoningEffort ?? '',
        baseUrl: prev?.baseUrl || model.baseUrl || '',
        apiKeyEnv: prev?.apiKeyEnv || model.apiKeyEnv || '',
        tools: Array.isArray(prev?.tools) ? prev.tools : model.tools || [],
        description: prev?.description || model.description || '',
        isDefault: prev?.isDefault ?? model.isDefault ?? false,
        createdAt: prev?.createdAt || now,
        updatedAt: now,
      };
      if (prev) {
        adminDb.update('models', prev.id, payload);
      } else {
        adminDb.insert('models', payload);
      }
    });
  }

  function readDefaultPrompts() {
    return loadBuiltinPromptFiles(defaultPaths) || [];
  }

  function refreshBuiltinsFromDefaults() {
    const now = new Date().toISOString();
    const hostApp =
      String(process.env.MODEL_CLI_HOST_APP || 'chatos')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'chatos';

    try {
      const existingMcp = adminServices.mcpServers.list();
      const mcpMap = new Map((existingMcp || []).map((item) => [item.name, item]));
      readDefaultMcpServers().forEach((srv) => {
        if (!srv?.name) return;
        const prev = mcpMap.get(srv.name);
        const payload = {
          ...srv,
          app_id: prev?.app_id || srv.app_id || hostApp,
          allowMain: typeof prev?.allowMain === 'boolean' ? prev.allowMain : srv.allowMain === true,
          allowSub: typeof prev?.allowSub === 'boolean' ? prev.allowSub : srv.allowSub !== false,
          enabled: typeof prev?.enabled === 'boolean' ? prev.enabled : srv.enabled !== false,
          locked: true,
          id: prev?.id,
          createdAt: prev?.createdAt || now,
          updatedAt: now,
        };
        if (prev) {
          adminDb.update('mcpServers', prev.id, payload);
        } else {
          adminDb.insert('mcpServers', payload);
        }
      });
    } catch (err) {
      console.error('[MCP] 同步内置配置失败', err);
    }

    try {
      const existingPrompts = adminServices.prompts.list();
      const promptMap = new Map((existingPrompts || []).map((item) => [item.name, item]));
      readDefaultPrompts().forEach((prompt) => {
        if (!prompt?.name) return;
        const prev = promptMap.get(prompt.name);
        const allowMain = typeof prev?.allowMain === 'boolean' ? prev.allowMain : prompt.allowMain === true;
        const allowSub = typeof prev?.allowSub === 'boolean' ? prev.allowSub : prompt.allowSub === true;
        const payload = {
          ...prompt,
          builtin: true,
          locked: true,
          content: prompt.content,
          defaultContent: prompt.content,
          allowMain,
          allowSub,
          id: prev?.id,
          createdAt: prev?.createdAt || now,
          updatedAt: now,
          variables: extractVariables(prompt.content),
        };
        if (prev) {
          adminDb.update('prompts', prev.id, payload);
        } else {
          adminDb.insert('prompts', payload);
        }
      });

      ['user_prompt', 'subagent_user_prompt'].forEach((name) => {
        const prev = promptMap.get(name);
        if (prev?.builtin && prev?.id) {
          adminDb.remove('prompts', prev.id);
        }
      });
    } catch (err) {
      console.error('[Prompts] 同步内置配置失败', err);
    }
  }

  function maybeReseedModelsFromYaml() {
    const current = adminServices.models.list();
    const looksBroken =
      current.length > 0 &&
      current.every((m) => !m.provider || !m.model || m.name === 'models' || m.name === 'default_model');
    if (!looksBroken) {
      return;
    }
    const seed = buildAdminSeed(defaultPaths);
    if (Array.isArray(seed.models) && seed.models.length > 0) {
      adminDb.reset('models', seed.models);
    }
  }

  function maybeReseedSubagentsFromPlugins() {
    const current = adminServices.subagents.list();
    const seed = buildAdminSeed(defaultPaths);
    if (!Array.isArray(seed.subagents) || seed.subagents.length === 0) return;
    const enabledMap = new Map(current.map((s) => [s.id, s.enabled]));
    const patched = seed.subagents.map((s) => ({
      ...s,
      enabled: enabledMap.has(s.id) ? enabledMap.get(s.id) : s.enabled,
    }));
    adminDb.reset('subagents', patched);
  }

  return {
    readDefaultMcpServers,
    readDefaultModels,
    readDefaultPrompts,
    refreshBuiltinsFromDefaults,
    refreshModelsFromDefaults,
    maybeReseedModelsFromYaml,
    maybeReseedSubagentsFromPlugins,
    setSubagentModels,
  };
}
