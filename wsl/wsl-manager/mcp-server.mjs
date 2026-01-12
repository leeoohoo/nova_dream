import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn } from 'child_process';
import { z } from 'zod';

const server = new McpServer({
  name: 'com.leeoohoo.wsl.manager',
  version: '0.1.0',
});

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

function isWindows() {
  return process.platform === 'win32';
}

function getWslExecutable() {
  return isWindows() ? 'wsl.exe' : 'wsl';
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value) {
  const out = normalizeString(value);
  return out ? out : '';
}

function clampNumber(value, { min, max, fallback }) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (Number.isFinite(min) && num < min) return min;
  if (Number.isFinite(max) && num > max) return max;
  return num;
}

function decodeOutput(buffers, encoding) {
  if (!buffers || buffers.length === 0) return '';
  const buf = Buffer.concat(buffers);
  const text = buf.toString(encoding);
  return String(text || '').replace(/\0/g, '');
}

function parseWslListVerbose(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  const lines = text
    .split(/\r?\n/)
    .map((line) => String(line || '').replace(/\0/g, '').trimEnd())
    .filter((line) => line.trim());

  if (lines.length === 0) return [];

  const maybeHeader = lines[0].trim();
  const startIndex = /name\s+state\s+version/i.test(maybeHeader) ? 1 : 0;

  const distros = [];
  for (const line of lines.slice(startIndex)) {
    const trimmed = line.trimStart();
    const isDefault = trimmed.startsWith('*');
    const body = (isDefault ? trimmed.slice(1) : trimmed).trim();
    if (!body) continue;

    const tokens = body.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) continue;
    const version = tokens.pop();
    const state = tokens.pop();
    const name = tokens.join(' ');
    if (!name) continue;

    distros.push({
      name,
      state,
      version,
      isDefault,
    });
  }
  return distros;
}

function buildWslBashArgs({ distroName, command }) {
  const distro = normalizeOptionalString(distroName);
  const cmd = normalizeString(command);
  if (!cmd) throw new Error('command is required');

  const args = [];
  if (distro) args.push('-d', distro);
  args.push('--', 'bash', '-lc', cmd);
  return args;
}

async function runCommandCapture(
  args,
  { stdoutEncoding = 'utf8', stderrEncoding = 'utf8', timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES } = {}
) {
  const cmd = getWslExecutable();
  const out = {
    ok: true,
    platform: process.platform,
    installed: true,
    exitCode: null,
    signal: null,
    stdout: '',
    stderr: '',
    timedOut: false,
    truncated: false,
  };

  const stdoutChunks = [];
  const stderrChunks = [];
  let totalBytes = 0;

  let child = null;
  try {
    child = spawn(cmd, Array.isArray(args) ? args : [], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return {
      ok: false,
      platform: process.platform,
      installed: false,
      message: err?.message || String(err),
    };
  }

  return await new Promise((resolve) => {
    let timer = null;

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        out.timedOut = true;
        try {
          child.kill();
        } catch {
          // ignore
        }
      }, timeoutMs);
    }

    const onChunk = (target) => (buf) => {
      if (!buf) return;
      const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf));
      totalBytes += b.byteLength;
      if (totalBytes > maxOutputBytes) {
        out.truncated = true;
        try {
          child.kill();
        } catch {
          // ignore
        }
        return;
      }
      target.push(b);
    };

    if (child.stdout) child.stdout.on('data', onChunk(stdoutChunks));
    if (child.stderr) child.stderr.on('data', onChunk(stderrChunks));

    child.once('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        ok: false,
        platform: process.platform,
        installed: err?.code !== 'ENOENT' ? true : false,
        message: err?.message || String(err),
        code: err?.code,
      });
    });

    child.once('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      out.exitCode = Number.isFinite(code) ? code : null;
      out.signal = signal ? String(signal) : null;
      out.stdout = decodeOutput(stdoutChunks, stdoutEncoding);
      out.stderr = decodeOutput(stderrChunks, stderrEncoding);
      resolve(out);
    });
  });
}

server.registerTool(
  'status',
  {
    title: 'WSL Status',
    description: 'Check whether WSL is available on this machine (Windows only).',
    inputSchema: z.object({}).optional(),
  },
  async () => {
    if (!isWindows()) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, platform: process.platform, installed: false, message: 'WSL only works on Windows' }, null, 2),
          },
        ],
      };
    }

    const res = await runCommandCapture(['--help'], { timeoutMs: 3_000, maxOutputBytes: 128 * 1024 });
    const installed = Boolean(res?.ok || res?.code !== 'ENOENT');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ok: true,
              platform: process.platform,
              installed,
              message: res?.ok ? '' : res?.message || '',
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  'list_distributions',
  {
    title: 'List WSL Distributions',
    description: 'List installed WSL distributions (similar to `wsl --list --verbose`).',
    inputSchema: z.object({}).optional(),
  },
  async () => {
    if (!isWindows()) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: false, platform: process.platform, installed: false, message: 'WSL only works on Windows' }, null, 2),
          },
        ],
      };
    }

    const res = await runCommandCapture(['--list', '--verbose'], {
      stdoutEncoding: 'utf16le',
      stderrEncoding: 'utf16le',
      timeoutMs: 10_000,
      maxOutputBytes: 512 * 1024,
    });

    if (!res?.ok) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    const distros = parseWslListVerbose(res.stdout);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ok: true, platform: process.platform, installed: true, distros, stderr: res.stderr || '' }, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  'exec',
  {
    title: 'Execute WSL Command',
    description: 'Execute a command inside WSL (runs via `bash -lc`).',
    inputSchema: z.object({
      command: z.string().min(1).describe('Command to execute inside WSL, e.g. `ls -la`'),
      distroName: z.string().optional().describe('Optional distribution name; defaults to the default distro'),
      timeoutMs: z.number().int().optional().describe('Timeout in milliseconds (default 30000)'),
      maxOutputBytes: z.number().int().optional().describe('Max stdout+stderr bytes before truncation (default 10MB)'),
    }),
  },
  async ({ command, distroName, timeoutMs, maxOutputBytes }) => {
    if (!isWindows()) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ok: false, platform: process.platform, installed: false, message: 'WSL only works on Windows' }, null, 2),
          },
        ],
      };
    }

    const timeout = clampNumber(timeoutMs, { min: 1_000, max: 10 * 60_000, fallback: DEFAULT_TIMEOUT_MS });
    const maxBytes = clampNumber(maxOutputBytes, { min: 16 * 1024, max: 50 * 1024 * 1024, fallback: DEFAULT_MAX_OUTPUT_BYTES });

    const res = await runCommandCapture(buildWslBashArgs({ distroName, command }), { timeoutMs: timeout, maxOutputBytes: maxBytes });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ...res,
              distroName: normalizeOptionalString(distroName),
              command: normalizeString(command),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('MCP server error:', error);
  process.exit(1);
});
