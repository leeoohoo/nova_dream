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
  style.textContent = `
    .wsl-tools-root {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      box-sizing: border-box;
    }
    .wsl-tools-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .wsl-tools-title {
      font-weight: 750;
      letter-spacing: 0.2px;
    }
    .wsl-tools-meta {
      font-size: 12px;
      opacity: 0.72;
    }
    .wsl-tools-pill {
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      white-space: nowrap;
      user-select: none;
    }
    .wsl-tools-pill[data-tone='ok'] {
      box-shadow: 0 0 0 3px rgba(46, 160, 67, 0.12);
    }
    .wsl-tools-pill[data-tone='bad'] {
      box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.12);
    }
    .wsl-tools-btn {
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      border-radius: 12px;
      padding: 8px 10px;
      cursor: pointer;
      font-weight: 650;
    }
    .wsl-tools-btn:hover {
      box-shadow: 0 0 0 3px var(--ds-focus-ring);
    }
    .wsl-tools-btn[data-variant='danger'] {
      border-color: rgba(248, 81, 73, 0.5);
    }
    .wsl-tools-btn[data-variant='danger']:hover {
      box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.24);
    }
    .wsl-tools-btn:disabled,
    .wsl-tools-btn[data-disabled='1'] {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none !important;
    }
    .wsl-tools-select,
    .wsl-tools-input {
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      color: inherit;
      border-radius: 12px;
      padding: 8px 10px;
      outline: none;
      min-width: 220px;
    }
    .wsl-tools-input {
      flex: 1;
      min-width: 320px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
    }
    .wsl-tools-card {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-panel-bg);
      border-radius: 14px;
      overflow: hidden;
    }
    .wsl-tools-card-header {
      padding: 10px 12px;
      border-bottom: 1px solid var(--ds-panel-border);
      font-size: 13px;
      font-weight: 650;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .wsl-tools-terminal {
      flex: 1;
      min-height: 0;
      padding: 12px;
      overflow: auto;
      background: var(--ds-code-bg);
      border-top: 1px solid var(--ds-code-border);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .wsl-tools-out-stdout { color: var(--ds-code-text); }
    .wsl-tools-out-stderr { color: #f85149; }
    :root[data-theme='dark'] .wsl-tools-out-stderr { color: #ff7b72; }
  `;

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
  title.className = 'wsl-tools-title';
  title.textContent = 'WSL Manager';

  const meta = document.createElement('div');
  meta.className = 'wsl-tools-meta';
  meta.textContent = `${ctx?.pluginId || ''}:${ctx?.appId || ''} · bridge=${bridgeEnabled ? 'enabled' : 'disabled'}`;

  headerLeft.appendChild(title);
  headerLeft.appendChild(meta);

  const statusPill = document.createElement('div');
  statusPill.className = 'wsl-tools-pill';
  statusPill.dataset.tone = 'bad';
  statusPill.textContent = 'WSL: checking...';

  header.appendChild(headerLeft);
  header.appendChild(statusPill);

  const root = document.createElement('div');
  root.className = 'wsl-tools-root';
  root.appendChild(style);

  const controls = document.createElement('div');
  controls.className = 'wsl-tools-row';

  const distroSelect = document.createElement('select');
  distroSelect.className = 'wsl-tools-select';
  distroSelect.title = '选择发行版';

  const btnRefresh = document.createElement('button');
  btnRefresh.type = 'button';
  btnRefresh.className = 'wsl-tools-btn';
  btnRefresh.textContent = '刷新发行版';

  const input = document.createElement('input');
  input.className = 'wsl-tools-input';
  input.type = 'text';
  input.placeholder = '输入命令，例如：ls -la';

  const btnRun = document.createElement('button');
  btnRun.type = 'button';
  btnRun.className = 'wsl-tools-btn';
  btnRun.textContent = '实时执行';

  const btnRunOnce = document.createElement('button');
  btnRunOnce.type = 'button';
  btnRunOnce.className = 'wsl-tools-btn';
  btnRunOnce.textContent = '一次性执行';

  const btnKill = document.createElement('button');
  btnKill.type = 'button';
  btnKill.className = 'wsl-tools-btn';
  btnKill.dataset.variant = 'danger';
  btnKill.textContent = '终止';

  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.className = 'wsl-tools-btn';
  btnClear.textContent = '清空输出';

  controls.appendChild(distroSelect);
  controls.appendChild(btnRefresh);
  controls.appendChild(input);
  controls.appendChild(btnRun);
  controls.appendChild(btnRunOnce);
  controls.appendChild(btnKill);
  controls.appendChild(btnClear);

  const card = document.createElement('div');
  card.className = 'wsl-tools-card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'wsl-tools-card-header';

  const cardHeaderLeft = document.createElement('div');
  cardHeaderLeft.textContent = '终端输出';

  const cardHeaderRight = document.createElement('div');
  cardHeaderRight.className = 'wsl-tools-meta';
  cardHeaderRight.textContent = 'stdout / stderr';

  cardHeader.appendChild(cardHeaderLeft);
  cardHeader.appendChild(cardHeaderRight);

  const terminal = document.createElement('div');
  terminal.className = 'wsl-tools-terminal';

  card.appendChild(cardHeader);
  card.appendChild(terminal);

  root.appendChild(controls);
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
    span.className = kind === 'stderr' ? 'wsl-tools-out-stderr' : 'wsl-tools-out-stdout';
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
  let distros = [];
  let activeRunId = '';
  let pollCursor = 0;
  let pollTimer = null;
  let disposed = false;

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const currentDistroName = () => {
    const selected = normalizeString(distroSelect.value);
    return selected;
  };

  const setControlsEnabled = (enabled) => {
    setButtonEnabled(btnRefresh, enabled);
    setButtonEnabled(btnRun, enabled);
    setButtonEnabled(btnRunOnce, enabled);
    setButtonEnabled(btnKill, enabled);
    distroSelect.disabled = !enabled;
    input.disabled = !enabled;
  };

  const ensureBridge = () => {
    if (!bridgeEnabled) throw new Error('Host bridge not available (backend.invoke disabled)');
  };

  const api = {
    async checkInstalled() {
      ensureBridge();
      return await host.backend.invoke('wsl.checkInstalled');
    },
    async listDistributions() {
      ensureBridge();
      return await host.backend.invoke('wsl.listDistributions');
    },
    async exec({ distroName, command }) {
      ensureBridge();
      return await host.backend.invoke('wsl.exec', { distroName, command });
    },
    async start({ distroName, command }) {
      ensureBridge();
      return await host.backend.invoke('wsl.start', { distroName, command });
    },
    async poll({ runId, cursor }) {
      ensureBridge();
      return await host.backend.invoke('wsl.poll', { runId, cursor });
    },
    async kill({ runId }) {
      ensureBridge();
      return await host.backend.invoke('wsl.kill', { runId });
    },
  };

  const loadDistros = async () => {
    setButtonEnabled(btnRefresh, false);
    try {
      const res = await api.listDistributions();
      if (!res?.ok) {
        distros = [];
        distroSelect.innerHTML = '';
        setStatus(`WSL: ${res?.message || 'list failed'}`, 'bad');
        return;
      }
      distros = Array.isArray(res?.distros) ? res.distros : [];
      distroSelect.innerHTML = '';
      if (distros.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '（未检测到发行版）';
        distroSelect.appendChild(opt);
        return;
      }

      let defaultName = '';
      for (const d of distros) {
        if (d?.isDefault) {
          defaultName = d?.name || '';
          break;
        }
      }

      for (const d of distros) {
        const opt = document.createElement('option');
        opt.value = d?.name || '';
        const flag = d?.isDefault ? '默认' : '';
        const state = d?.state ? String(d.state) : '';
        const version = d?.version ? `WSL${d.version}` : '';
        const tail = [flag, state, version].filter(Boolean).join(' · ');
        opt.textContent = tail ? `${d?.name || ''} (${tail})` : String(d?.name || '');
        distroSelect.appendChild(opt);
      }

      distroSelect.value = defaultName || distros[0]?.name || '';
    } finally {
      setButtonEnabled(btnRefresh, installed);
    }
  };

  const boot = async () => {
    if (!bridgeEnabled) {
      installed = false;
      setControlsEnabled(false);
      setStatus('WSL: bridge disabled (must run in ChatOS desktop UI)', 'bad');
      return;
    }

    setControlsEnabled(false);
    setStatus('WSL: checking...', 'bad');

    try {
      const res = await api.checkInstalled();
      installed = Boolean(res?.installed);
      if (!installed) {
        setStatus(`WSL: unavailable${res?.message ? ` (${res.message})` : ''}`, 'bad');
        setControlsEnabled(false);
        return;
      }
      setStatus('WSL: available', 'ok');
      setControlsEnabled(true);
      await loadDistros();
    } catch (err) {
      installed = false;
      setControlsEnabled(false);
      setStatus(`WSL: error (${err?.message || String(err)})`, 'bad');
    }
  };

  const killActiveRun = async () => {
    if (!activeRunId) return;
    stopPolling();
    try {
      const res = await api.kill({ runId: activeRunId });
      if (!res?.ok) appendLine(`[kill failed] ${res?.message || ''}`, 'stderr');
    } catch (err) {
      appendLine(`[kill error] ${err?.message || String(err)}`, 'stderr');
    } finally {
      activeRunId = '';
      pollCursor = 0;
    }
  };

  const startPolling = () => {
    stopPolling();
    if (!activeRunId) return;
    pollTimer = setInterval(async () => {
      if (disposed) return;
      if (!activeRunId) {
        stopPolling();
        return;
      }
      try {
        const res = await api.poll({ runId: activeRunId, cursor: pollCursor });
        if (!res?.ok) {
          appendLine(`[poll failed] ${res?.message || ''}`, 'stderr');
          activeRunId = '';
          stopPolling();
          return;
        }

        const items = Array.isArray(res?.items) ? res.items : [];
        for (const item of items) {
          const kind = item?.kind === 'stderr' ? 'stderr' : 'stdout';
          appendOutput(String(item?.text ?? ''), kind);
        }
        pollCursor = Number.isFinite(res?.nextCursor) ? res.nextCursor : pollCursor + items.length;

        if (res?.error) {
          appendLine(`[process error] ${res.error}`, 'stderr');
        }

        if (res?.done) {
          const exitCode = res?.exitCode;
          const signal = res?.signal;
          const exitText =
            exitCode !== null && exitCode !== undefined
              ? `[process exited] code=${exitCode}${signal ? ` signal=${signal}` : ''}`
              : `[process exited]${signal ? ` signal=${signal}` : ''}`;
          appendLine(exitText, res?.truncated ? 'stderr' : 'stdout');
          activeRunId = '';
          stopPolling();
        }
      } catch (err) {
        appendLine(`[poll error] ${err?.message || String(err)}`, 'stderr');
        activeRunId = '';
        stopPolling();
      }
    }, 200);
  };

  const runStreaming = async () => {
    const command = normalizeString(input.value);
    if (!command) return;
    await killActiveRun();

    const distroName = currentDistroName();
    appendLine(`$ ${command}`, 'stdout');
    setButtonEnabled(btnRun, false);
    setButtonEnabled(btnRunOnce, false);
    setButtonEnabled(btnKill, true);

    try {
      const res = await api.start({ distroName, command });
      if (!res?.ok) {
        appendLine(res?.message || 'start failed', 'stderr');
        return;
      }
      activeRunId = String(res.runId || '');
      pollCursor = 0;
      startPolling();
    } catch (err) {
      appendLine(err?.message || String(err), 'stderr');
    } finally {
      setButtonEnabled(btnRun, installed);
      setButtonEnabled(btnRunOnce, installed);
    }
  };

  const runOnce = async () => {
    const command = normalizeString(input.value);
    if (!command) return;
    await killActiveRun();

    const distroName = currentDistroName();
    appendLine(`$ ${command}`, 'stdout');
    setButtonEnabled(btnRun, false);
    setButtonEnabled(btnRunOnce, false);

    try {
      const res = await api.exec({ distroName, command });
      if (!res?.ok) {
        appendLine(res?.message || 'exec failed', 'stderr');
        return;
      }
      if (res.stdout) appendOutput(res.stdout, 'stdout');
      if (res.stderr) appendOutput(res.stderr, 'stderr');
      const exitSuffix = [];
      if (res.timedOut) exitSuffix.push('timedOut=true');
      if (res.truncated) exitSuffix.push('truncated=true');
      appendLine(
        `[process exited] code=${res.exitCode ?? 'null'}${exitSuffix.length ? ` (${exitSuffix.join(', ')})` : ''}`,
        res.exitCode ? 'stderr' : 'stdout'
      );
    } catch (err) {
      appendLine(err?.message || String(err), 'stderr');
    } finally {
      setButtonEnabled(btnRun, installed);
      setButtonEnabled(btnRunOnce, installed);
    }
  };

  btnRefresh.addEventListener('click', () => loadDistros());
  btnRun.addEventListener('click', () => runStreaming());
  btnRunOnce.addEventListener('click', () => runOnce());
  btnKill.addEventListener('click', () => killActiveRun().then(() => appendLine('[killed]', 'stderr')));
  btnClear.addEventListener('click', () => {
    terminal.textContent = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runStreaming();
    }
  });

  appendLine('[WSL Manager ready]', 'stdout');
  boot();

  return () => {
    disposed = true;
    stopPolling();
    killActiveRun();
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
