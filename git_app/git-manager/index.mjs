import { GIT_MANAGER_STYLES } from './styles.mjs';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isElement(node) {
  return node && typeof node === 'object' && typeof node.appendChild === 'function';
}

function setButtonEnabled(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
  btn.dataset.disabled = enabled ? '0' : '1';
}

export function mount({ container, host, slots }) {
  if (!container) throw new Error('container is required');
  if (!host || typeof host !== 'object') throw new Error('host is required');

  const ctx = typeof host?.context?.get === 'function' ? host.context.get() : { pluginId: '', appId: '', theme: 'light' };
  const bridgeEnabled = Boolean(ctx?.bridge?.enabled);

  const headerSlot = isElement(slots?.header) ? slots.header : null;

  const style = document.createElement('style');
  style.textContent = GIT_MANAGER_STYLES;

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '12px';

  const headerLeft = document.createElement('div');
  headerLeft.style.display = 'flex';
  headerLeft.style.flexDirection = 'column';
  headerLeft.style.gap = '2px';

  const title = document.createElement('div');
  title.className = 'git-tools-title';
  title.textContent = 'Git Manager';

  const meta = document.createElement('div');
  meta.className = 'git-tools-meta';
  meta.textContent = `${ctx?.pluginId || ''}:${ctx?.appId || ''} · bridge=${bridgeEnabled ? 'enabled' : 'disabled'}`;

  headerLeft.appendChild(title);
  headerLeft.appendChild(meta);

  const statusPill = document.createElement('div');
  statusPill.className = 'git-tools-pill';
  statusPill.dataset.tone = 'bad';
  statusPill.textContent = 'Git: checking...';

  header.appendChild(headerLeft);
  header.appendChild(statusPill);

  const root = document.createElement('div');
  root.className = 'git-tools-root';
  root.appendChild(style);

  // Repository controls
  const repoSection = document.createElement('div');
  repoSection.className = 'git-tools-section';

  const repoTitle = document.createElement('div');
  repoTitle.className = 'git-tools-section-title';
  repoTitle.textContent = '仓库管理';

  const repoRow1 = document.createElement('div');
  repoRow1.className = 'git-tools-row-inline';

  const repoSelect = document.createElement('select');
  repoSelect.className = 'git-tools-select';
  repoSelect.title = '选择仓库';

  const btnRefreshRepos = document.createElement('button');
  btnRefreshRepos.type = 'button';
  btnRefreshRepos.className = 'git-tools-btn';
  btnRefreshRepos.textContent = '刷新列表';

  const btnAddRepo = document.createElement('button');
  btnAddRepo.type = 'button';
  btnAddRepo.className = 'git-tools-btn';
  btnAddRepo.textContent = '添加仓库';

  const btnRemoveRepo = document.createElement('button');
  btnRemoveRepo.type = 'button';
  btnRemoveRepo.className = 'git-tools-btn';
  btnRemoveRepo.dataset.variant = 'danger';
  btnRemoveRepo.textContent = '移除仓库';

  repoRow1.appendChild(repoSelect);
  repoRow1.appendChild(btnRefreshRepos);
  repoRow1.appendChild(btnAddRepo);
  repoRow1.appendChild(btnRemoveRepo);

  repoSection.appendChild(repoTitle);
  repoSection.appendChild(repoRow1);

  // Branch controls
  const branchRow = document.createElement('div');
  branchRow.className = 'git-tools-row-inline';

  const branchSelect = document.createElement('select');
  branchSelect.className = 'git-tools-select';
  branchSelect.title = '选择分支';

  const btnRefreshBranches = document.createElement('button');
  btnRefreshBranches.type = 'button';
  btnRefreshBranches.className = 'git-tools-btn';
  btnRefreshBranches.textContent = '刷新分支';

  const btnNewBranch = document.createElement('button');
  btnNewBranch.type = 'button';
  btnNewBranch.className = 'git-tools-btn';
  btnNewBranch.textContent = '新建分支';

  const btnCheckout = document.createElement('button');
  btnCheckout.type = 'button';
  btnCheckout.className = 'git-tools-btn';
  btnCheckout.textContent = '切换分支';

  const btnFetch = document.createElement('button');
  btnFetch.type = 'button';
  btnFetch.className = 'git-tools-btn';
  btnFetch.textContent = '获取';

  branchRow.appendChild(branchSelect);
  branchRow.appendChild(btnRefreshBranches);
  branchRow.appendChild(btnNewBranch);
  branchRow.appendChild(btnCheckout);
  branchRow.appendChild(btnFetch);

  // Git operations
  const opsRow = document.createElement('div');
  opsRow.className = 'git-tools-row-inline';

  const btnCommit = document.createElement('button');
  btnCommit.type = 'button';
  btnCommit.className = 'git-tools-btn';
  btnCommit.textContent = '提交';

  const btnPush = document.createElement('button');
  btnPush.type = 'button';
  btnPush.className = 'git-tools-btn';
  btnPush.textContent = '推送';

  const btnPull = document.createElement('button');
  btnPull.type = 'button';
  btnPull.className = 'git-tools-btn';
  btnPull.textContent = '拉取';

  const commitMessageInput = document.createElement('input');
  commitMessageInput.className = 'git-tools-input';
  commitMessageInput.type = 'text';
  commitMessageInput.placeholder = '提交信息';

  const btnStatus = document.createElement('button');
  btnStatus.type = 'button';
  btnStatus.className = 'git-tools-btn';
  btnStatus.textContent = '查看状态';

  opsRow.appendChild(commitMessageInput);
  opsRow.appendChild(btnStatus);
  opsRow.appendChild(btnCommit);
  opsRow.appendChild(btnPush);
  opsRow.appendChild(btnPull);

  root.appendChild(repoSection);
  root.appendChild(branchRow);
  root.appendChild(opsRow);

  // Terminal output
  const card = document.createElement('div');
  card.className = 'git-tools-card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'git-tools-card-header';

  const cardHeaderLeft = document.createElement('div');
  cardHeaderLeft.textContent = '终端输出';

  const cardHeaderRight = document.createElement('div');
  cardHeaderRight.className = 'git-tools-meta';
  cardHeaderRight.textContent = 'stdout / stderr';

  cardHeader.appendChild(cardHeaderLeft);
  cardHeader.appendChild(cardHeaderRight);

  const terminal = document.createElement('div');
  terminal.className = 'git-tools-terminal';

  card.appendChild(cardHeader);
  card.appendChild(terminal);

  root.appendChild(card);

  if (headerSlot) {
    try {
      headerSlot.textContent = '';
    } catch {
      // ignore
    }
    try {
      headerSlot.appendChild(header);
    } catch {
      root.insertBefore(header, root.firstChild);
    }
  } else {
    root.insertBefore(header, root.firstChild);
  }

  try {
    container.textContent = '';
  } catch {
    // ignore
  }
  container.appendChild(root);

  const appendOutput = (text, kind = 'stdout') => {
    const str = String(text ?? '');
    if (!str) return;
    const span = document.createElement('span');
    span.className = kind === 'stderr' ? 'git-tools-out-stderr' : 'git-tools-out-stdout';
    span.textContent = str;
    terminal.appendChild(span);
    terminal.scrollTop = terminal.scrollHeight;
  };

  const appendLine = (text, kind = 'stdout') => {
    appendOutput(`${String(text ?? '')}\n`, kind);
  };

  const setStatus = (text, tone) => {
    statusPill.textContent = String(text ?? '');
    if (tone) statusPill.dataset.tone = tone;
  };

  let installed = false;
  let repos = [];
  let branches = [];
  let selectedRepo = null;
  let disposed = false;

  const setControlsEnabled = (enabled) => {
    setButtonEnabled(btnRefreshRepos, enabled);
    setButtonEnabled(btnAddRepo, enabled);
    setButtonEnabled(btnRemoveRepo, enabled);
    setButtonEnabled(btnRefreshBranches, enabled);
    setButtonEnabled(btnNewBranch, enabled);
    setButtonEnabled(btnCheckout, enabled);
    setButtonEnabled(btnFetch, enabled);
    setButtonEnabled(btnCommit, enabled);
    setButtonEnabled(btnPush, enabled);
    setButtonEnabled(btnPull, enabled);
    setButtonEnabled(btnStatus, enabled);
    repoSelect.disabled = !enabled;
    branchSelect.disabled = !enabled;
    commitMessageInput.disabled = !enabled;
  };

  const ensureBridge = () => {
    if (!bridgeEnabled) throw new Error('Host bridge not available (backend.invoke disabled)');
  };

  const api = {
    async checkInstalled() {
      ensureBridge();
      return await host.backend.invoke('git.checkInstalled');
    },
    async listRepos() {
      ensureBridge();
      return await host.backend.invoke('git.listRepos');
    },
    async addRepo(params) {
      ensureBridge();
      return await host.backend.invoke('git.addRepo', params);
    },
    async removeRepo(params) {
      ensureBridge();
      return await host.backend.invoke('git.removeRepo', params);
    },
    async status(params) {
      ensureBridge();
      return await host.backend.invoke('git.status', params);
    },
    async commit(params) {
      ensureBridge();
      return await host.backend.invoke('git.commit', params);
    },
    async push(params) {
      ensureBridge();
      return await host.backend.invoke('git.push', params);
    },
    async pull(params) {
      ensureBridge();
      return await host.backend.invoke('git.pull', params);
    },
    async branch(params) {
      ensureBridge();
      return await host.backend.invoke('git.branch', params);
    },
    async checkout(params) {
      ensureBridge();
      return await host.backend.invoke('git.checkout', params);
    },
    async fetch(params) {
      ensureBridge();
      return await host.backend.invoke('git.fetch', params);
    },
  };

  const loadRepos = async () => {
    setButtonEnabled(btnRefreshRepos, false);
    try {
      const res = await api.listRepos();
      if (!res?.ok) {
        repos = [];
        repoSelect.innerHTML = '';
        setStatus(`Git: ${res?.message || 'list failed'}`, 'bad');
        return;
      }
      repos = Array.isArray(res?.repos) ? res.repos : [];
      repoSelect.innerHTML = '';
      if (repos.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '（未配置仓库）';
        repoSelect.appendChild(opt);
        return;
      }

      for (const repo of repos) {
        const opt = document.createElement('option');
        opt.value = repo.name;
        const platform = repo.platform || 'unknown';
        const auth = repo.authType || 'none';
        opt.textContent = `${repo.name} (${platform}/${auth})`;
        repoSelect.appendChild(opt);
      }

      repoSelect.value = repos[0]?.name || '';
      selectedRepo = repos[0] || null;
    } finally {
      setButtonEnabled(btnRefreshRepos, installed);
    }
  };

  const loadBranches = async () => {
    if (!selectedRepo) return;

    setButtonEnabled(btnRefreshBranches, false);
    try {
      const res = await api.branch({ path: selectedRepo.path, list: true });
      if (!res?.ok) {
        branches = [];
        branchSelect.innerHTML = '';
        return;
      }
      branches = Array.isArray(res?.branches) ? res.branches : [];
      branchSelect.innerHTML = '';

      for (const branch of branches) {
        const opt = document.createElement('option');
        opt.value = branch.name;
        const current = branch.current ? ' *' : '';
        opt.textContent = `${branch.name}${current}`;
        branchSelect.appendChild(opt);
      }

      if (selectedRepo.branch) {
        branchSelect.value = selectedRepo.branch;
      } else {
        const currentBranch = branches.find(b => b.current);
        if (currentBranch) {
          branchSelect.value = currentBranch.name;
        }
      }
    } finally {
      setButtonEnabled(btnRefreshBranches, installed);
    }
  };

  const boot = async () => {
    if (!bridgeEnabled) {
      installed = false;
      setControlsEnabled(false);
      setStatus('Git: bridge disabled (must run in ChatOS desktop UI)', 'bad');
      return;
    }

    setControlsEnabled(false);
    setStatus('Git: checking...', 'bad');

    try {
      const res = await api.checkInstalled();
      installed = Boolean(res?.installed);
      if (!installed) {
        setStatus(`Git: unavailable${res?.message ? ` (${res.message})` : ''}`, 'bad');
        setControlsEnabled(false);
        return;
      }
      setStatus('Git: available', 'ok');
      setControlsEnabled(true);
      await loadRepos();
    } catch (err) {
      installed = false;
      setControlsEnabled(false);
      setStatus(`Git: error (${err?.message || String(err)})`, 'bad');
    }
  };

  btnRefreshRepos.addEventListener('click', () => loadRepos());
  btnRefreshBranches.addEventListener('click', () => loadBranches());

  repoSelect.addEventListener('change', () => {
    const repoName = normalizeString(repoSelect.value);
    selectedRepo = repos.find(r => r.name === repoName) || null;
    if (selectedRepo) {
      loadBranches();
    }
  });

  btnAddRepo.addEventListener('click', () => {
    const name = prompt('仓库名称:');
    if (!name) return;

    const repoPath = prompt('仓库路径:');
    if (!repoPath) return;

    const platform = prompt('平台 (github/gitee):', 'github') || 'github';
    const authType = prompt('认证方式 (username/token/ssh):', 'token') || 'token';

    api.addRepo({ name, path: repoPath, platform, authType })
      .then(res => {
        if (res?.ok) {
          appendLine(`[添加仓库成功] ${name}`, 'stdout');
          loadRepos();
        } else {
          appendLine(`[添加仓库失败] ${res?.message || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[添加仓库错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnRemoveRepo.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    if (!confirm(`确定要移除仓库 "${selectedRepo.name}" 吗?`)) return;

    api.removeRepo({ name: selectedRepo.name })
      .then(res => {
        if (res?.ok) {
          appendLine(`[移除仓库成功] ${selectedRepo.name}`, 'stdout');
          selectedRepo = null;
          branches = [];
          branchSelect.innerHTML = '';
          loadRepos();
        } else {
          appendLine(`[移除仓库失败] ${res?.message || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[移除仓库错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnNewBranch.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    const branchName = prompt('新分支名称:');
    if (!branchName) return;

    api.branch({ path: selectedRepo.path, name: branchName, list: false })
      .then(res => {
        if (res?.ok) {
          appendLine(`[新建分支成功] ${branchName}`, 'stdout');
          loadBranches();
        } else {
          appendLine(`[新建分支失败] ${res?.message || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[新建分支错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnCheckout.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    const branchName = normalizeString(branchSelect.value);
    if (!branchName) {
      alert('请选择一个分支');
      return;
    }

    api.checkout({ path: selectedRepo.path, branch: branchName })
      .then(res => {
        if (res?.ok) {
          appendLine(`[切换分支成功] ${branchName}`, 'stdout');
          loadBranches();
        } else {
          appendLine(`[切换分支失败] ${res?.message || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[切换分支错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnFetch.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    appendLine(`[获取远程更新] ${selectedRepo.name}...`, 'stdout');

    api.fetch({ path: selectedRepo.path })
      .then(res => {
        if (res?.ok) {
          appendLine(`[获取成功] ${res.stdout || res.stderr}`, 'stdout');
          loadBranches();
        } else {
          appendLine(`[获取失败] ${res?.message || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[获取错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnStatus.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    api.status({ path: selectedRepo.path })
      .then(res => {
        if (res?.ok) {
          const status = res.status || {};
          appendLine(`[仓库状态] ${selectedRepo.name}`, 'stdout');
          appendLine(`  分支: ${status.branch || 'unknown'}`, 'stdout');
          if (status.staged?.length) {
            appendLine(`  已暂存: ${status.staged.join(', ')}`, 'stdout');
          }
          if (status.modified?.length) {
            appendLine(`  已修改: ${status.modified.join(', ')}`, 'stdout');
          }
          if (status.untracked?.length) {
            appendLine(`  未跟踪: ${status.untracked.join(', ')}`, 'stdout');
          }
          if (!status.staged?.length && !status.modified?.length && !status.untracked?.length) {
            appendLine('  工作区干净', 'stdout');
          }
        } else {
          appendLine(`[状态查询失败] ${res?.message || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[状态查询错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnCommit.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    const message = normalizeString(commitMessageInput.value);
    if (!message) {
      alert('请输入提交信息');
      return;
    }

    api.commit({ path: selectedRepo.path, message })
      .then(res => {
        if (res?.ok) {
          appendLine(`[提交成功] ${message}`, 'stdout');
          commitMessageInput.value = '';
        } else {
          appendLine(`[提交失败] ${res?.message || res.stderr || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[提交错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnPush.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    const branch = normalizeString(branchSelect.value);
    appendLine(`[推送到远程] ${selectedRepo.name} -> ${branch}...`, 'stdout');

    api.push({ path: selectedRepo.path, branch })
      .then(res => {
        if (res?.ok) {
          appendLine(`[推送成功] ${res.stdout || res.stderr}`, 'stdout');
        } else {
          appendLine(`[推送失败] ${res?.message || res.stderr || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[推送错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  btnPull.addEventListener('click', () => {
    if (!selectedRepo) {
      alert('请先选择一个仓库');
      return;
    }

    const branch = normalizeString(branchSelect.value);
    appendLine(`[从远程拉取] ${selectedRepo.name} <- ${branch}...`, 'stdout');

    api.pull({ path: selectedRepo.path, branch })
      .then(res => {
        if (res?.ok) {
          appendLine(`[拉取成功] ${res.stdout || res.stderr}`, 'stdout');
        } else {
          appendLine(`[拉取失败] ${res?.message || res.stderr || ''}`, 'stderr');
        }
      })
      .catch(err => {
        appendLine(`[拉取错误] ${err?.message || String(err)}`, 'stderr');
      });
  });

  appendLine('[Git Manager ready]', 'stdout');
  boot();

  return () => {
    disposed = true;
    try {
      container.textContent = '';
    } catch {
      // ignore
    }
    if (headerSlot) {
      try {
        headerSlot.textContent = '';
      } catch {
        // ignore
      }
    }
  };
}
