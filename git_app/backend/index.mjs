import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

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

async function runCommandCapture(
  cmd,
  args,
  { cwd = null, stdoutEncoding = 'utf8', stderrEncoding = 'utf8', timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES } = {}
) {
  const out = {
    ok: true,
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
      cwd: cwd || undefined,
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

function parseGitStatus(raw) {
  const text = String(raw || '');
  const lines = text.split(/\r?\n/).filter(line => line.trim());

  const result = {
    branch: '',
    staged: [],
    modified: [],
    untracked: [],
    deleted: [],
    renamed: []
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Branch info: ## master...origin/master
      const branchPart = line.substring(3);
      const branch = branchPart.split('...')[0].split(' ')[0];
      result.branch = branch;
      continue;
    }

    if (line.length >= 3) {
      const statusCode = line.substring(0, 2);
      const filePath = line.substring(3);

      const stagedStatus = statusCode[0];
      const worktreeStatus = statusCode[1];

      // Staged files
      if (stagedStatus !== ' ' && stagedStatus !== '?') {
        if (stagedStatus === 'M') result.staged.push(filePath);
        else if (stagedStatus === 'A') result.staged.push(filePath);
        else if (stagedStatus === 'D') result.staged.push(filePath);
        else if (stagedStatus === 'R') result.staged.push(filePath);
      }

      // Worktree files
      if (worktreeStatus !== ' ') {
        if (worktreeStatus === 'M') result.modified.push(filePath);
        else if (worktreeStatus === 'D') result.deleted.push(filePath);
        else if (worktreeStatus === '??') result.untracked.push(filePath);
        else if (worktreeStatus === 'R') result.renamed.push(filePath);
      }
    }
  }

  return result;
}

function parseGitBranch(raw) {
  const text = String(raw || '');
  const lines = text.split(/\r?\n/).filter(line => line.trim());

  const branches = [];
  for (const line of lines) {
    const isCurrent = line.startsWith('*');
    const branchName = (isCurrent ? line.substring(1) : line).trim();
    if (branchName) {
      branches.push({
        name: branchName,
        current: isCurrent
      });
    }
  }

  return branches;
}

export async function createUiAppsBackend(_ctx) {
  const configStore = new Map();

  const loadConfig = () => {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.git_manager_config.json');
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);
        return config || {};
      }
    } catch (err) {
      // Ignore config read errors
    }
    return {};
  };

  const saveConfig = (config) => {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.git_manager_config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (err) {
      // Ignore config write errors
    }
  };

  return {
    methods: {
      async ping(params) {
        return { ok: true, params: params ?? null };
      },

      async 'git.checkInstalled'() {
        try {
          const res = await runCommandCapture('git', ['--version'], { timeoutMs: 3_000, maxOutputBytes: 128 * 1024 });
          return {
            ok: true,
            installed: true,
            version: res.stdout.trim() || '',
          };
        } catch (err) {
          if (err && typeof err === 'object' && err.code === 'ENOENT') {
            return { ok: false, installed: false, message: 'git command not found' };
          }
          return { ok: false, installed: false, message: err?.message || String(err) };
        }
      },

      async 'git.getConfig'() {
        const config = loadConfig();
        return {
          ok: true,
          config,
        };
      },

      async 'git.setConfig'(params) {
        const config = params?.config || {};
        saveConfig(config);
        return {
          ok: true,
          config,
        };
      },

      async 'git.listRepos'() {
        const config = loadConfig();
        const repos = config.repos || [];
        return {
          ok: true,
          repos: repos.map(repo => ({
            name: repo.name,
            path: repo.path,
            platform: repo.platform || 'github',
            authType: repo.authType || 'none'
          }))
        };
      },

      async 'git.addRepo'(params) {
        const name = normalizeOptionalString(params?.name);
        const repoPath = normalizeOptionalString(params?.path);
        const platform = normalizeOptionalString(params?.platform) || 'github';
        const authType = normalizeOptionalString(params?.authType) || 'none';

        if (!name || !repoPath) {
          return { ok: false, message: 'name and path are required' };
        }

        const config = loadConfig();
        config.repos = config.repos || [];
        
        // Check if repo already exists
        const existingIndex = config.repos.findIndex(r => r.name === name);
        if (existingIndex >= 0) {
          return { ok: false, message: `Repository '${name}' already exists` };
        }

        config.repos.push({ name, path: repoPath, platform, authType });
        saveConfig(config);

        return { ok: true, repos: config.repos };
      },

      async 'git.removeRepo'(params) {
        const name = normalizeOptionalString(params?.name);
        if (!name) {
          return { ok: false, message: 'name is required' };
        }

        const config = loadConfig();
        config.repos = config.repos || [];
        
        const index = config.repos.findIndex(r => r.name === name);
        if (index < 0) {
          return { ok: false, message: `Repository '${name}' not found` };
        }

        config.repos.splice(index, 1);
        saveConfig(config);

        return { ok: true, repos: config.repos };
      },

      async 'git.status'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        if (!repoPath) {
          return { ok: false, message: 'path is required' };
        }

        try {
          const res = await runCommandCapture('git', ['status', '--porcelain', '--branch'], {
            cwd: repoPath,
            timeoutMs: 10_000,
            maxOutputBytes: 512 * 1024
          });

          const status = parseGitStatus(res.stdout);
          return {
            ok: true,
            exitCode: res.exitCode,
            status,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },

      async 'git.clone'(params) {
        const url = normalizeString(params?.url);
        const targetPath = normalizeOptionalString(params?.path);
        const branch = normalizeOptionalString(params?.branch);

        if (!url) {
          return { ok: false, message: 'url is required' };
        }

        const args = ['clone', '--progress'];
        if (branch) {
          args.push('--branch', branch);
        }
        args.push(url);
        if (targetPath) {
          args.push(targetPath);
        }

        try {
          const cwd = targetPath ? path.dirname(targetPath) : undefined;
          const res = await runCommandCapture('git', args, {
            cwd,
            timeoutMs: 300_000,
            maxOutputBytes: 50 * 1024 * 1024
          });

          return {
            ok: true,
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },

      async 'git.init'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        if (!repoPath) {
          return { ok: false, message: 'path is required' };
        }

        try {
          const res = await runCommandCapture('git', ['init'], {
            cwd: repoPath,
            timeoutMs: 10_000,
            maxOutputBytes: 128 * 1024
          });

          return {
            ok: true,
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },

      async 'git.commit'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        const message = normalizeString(params?.message);
        const files = params?.files || [];

        if (!repoPath) {
          return { ok: false, message: 'path is required' };
        }

        try {
          let res;

          // Add files if specified
          if (files.length > 0) {
            const args = ['add'];
            args.push(...files);
            res = await runCommandCapture('git', args, {
              cwd: repoPath,
              timeoutMs: 30_000,
              maxOutputBytes: 512 * 1024
            });
          } else {
            // Add all changes
            res = await runCommandCapture('git', ['add', '.'], {
              cwd: repoPath,
              timeoutMs: 30_000,
              maxOutputBytes: 512 * 1024
            });
          }

          // Commit
          res = await runCommandCapture('git', ['commit', '-m', message], {
            cwd: repoPath,
            timeoutMs: 30_000,
            maxOutputBytes: 512 * 1024
          });

          return {
            ok: true,
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },

      async 'git.push'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        const remote = normalizeOptionalString(params?.remote) || 'origin';
        const branch = normalizeOptionalString(params?.branch);
        const force = params?.force || false;

        if (!repoPath) {
          return { ok: false, message: 'path is required' };
        }

        const args = ['push'];
        if (force) {
          args.push('--force');
        }
        args.push(remote);
        if (branch) {
          args.push(branch);
        }

        try {
          const res = await runCommandCapture('git', args, {
            cwd: repoPath,
            timeoutMs: 300_000,
            maxOutputBytes: 50 * 1024 * 1024
          });

          return {
            ok: true,
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },

      async 'git.pull'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        const remote = normalizeOptionalString(params?.remote) || 'origin';
        const branch = normalizeOptionalString(params?.branch);
        const rebase = params?.rebase || false;

        if (!repoPath) {
          return { ok: false, message: 'path is required' };
        }

        const args = ['pull'];
        if (rebase) {
          args.push('--rebase');
        }
        args.push(remote);
        if (branch) {
          args.push(branch);
        }

        try {
          const res = await runCommandCapture('git', args, {
            cwd: repoPath,
            timeoutMs: 300_000,
            maxOutputBytes: 50 * 1024 * 1024
          });

          return {
            ok: true,
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },

      async 'git.branch'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        const name = normalizeOptionalString(params?.name);
        const list = params?.list !== false; // default true

        if (!repoPath) {
          return { ok: false, message: 'path is required' };
        }

        if (list) {
          try {
            const res = await runCommandCapture('git', ['branch', '-a'], {
              cwd: repoPath,
              timeoutMs: 10_000,
              maxOutputBytes: 512 * 1024
            });

            const branches = parseGitBranch(res.stdout);
            return {
              ok: true,
              exitCode: res.exitCode,
              branches,
              stderr: res.stderr || '',
            };
          } catch (err) {
            return {
              ok: false,
              message: err?.message || String(err),
            };
          }
        } else if (name) {
          // Create new branch
          try {
            const res = await runCommandCapture('git', ['branch', name], {
              cwd: repoPath,
              timeoutMs: 10_000,
              maxOutputBytes: 128 * 1024
            });

            return {
              ok: true,
              exitCode: res.exitCode,
              stdout: res.stdout,
              stderr: res.stderr || '',
            };
          } catch (err) {
            return {
              ok: false,
              message: err?.message || String(err),
            };
          }
        } else {
          return { ok: false, message: 'name is required to create branch' };
        }
      },

      async 'git.checkout'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        const branch = normalizeOptionalString(params?.branch);
        const createNew = params?.createNew || false;

        if (!repoPath || !branch) {
          return { ok: false, message: 'path and branch are required' };
        }

        const args = ['checkout'];
        if (createNew) {
          args.push('-b');
        }
        args.push(branch);

        try {
          const res = await runCommandCapture('git', args, {
            cwd: repoPath,
            timeoutMs: 30_000,
            maxOutputBytes: 512 * 1024
          });

          return {
            ok: true,
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },

      async 'git.fetch'(params) {
        const repoPath = normalizeOptionalString(params?.path);
        const remote = normalizeOptionalString(params?.remote) || 'all';

        if (!repoPath) {
          return { ok: false, message: 'path is required' };
        }

        try {
          const res = await runCommandCapture('git', ['fetch', remote], {
            cwd: repoPath,
            timeoutMs: 300_000,
            maxOutputBytes: 50 * 1024 * 1024
          });

          return {
            ok: true,
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr || '',
          };
        } catch (err) {
          return {
            ok: false,
            message: err?.message || String(err),
          };
        }
      },
    },

    async dispose() {
      // Cleanup if needed
    },
  };
}
