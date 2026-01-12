import crypto from 'crypto';
import { spawn } from 'child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const RUN_MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const RUN_TTL_MS = 10 * 60 * 1000;

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
    const error = err instanceof Error ? err : new Error(String(err));
    error.code = err?.code;
    throw error;
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const done = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    };

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
      fail(err);
    });

    child.once('close', (code, signal) => {
      out.exitCode = Number.isFinite(code) ? code : null;
      out.signal = signal ? String(signal) : null;
      out.stdout = decodeOutput(stdoutChunks, stdoutEncoding);
      out.stderr = decodeOutput(stderrChunks, stderrEncoding);
      done(out);
    });
  });
}

export async function createUiAppsBackend(_ctx) {
  const runs = new Map();

  const cleanupRuns = () => {
    const now = Date.now();
    for (const [id, run] of runs.entries()) {
      if (!run || typeof run !== 'object') {
        runs.delete(id);
        continue;
      }
      if (run.done !== true) continue;
      const lastAccessAt = Number.isFinite(run.lastAccessAt) ? run.lastAccessAt : run.updatedAt;
      if (!Number.isFinite(lastAccessAt)) continue;
      if (now - lastAccessAt > RUN_TTL_MS) {
        runs.delete(id);
      }
    }
  };

  const ensureWslAvailable = async () => {
    if (!isWindows()) {
      return { ok: false, installed: false, message: `WSL only works on Windows (platform=${process.platform})` };
    }
    try {
      await runCommandCapture(['--help'], { timeoutMs: 3_000, maxOutputBytes: 128 * 1024 });
      return { ok: true, installed: true };
    } catch (err) {
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        return { ok: false, installed: false, message: 'wsl.exe not found' };
      }
      // wsl.exe exists but may be not fully enabled/configured; treat as present.
      return { ok: true, installed: true };
    }
  };

  const startRun = async ({ distroName, command }) => {
    cleanupRuns();
    const available = await ensureWslAvailable();
    if (!available.ok) return available;

    const args = buildWslBashArgs({ distroName, command });
    const child = spawn(getWslExecutable(), args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const runId = crypto.randomUUID();
    const run = {
      id: runId,
      distroName: normalizeOptionalString(distroName),
      command: normalizeString(command),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessAt: Date.now(),
      done: false,
      exitCode: null,
      signal: null,
      error: '',
      truncated: false,
      outputBytes: 0,
      chunks: [],
      child,
    };
    runs.set(runId, run);

    const pushChunk = (kind, text) => {
      if (run.truncated) return;
      const str = String(text || '');
      if (!str) return;
      const bytes = Buffer.byteLength(str, 'utf8');
      if (run.outputBytes + bytes > RUN_MAX_OUTPUT_BYTES) {
        run.truncated = true;
        run.chunks.push({ kind: 'stderr', text: '\n[output truncated]\n' });
        try {
          child.kill();
        } catch {
          // ignore
        }
        return;
      }
      run.outputBytes += bytes;
      run.chunks.push({ kind, text: str });
      run.updatedAt = Date.now();
    };

    if (child.stdout) {
      child.stdout.on('data', (buf) => pushChunk('stdout', Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf)));
    }
    if (child.stderr) {
      child.stderr.on('data', (buf) => pushChunk('stderr', Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf)));
    }

    child.once('error', (err) => {
      run.error = err?.message || String(err);
      run.done = true;
      run.exitCode = null;
      run.signal = null;
      run.updatedAt = Date.now();
    });

    child.once('close', (code, signal) => {
      run.done = true;
      run.exitCode = Number.isFinite(code) ? code : null;
      run.signal = signal ? String(signal) : null;
      run.updatedAt = Date.now();
    });

    return { ok: true, installed: true, runId };
  };

  return {
    methods: {
      async ping(params) {
        return { ok: true, params: params ?? null };
      },

      async 'wsl.checkInstalled'() {
        const available = await ensureWslAvailable();
        return {
          ok: true,
          installed: Boolean(available.installed),
          platform: process.platform,
          message: available.ok ? '' : available.message || '',
        };
      },

      async 'wsl.listDistributions'() {
        const available = await ensureWslAvailable();
        if (!available.ok) return available;

        let res = null;
        try {
          res = await runCommandCapture(['--list', '--verbose'], {
            stdoutEncoding: 'utf16le',
            stderrEncoding: 'utf16le',
            timeoutMs: 10_000,
            maxOutputBytes: 512 * 1024,
          });
        } catch (err) {
          if (err && typeof err === 'object' && err.code === 'ENOENT') {
            return { ok: false, installed: false, message: 'wsl.exe not found' };
          }
          return { ok: false, installed: true, message: err?.message || String(err) };
        }

        const distros = parseWslListVerbose(res.stdout);
        return {
          ok: true,
          installed: true,
          distros,
          exitCode: res.exitCode,
          truncated: res.truncated === true,
          stderr: res.stderr || '',
        };
      },

      async 'wsl.exec'(params) {
        const available = await ensureWslAvailable();
        if (!available.ok) return available;

        const distroName = normalizeOptionalString(params?.distroName);
        const command = normalizeString(params?.command);
        if (!command) return { ok: false, installed: true, message: 'command is required' };

        const timeoutMs = clampNumber(params?.timeoutMs, { min: 1_000, max: 10 * 60_000, fallback: DEFAULT_TIMEOUT_MS });
        const maxOutputBytes = clampNumber(params?.maxOutputBytes, { min: 16 * 1024, max: 50 * 1024 * 1024, fallback: DEFAULT_MAX_OUTPUT_BYTES });

        let res = null;
        try {
          res = await runCommandCapture(buildWslBashArgs({ distroName, command }), { timeoutMs, maxOutputBytes });
        } catch (err) {
          if (err && typeof err === 'object' && err.code === 'ENOENT') {
            return { ok: false, installed: false, message: 'wsl.exe not found' };
          }
          return { ok: false, installed: true, message: err?.message || String(err) };
        }

        return {
          ok: true,
          installed: true,
          distroName,
          command,
          exitCode: res.exitCode,
          signal: res.signal,
          timedOut: res.timedOut,
          truncated: res.truncated === true,
          stdout: res.stdout,
          stderr: res.stderr,
        };
      },

      async 'wsl.start'(params) {
        const distroName = normalizeOptionalString(params?.distroName);
        const command = normalizeString(params?.command);
        if (!command) return { ok: false, installed: isWindows(), message: 'command is required' };
        try {
          return await startRun({ distroName, command });
        } catch (err) {
          return { ok: false, installed: isWindows(), message: err?.message || String(err) };
        }
      },

      async 'wsl.poll'(params) {
        cleanupRuns();

        const runId = normalizeString(params?.runId);
        if (!runId) return { ok: false, message: 'runId is required' };

        const run = runs.get(runId);
        if (!run) return { ok: false, message: 'run not found' };

        run.lastAccessAt = Date.now();

        const cursor = clampNumber(params?.cursor, { min: 0, max: run.chunks.length, fallback: 0 });
        const items = run.chunks.slice(cursor);
        const nextCursor = cursor + items.length;

        return {
          ok: true,
          runId,
          items,
          nextCursor,
          done: run.done === true,
          exitCode: run.exitCode,
          signal: run.signal,
          error: run.error || '',
          truncated: run.truncated === true,
        };
      },

      async 'wsl.kill'(params) {
        cleanupRuns();

        const runId = normalizeString(params?.runId);
        if (!runId) return { ok: false, message: 'runId is required' };

        const run = runs.get(runId);
        if (!run) return { ok: false, message: 'run not found' };

        const child = run.child;
        if (!child) return { ok: false, message: 'process not available' };

        try {
          child.kill();
        } catch (err) {
          return { ok: false, message: err?.message || String(err) };
        }
        return { ok: true };
      },
    },

    async dispose() {
      for (const run of runs.values()) {
        try {
          run?.child?.kill?.();
        } catch {
          // ignore
        }
      }
      runs.clear();
    },
  };
}
