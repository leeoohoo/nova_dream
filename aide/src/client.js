import crypto from 'crypto';
import { ConfigError } from './config.js';
import { createProvider } from './providers/index.js';
import { resolveToolset } from './tools/index.js';

export class ModelClient {
  constructor(config) {
    this.config = config;
    this.providerCache = new Map();
  }

  getModelNames() {
    return Object.keys(this.config.models);
  }

  getDefaultModel() {
    return this.config.getModel(null).name;
  }

  async chat(modelName, session, options = {}) {
    const settings = this.config.getModel(modelName);
    const provider = this.#getOrCreateProvider(settings);
    const shouldLogRequest = process.env.MODEL_CLI_LOG_REQUEST === '1';
    const toolNamesOverride = options.toolsOverride;
    const disableTools = options.disableTools === true;
    const toolset = disableTools
      ? []
      : resolveToolset(
          Array.isArray(toolNamesOverride) && toolNamesOverride.length > 0
            ? toolNamesOverride
            : settings.tools
        );
    const stream = options.stream !== false;
    const onBeforeRequest =
      typeof options.onBeforeRequest === 'function' ? options.onBeforeRequest : null;

    const providerOptions = {
      stream,
      tools: toolset.map((tool) => tool.definition),
      onToken: options.onToken,
      onReasoning: options.onReasoning,
      signal: options.signal,
    };

    const maxToolPasses = options.maxToolPasses ?? 240;
    let iteration = 0;
    const caller =
      typeof options?.caller === 'string' && options.caller.trim() ? options.caller.trim() : '';
    while (iteration < maxToolPasses) {
      throwIfAborted(options.signal);
      if (onBeforeRequest) {
        // Allow callers to inject maintenance work (e.g. summary compaction)
        // at safe boundaries before each model call.
        await onBeforeRequest({ iteration, model: settings.name, session });
      }
      throwIfAborted(options.signal);
      const messages = session.asDicts();
      if (shouldLogRequest) {
        const preview = {
          model: settings.name,
          iteration,
          stream,
          tools: Array.isArray(providerOptions.tools)
            ? providerOptions.tools.map((t) => t?.function?.name || t?.name || 'unknown')
            : [],
          messages,
        };
        // stderr to avoid interfering with CLI output/streams
        console.error('[model-cli] request payload:', JSON.stringify(preview, null, 2));
      }
      const result = await raceWithAbort(provider.complete(messages, providerOptions), options.signal);
      throwIfAborted(options.signal);
      const finalText = (result.content ?? '').trim();
      const toolCalls = normalizeToolCalls(result.toolCalls);
      const supportsReasoning =
        typeof provider.supportsReasoningContent === 'function'
          ? provider.supportsReasoningContent()
          : false;
      const reasoningContent =
        typeof result.reasoning === 'string'
          ? result.reasoning
          : supportsReasoning
            ? ''
            : undefined;
      const assistantMeta =
        reasoningContent !== undefined && reasoningContent !== null
          ? { reasoning_content: reasoningContent }
          : supportsReasoning
            ? { reasoning_content: '' }
            : null;
      if (toolCalls.length > 0) {
        if (disableTools) {
          session.addAssistant(finalText, null, assistantMeta);
          return finalText;
        }
        // Emit the assistant step that triggered tool calls so the event log/UI
        // can show intermediate thinking/content during tool scheduling.
        if (typeof options.onAssistantStep === 'function') {
          try {
            options.onAssistantStep({
              text: finalText,
              reasoning: reasoningContent,
              toolCalls,
              iteration,
              model: settings.name,
            });
          } catch {
            // ignore callback errors
          }
        }
        const checkpoint = session.checkpoint();
        session.addAssistant(finalText, toolCalls, assistantMeta);
        try {
          for (const call of toolCalls) {
            throwIfAborted(options.signal);
            const target = toolset.find((tool) => tool.name === call.function?.name);
            if (!target) {
              const errMsg = `Tool "${call.function?.name}" is not registered but was requested by the model`;
              session.addToolResult(call.id, `[error] ${errMsg}`);
              options.onToolResult?.({
                tool: call.function?.name || 'unknown',
                callId: call.id,
                result: `[error] ${errMsg}`,
              });
              continue;
            }
            const argsRaw = call.function?.arguments || '{}';
            let parsedArgs = {};
            try {
              parsedArgs = parseToolArguments(target.name, argsRaw);
            } catch (err) {
              const errText = `[error] Failed to parse tool arguments: ${err.message}`;
              session.addToolResult(call.id, errText);
              options.onToolResult?.({
                tool: target.name,
                callId: call.id,
                result: errText,
              });
              continue;
            }
            const hydratedArgs = ensureTaskAddPayload(target.name, parsedArgs, session);
            const finalArgs = maybeAttachSessionIdForTaskTool(target.name, hydratedArgs, session);
            options.onToolCall?.({
              tool: target.name,
              callId: call.id,
              args: finalArgs,
            });
            try {
              const toolResult = await target.handler(finalArgs, {
                model: settings.name,
                session,
                signal: options.signal,
                toolCallId: call.id,
                ...(caller ? { caller } : {}),
              });
              const toolResultText = formatToolResultText(toolResult);
              const toolResultForSession = sanitizeToolResultForSession(toolResultText, {
                tool: target.name,
              });
              session.addToolResult(call.id, toolResultForSession);
              options.onToolResult?.({
                tool: target.name,
                callId: call.id,
                result: toolResultText,
              });
            } catch (err) {
              if (err?.name === 'AbortError' || options.signal?.aborted) {
                throw err?.name === 'AbortError' ? err : createAbortError();
              }
              const errText = `[error] Tool "${target.name}" failed: ${err.message || err}`;
              session.addToolResult(call.id, errText);
              options.onToolResult?.({
                tool: target.name,
                callId: call.id,
                result: errText,
              });
            }
          }
        } catch (err) {
          if (err?.name === 'AbortError' || options.signal?.aborted) {
            session.restore(checkpoint);
          }
          throw err;
        }
        iteration += 1;
        continue;
      }
      session.addAssistant(finalText, null, assistantMeta);
      return finalText;
    }
    throw new Error('Too many consecutive tool calls. Aborting.');
  }

  #getOrCreateProvider(settings) {
    let provider = this.providerCache.get(settings.name);
    if (!provider) {
      provider = createProvider(settings.provider, settings);
      this.providerCache.set(settings.name, provider);
    }
    return provider;
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function createAbortError() {
  const err = new Error('aborted');
  err.name = 'AbortError';
  return err;
}

async function raceWithAbort(promise, signal) {
  if (!signal || typeof signal.addEventListener !== 'function') {
    return promise;
  }
  if (signal.aborted) {
    throw createAbortError();
  }
  let onAbort = null;
  const abortPromise = new Promise((_, reject) => {
    onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    try {
      if (onAbort && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
    } catch {
      // ignore
    }
  }
}

function parseToolArguments(toolName, argsRaw) {
  if (!argsRaw || !argsRaw.trim()) {
    return {};
  }
  try {
    return JSON.parse(argsRaw);
  } catch (err) {
    logToolArgumentParseFailure('raw', toolName, argsRaw, err);
    const repaired = repairJsonString(argsRaw);
    if (repaired && repaired !== argsRaw) {
      try {
        return JSON.parse(repaired);
      } catch (err2) {
        logToolArgumentParseFailure('repaired', toolName, repaired, err2);
        throw new Error(
          `Failed to parse arguments for tool ${toolName}: ${err2.message}`
        );
      }
    }
    throw new Error(`Failed to parse arguments for tool ${toolName}: ${err.message}`);
  }
}

function repairJsonString(input) {
  if (!input) {
    return input;
  }
  let output = '';
  let inString = false;
  let escaping = false;
  let stringIsKey = false;
  const contextStack = [];
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inString) {
      if (escaping) {
        if (isValidJsonEscape(char)) {
          output += `\\${char}`;
        } else if (char === '\n') {
          output += '\\\\n';
        } else if (char === '\r') {
          output += '\\\\r';
        } else if (char) {
          output += `\\\\${char}`;
        } else {
          output += '\\\\';
        }
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        const containerType =
          contextStack.length > 0 ? contextStack[contextStack.length - 1].type : null;
        const parentType =
          contextStack.length > 1 ? contextStack[contextStack.length - 2].type : null;
        if (stringIsKey || looksLikeValueTerminator(input, i, containerType, parentType)) {
          inString = false;
          stringIsKey = false;
          updateObjectKeyState(contextStack, false);
          output += char;
        } else {
          output += '\\"';
        }
        continue;
      }
      if (char === '\n') {
        output += '\\n';
        continue;
      }
      if (char === '\r') {
        output += '\\r';
        continue;
      }
      const code = char.charCodeAt(0);
      if (Number.isFinite(code) && code >= 0 && code <= 0x1f) {
        output += `\\u${code.toString(16).padStart(4, '0')}`;
        continue;
      }
      output += char;
      continue;
    }
    if (char === '"') {
      inString = true;
      escaping = false;
      stringIsKey = isExpectingKey(contextStack);
      output += char;
      continue;
    }
    if (char === '{') {
      contextStack.push({ type: 'object', expectingKey: true });
      output += char;
      continue;
    }
    if (char === '[') {
      contextStack.push({ type: 'array' });
      output += char;
      continue;
    }
    if (char === '}' || char === ']') {
      contextStack.pop();
      output += char;
      continue;
    }
    if (char === ':') {
      updateObjectKeyState(contextStack, false);
      output += char;
      continue;
    }
    if (char === ',') {
      updateObjectKeyState(contextStack, true);
      output += char;
      continue;
    }
    output += char;
  }
  if (escaping) {
    output += '\\\\';
  }
  if (inString) {
    output += '"';
  }
  return output;
}

function isValidJsonEscape(char) {
  if (!char) {
    return false;
  }
  if ('"\\/bfnrt'.includes(char)) {
    return true;
  }
  if (char === 'u') {
    return true;
  }
  return false;
}

function isExpectingKey(stack) {
  if (!stack || stack.length === 0) {
    return false;
  }
  const top = stack[stack.length - 1];
  return Boolean(top && top.type === 'object' && top.expectingKey);
}

function updateObjectKeyState(stack, expecting) {
  if (!stack || stack.length === 0) {
    return;
  }
  const top = stack[stack.length - 1];
  if (top && top.type === 'object') {
    top.expectingKey = Boolean(expecting);
  }
}

function looksLikeValueTerminator(source, index, containerType, parentType) {
  let cursor = index + 1;
  while (cursor < source.length && isWhitespace(source[cursor])) {
    cursor += 1;
  }
  if (cursor >= source.length) {
    return true;
  }
  const next = source[cursor];
  if (next === '}' || next === ']') {
    if (containerType === 'object' && next !== '}') {
      return false;
    }
    if (containerType === 'array' && next !== ']') {
      return false;
    }
    const followingIndex = findNextNonWhitespaceIndex(source, cursor + 1);
    if (followingIndex === null) {
      return true;
    }
    if (!parentType) {
      return false;
    }
    const following = source[followingIndex];
    if (following === ',') {
      const tokenIndex = findNextNonWhitespaceIndex(source, followingIndex + 1);
      if (tokenIndex === null) {
        return true;
      }
      const token = source[tokenIndex];
      if (parentType === 'object') {
        if (token === '}') {
          return true;
        }
        if (token === '"') {
          return looksLikeObjectKey(source, tokenIndex);
        }
        return false;
      }
      if (parentType === 'array') {
        return (
          token === '"' ||
          token === '{' ||
          token === '[' ||
          token === ']' ||
          token === '-' ||
          token === 't' ||
          token === 'f' ||
          token === 'n' ||
          isDigit(token)
        );
      }
      return false;
    }
    if (parentType === 'object') {
      return following === '}';
    }
    if (parentType === 'array') {
      return following === ']';
    }
    return false;
  }
  if (next !== ',') {
    return false;
  }
  const tokenIndex = findNextNonWhitespaceIndex(source, cursor + 1);
  if (tokenIndex === null) {
    return true;
  }
  const token = source[tokenIndex];
  if (containerType === 'object') {
    if (token === '}') {
      return true;
    }
    if (token === '"') {
      return looksLikeObjectKey(source, tokenIndex);
    }
    return false;
  }
  if (containerType === 'array' || containerType === null || containerType === undefined) {
    if (
      token === '"' ||
      token === '{' ||
      token === '[' ||
      token === ']' ||
      token === '-' ||
      token === 't' ||
      token === 'f' ||
      token === 'n' ||
      isDigit(token)
    ) {
      return true;
    }
  }
  return false;
}

function findNextNonWhitespaceIndex(source, startIndex) {
  let cursor = startIndex;
  while (cursor < source.length && isWhitespace(source[cursor])) {
    cursor += 1;
  }
  if (cursor >= source.length) {
    return null;
  }
  return cursor;
}

function looksLikeObjectKey(source, startIndex) {
  if (source[startIndex] !== '"') {
    return false;
  }
  let cursor = startIndex + 1;
  let escaping = false;
  while (cursor < source.length) {
    const char = source[cursor];
    if (escaping) {
      escaping = false;
      cursor += 1;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      cursor += 1;
      continue;
    }
    if (char === '\n' || char === '\r') {
      return false;
    }
    if (char === '"') {
      cursor += 1;
      const colonIndex = findNextNonWhitespaceIndex(source, cursor);
      return colonIndex !== null && source[colonIndex] === ':';
    }
    cursor += 1;
  }
  return false;
}

function findNextNonWhitespace(source, startIndex) {
  let cursor = startIndex;
  while (cursor < source.length && isWhitespace(source[cursor])) {
    cursor += 1;
  }
  if (cursor >= source.length) {
    return null;
  }
  return source[cursor];
}

function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isDigit(char) {
  return char >= '0' && char <= '9';
}

function logToolArgumentParseFailure(stage, toolName, argsRaw, error) {
  try {
    const snippetLimit = 400;
    const snippet = argsRaw.length > snippetLimit ? `${argsRaw.slice(0, snippetLimit - 3)}...` : argsRaw;
    const singleLine = snippet.replace(/\r?\n/g, '\\n');
    const base64Limit = 20000;
    const base64 = Buffer.from(argsRaw, 'utf8').toString('base64');
    const base64Preview = base64.length > base64Limit ? `${base64.slice(0, base64Limit)}...` : base64;
    console.error(
      `[tool-args:${stage}] Failed to parse arguments for ${toolName}: ${
        error?.message || error
      }. Snippet="${singleLine}" Base64Preview=${base64Preview}`
    );
  } catch {
    // ignore logging errors
  }
}

function formatToolResultText(result) {
  if (typeof result === 'string') {
    return result;
  }
  if (result === null || result === undefined) {
    return '';
  }
  if (typeof result === 'object') {
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }
  return String(result);
}

function sanitizeToolResultForSession(text, { tool } = {}) {
  const raw = typeof text === 'string' ? text : text == null ? '' : String(text);
  const stripped = stripAnsi(raw);
  const normalized = stripControlChars(stripped);
  const limit = getToolResultCharLimit();
  if (!(limit > 0) || normalized.length <= limit) {
    return normalized;
  }
  const headSize = Math.max(0, Math.floor(limit * 0.7));
  const tailSize = Math.max(0, limit - headSize);
  const omitted = normalized.length - limit;
  const head = normalized.slice(0, headSize);
  const tail = tailSize > 0 ? normalized.slice(normalized.length - tailSize) : '';
  const toolLabel = typeof tool === 'string' && tool.trim() ? tool.trim() : 'tool';
  return [
    head,
    '',
    `... (truncated ${omitted} chars from ${toolLabel} output; set MODEL_CLI_MAX_TOOL_RESULT_CHARS to increase) ...`,
    '',
    tail,
  ].join('\n');
}

function getToolResultCharLimit() {
  const raw = process.env.MODEL_CLI_MAX_TOOL_RESULT_CHARS;
  if (raw === undefined || raw === null) {
    return 120_000;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) {
    return 120_000;
  }
  if (normalized === '0' || normalized === 'off' || normalized === 'false') {
    return 0;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return 120_000;
  }
  return Math.floor(value);
}

function stripAnsi(input) {
  const text = typeof input === 'string' ? input : input == null ? '' : String(input);
  // CSI (Control Sequence Introducer) + OSC (Operating System Command)
  return text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '');
}

function stripControlChars(input) {
  const text = typeof input === 'string' ? input : input == null ? '' : String(input);
  // Keep newlines/tabs/carriage returns; drop other ASCII control chars (incl. NUL).
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function maybeAttachSessionIdForTaskTool(toolName, args, session) {
  if (!toolName || !toolName.includes('task_manager')) {
    return args;
  }
  const payload = { ...(args || {}) };
  const runId = typeof process.env.MODEL_CLI_RUN_ID === 'string' ? process.env.MODEL_CLI_RUN_ID.trim() : '';
  const sessionId = session?.sessionId;
  const match = typeof toolName === 'string' ? toolName.match(/task_manager_(.+)$/) : null;
  const action = (match && match[1]) || '';

  if (runId) {
    if (Array.isArray(payload.tasks) && payload.tasks.length > 0) {
      payload.tasks = payload.tasks.map((task) => ({
        ...(task || {}),
        runId: task?.runId || runId,
      }));
    } else if (!payload.runId) {
      payload.runId = runId;
    }
  }

  if (!sessionId) return payload;

  if (action === 'add_task') {
    if (Array.isArray(payload.tasks) && payload.tasks.length > 0) {
      payload.tasks = payload.tasks.map((task) => ({
        ...(task || {}),
        runId: task?.runId || runId,
        sessionId: task?.sessionId || sessionId,
      }));
    } else if (!payload.sessionId) {
      payload.sessionId = sessionId;
    }
  } else if (action === 'list_tasks') {
    if (!payload.allSessions && !payload.sessionId) {
      payload.sessionId = sessionId;
    }
  } else {
    if (!payload.allSessions && !payload.sessionId) {
      payload.sessionId = sessionId;
    }
  }

  return payload;
}

function ensureTaskAddPayload(toolName, args, session) {
  if (!toolName || !toolName.includes('task_manager_add_task')) {
    return args;
  }
  const payload = { ...(args || {}) };
  if (Array.isArray(payload.tasks)) {
    const nonEmptyTasks = payload.tasks.filter(Boolean);
    if (nonEmptyTasks.length === 0) {
      delete payload.tasks;
    } else {
      const fallbackTitle = buildFallbackTaskTitle(session);
      payload.tasks = nonEmptyTasks.map((task) => normalizeTaskEntry(task, fallbackTitle));
      return payload;
    }
  }
  if (!payload.title) {
    payload.title = buildFallbackTaskTitle(session);
  }
  return payload;
}

function buildFallbackTaskTitle(session) {
  const raw =
    typeof session?.getLastUserMessage === 'function' ? session.getLastUserMessage() : '';
  const normalized = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!normalized) {
    return 'New task';
  }
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function normalizeTaskEntry(task, fallbackTitle) {
  if (!task || typeof task !== 'object') {
    return { title: fallbackTitle };
  }
  if (task.title && String(task.title).trim()) {
    return task;
  }
  return { ...task, title: fallbackTitle };
}

export const _internal = {
  parseToolArguments,
  repairJsonString,
};

function normalizeToolCallId(id) {
  if (typeof id === 'string') {
    return id.trim();
  }
  if (id === undefined || id === null) {
    return '';
  }
  return String(id).trim();
}

function generateToolCallId() {
  const suffix =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
  return `call_${suffix}`;
}

function normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  for (const call of toolCalls) {
    if (!call || typeof call !== 'object') {
      continue;
    }
    const next = { ...call };
    let id = normalizeToolCallId(next.id);
    if (!id) {
      id = generateToolCallId();
    }
    while (seen.has(id)) {
      id = generateToolCallId();
    }
    seen.add(id);
    next.id = id;
    if (!next.type) {
      next.type = 'function';
    }
    const fn =
      next.function && typeof next.function === 'object'
        ? { ...next.function }
        : { name: '', arguments: '' };
    if (fn.name !== undefined && fn.name !== null) {
      fn.name = typeof fn.name === 'string' ? fn.name : String(fn.name);
    } else {
      fn.name = '';
    }
    if (fn.arguments === undefined || fn.arguments === null) {
      fn.arguments = '';
    } else if (typeof fn.arguments !== 'string') {
      try {
        fn.arguments = JSON.stringify(fn.arguments);
      } catch {
        fn.arguments = String(fn.arguments);
      }
    }
    next.function = fn;
    normalized.push(next);
  }
  return normalized;
}
