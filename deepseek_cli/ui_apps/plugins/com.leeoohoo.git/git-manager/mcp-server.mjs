import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn } from 'child_process';
import { z } from 'zod';

const server = new McpServer({
  name: 'com.leeoohoo.git.manager',
  version: '0.1.0',
});

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
    return {
      ok: false,
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

      if (stagedStatus !== ' ' && stagedStatus !== '?') {
        if (stagedStatus === 'M') result.staged.push(filePath);
        else if (stagedStatus === 'A') result.staged.push(filePath);
        else if (stagedStatus === 'D') result.staged.push(filePath);
        else if (stagedStatus === 'R') result.staged.push(filePath);
      }

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

server.registerTool(
  'status',
  {
    title: 'Git Status',
    description: 'Get the working directory status of a git repository.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to the git repository'),
    }),
  },
  async ({ path }) => {
    try {
      const res = await runCommandCapture('git', ['status', '--porcelain', '--branch'], {
        cwd: path,
        timeoutMs: 10_000,
        maxOutputBytes: 512 * 1024
      });

      const status = parseGitStatus(res.stdout);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                status,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'clone',
  {
    title: 'Clone Repository',
    description: 'Clone a git repository from a URL.',
    inputSchema: z.object({
      url: z.string().min(1).describe('Repository URL to clone'),
      path: z.string().optional().describe('Target directory path'),
      branch: z.string().optional().describe('Specific branch to clone'),
    }),
  },
  async ({ url, path: targetPath, branch }) => {
    const args = ['clone', '--progress'];
    if (branch) {
      args.push('--branch', branch);
    }
    args.push(url);
    if (targetPath) {
      args.push(targetPath);
    }

    try {
      const path = require('path');
      const cwd = targetPath ? path.dirname(targetPath) : undefined;
      const res = await runCommandCapture('git', args, {
        cwd,
        timeoutMs: 300_000,
        maxOutputBytes: 50 * 1024 * 1024
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                stdout: res.stdout,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'init',
  {
    title: 'Initialize Repository',
    description: 'Initialize a new git repository.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to initialize the repository'),
    }),
  },
  async ({ path }) => {
    try {
      const res = await runCommandCapture('git', ['init'], {
        cwd: path,
        timeoutMs: 10_000,
        maxOutputBytes: 128 * 1024
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                stdout: res.stdout,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'commit',
  {
    title: 'Commit Changes',
    description: 'Commit changes to the repository.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to the git repository'),
      message: z.string().min(1).describe('Commit message'),
      files: z.array(z.string()).optional().describe('Specific files to commit (default: all)'),
    }),
  },
  async ({ path, message, files = [] }) => {
    try {
      let res;

      if (files.length > 0) {
        const args = ['add'];
        args.push(...files);
        res = await runCommandCapture('git', args, {
          cwd: path,
          timeoutMs: 30_000,
          maxOutputBytes: 512 * 1024
        });
      } else {
        res = await runCommandCapture('git', ['add', '.'], {
          cwd: path,
          timeoutMs: 30_000,
          maxOutputBytes: 512 * 1024
        });
      }

      res = await runCommandCapture('git', ['commit', '-m', message], {
        cwd: path,
        timeoutMs: 30_000,
        maxOutputBytes: 512 * 1024
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                stdout: res.stdout,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'push',
  {
    title: 'Push Changes',
    description: 'Push changes to a remote repository.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to the git repository'),
      remote: z.string().optional().describe('Remote name (default: origin)'),
      branch: z.string().optional().describe('Branch name'),
      force: z.boolean().optional().describe('Force push'),
    }),
  },
  async ({ path, remote = 'origin', branch, force = false }) => {
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
        cwd: path,
        timeoutMs: 300_000,
        maxOutputBytes: 50 * 1024 * 1024
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                stdout: res.stdout,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'pull',
  {
    title: 'Pull Changes',
    description: 'Pull changes from a remote repository.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to the git repository'),
      remote: z.string().optional().describe('Remote name (default: origin)'),
      branch: z.string().optional().describe('Branch name'),
      rebase: z.boolean().optional().describe('Use rebase instead of merge'),
    }),
  },
  async ({ path, remote = 'origin', branch, rebase = false }) => {
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
        cwd: path,
        timeoutMs: 300_000,
        maxOutputBytes: 50 * 1024 * 1024
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                stdout: res.stdout,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'branch',
  {
    title: 'Branch Operations',
    description: 'List branches or create a new branch.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to the git repository'),
      name: z.string().optional().describe('New branch name (if not provided, lists branches)'),
      list: z.boolean().optional().describe('List branches (default: true)'),
    }),
  },
  async ({ path, name, list = true }) => {
    if (list) {
      try {
        const res = await runCommandCapture('git', ['branch', '-a'], {
          cwd: path,
          timeoutMs: 10_000,
          maxOutputBytes: 512 * 1024
        });

        const branches = parseGitBranch(res.stdout);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  exitCode: res.exitCode,
                  branches,
                  stderr: res.stderr || '',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: false,
                message: err?.message || String(err),
              }, null, 2),
            },
          ],
        };
      }
    } else if (name) {
      try {
        const res = await runCommandCapture('git', ['branch', name], {
          cwd: path,
          timeoutMs: 10_000,
          maxOutputBytes: 128 * 1024
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  exitCode: res.exitCode,
                  stdout: res.stdout,
                  stderr: res.stderr || '',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: false,
                message: err?.message || String(err),
              }, null, 2),
            },
          ],
        };
      }
    } else {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: 'name is required to create branch',
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'checkout',
  {
    title: 'Checkout Branch',
    description: 'Switch to a branch or create a new branch.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to the git repository'),
      branch: z.string().min(1).describe('Branch name'),
      createNew: z.boolean().optional().describe('Create new branch (-b flag)'),
    }),
  },
  async ({ path, branch, createNew = false }) => {
    const args = ['checkout'];
    if (createNew) {
      args.push('-b');
    }
    args.push(branch);

    try {
      const res = await runCommandCapture('git', args, {
        cwd: path,
        timeoutMs: 30_000,
        maxOutputBytes: 512 * 1024
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                stdout: res.stdout,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

server.registerTool(
  'fetch',
  {
    title: 'Fetch Updates',
    description: 'Fetch updates from remote repositories.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Path to the git repository'),
      remote: z.string().optional().describe('Remote name (default: all)'),
    }),
  },
  async ({ path, remote = 'all' }) => {
    try {
      const res = await runCommandCapture('git', ['fetch', remote], {
        cwd: path,
        timeoutMs: 300_000,
        maxOutputBytes: 50 * 1024 * 1024
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                ok: true,
                exitCode: res.exitCode,
                stdout: res.stdout,
                stderr: res.stderr || '',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              message: err?.message || String(err),
            }, null, 2),
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP server error:', error);
  process.exit(1);
});
