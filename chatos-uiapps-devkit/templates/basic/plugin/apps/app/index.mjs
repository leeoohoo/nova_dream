export function mount({ container, host, slots }) {
  if (!container) throw new Error('container is required');
  if (!host || typeof host !== 'object') throw new Error('host is required');

  const headerSlot =
    slots?.header && typeof slots.header === 'object' && typeof slots.header.appendChild === 'function' ? slots.header : null;

  const ctx = typeof host?.context?.get === 'function' ? host.context.get() : { pluginId: '', appId: '', theme: 'light' };

  const root = document.createElement('div');
  root.style.height = '100%';
  root.style.boxSizing = 'border-box';
  root.style.padding = '14px';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = '12px';

  const title = document.createElement('div');
  title.textContent = '__PLUGIN_NAME__ · __APP_ID__';
  title.style.fontWeight = '800';

  const meta = document.createElement('div');
  meta.style.fontSize = '12px';
  meta.style.opacity = '0.75';
  meta.textContent = `${ctx?.pluginId || ''}:${ctx?.appId || ''} · theme=${ctx?.theme || 'light'} · bridge=${host?.bridge?.enabled ? 'enabled' : 'disabled'}`;

  const header = document.createElement('div');
  header.appendChild(title);
  header.appendChild(meta);

  const body = document.createElement('div');
  body.style.display = 'grid';
  body.style.gridTemplateColumns = '320px 1fr';
  body.style.gap = '12px';
  body.style.flex = '1';
  body.style.minHeight = '0';

  const actions = document.createElement('div');
  actions.style.border = '1px solid rgba(0,0,0,0.12)';
  actions.style.borderRadius = '14px';
  actions.style.padding = '12px';
  actions.style.display = 'grid';
  actions.style.gap = '10px';

  const log = document.createElement('pre');
  log.style.border = '1px solid rgba(0,0,0,0.12)';
  log.style.borderRadius = '14px';
  log.style.padding = '12px';
  log.style.margin = '0';
  log.style.overflow = 'auto';
  log.style.minHeight = '0';

  const appendLog = (type, payload) => {
    const ts = new Date().toISOString();
    log.textContent += `[${ts}] ${type}${payload !== undefined ? ` ${JSON.stringify(payload, null, 2)}` : ''}\n`;
    log.scrollTop = log.scrollHeight;
  };

  const mkBtn = (label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.padding = '9px 10px';
    btn.style.borderRadius = '12px';
    btn.style.border = '1px solid rgba(0,0,0,0.14)';
    btn.style.background = 'rgba(0,0,0,0.04)';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '650';
    return btn;
  };

  const btnPing = mkBtn('backend.invoke("ping")');
  btnPing.addEventListener('click', async () => {
    try {
      const res = await host.backend.invoke('ping', { hello: 'world' });
      appendLog('backend.invoke', res);
    } catch (e) {
      appendLog('backend.invoke.error', { message: e?.message || String(e) });
    }
  });

  const btnPrompt = mkBtn('uiPrompts.request(kv)');
  btnPrompt.addEventListener('click', async () => {
    try {
      const res = await host.uiPrompts.request({
        prompt: {
          kind: 'kv',
          title: '需要你补充信息',
          message: '填写后点 Submit',
          fields: [
            { key: 'name', label: '姓名', placeholder: '请输入', required: true },
            { key: 'note', label: '备注', placeholder: '可选', multiline: true },
          ],
        },
      });
      appendLog('uiPrompts.request', res);
      host.uiPrompts.open();
    } catch (e) {
      appendLog('uiPrompts.request.error', { message: e?.message || String(e) });
    }
  });

  actions.appendChild(btnPing);
  actions.appendChild(btnPrompt);

  body.appendChild(actions);
  body.appendChild(log);

  root.appendChild(body);

  if (headerSlot) {
    try {
      headerSlot.textContent = '';
      headerSlot.appendChild(header);
    } catch {
      root.prepend(header);
    }
  } else {
    root.prepend(header);
  }

  try {
    container.textContent = '';
  } catch {
    // ignore
  }
  container.appendChild(root);

  return () => {
    try {
      container.textContent = '';
    } catch {
      // ignore
    }
  };
}

