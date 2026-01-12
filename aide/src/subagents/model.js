export const DEFAULT_SUBAGENT_MODEL_NAME = 'deepseek_reasoner';

export function resolveSubagentDefaultModel(client, options = {}) {
  const explicit =
    typeof options?.defaultModel === 'string' ? options.defaultModel.trim() : '';
  const env =
    typeof process.env.MODEL_CLI_SUBAGENT_DEFAULT_MODEL === 'string'
      ? process.env.MODEL_CLI_SUBAGENT_DEFAULT_MODEL.trim()
      : '';
  const candidate = explicit || env || DEFAULT_SUBAGENT_MODEL_NAME;
  if (!candidate) return null;

  if (client && typeof client.getModelNames === 'function') {
    try {
      const names = client.getModelNames();
      if (Array.isArray(names) && names.includes(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function resolveSubagentInvocationModel({ configuredModel, currentModel, client, defaultModel } = {}) {
  const explicit = typeof configuredModel === 'string' ? configuredModel.trim() : '';
  if (explicit) return explicit;

  const preferred = resolveSubagentDefaultModel(client, { defaultModel });
  if (preferred) return preferred;

  const current = typeof currentModel === 'string' ? currentModel.trim() : '';
  if (current) return current;

  if (client && typeof client.getDefaultModel === 'function') {
    try {
      return client.getDefaultModel();
    } catch {
      // ignore
    }
  }
  return null;
}

