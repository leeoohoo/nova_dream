import fs from 'fs';
import http from 'http';
import path from 'path';
import url from 'url';

import { ensureDir, isFile } from '../lib/fs.js';
import { loadPluginManifest, pickAppFromManifest } from '../lib/plugin.js';
import { resolveInsideDir } from '../lib/path-boundary.js';

function sendJson(res, status, obj) {
  const raw = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(raw);
}

function sendText(res, status, text, contentType) {
  res.writeHead(status, {
    'content-type': contentType || 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(text);
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.mjs' || ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

function serveStaticFile(res, filePath) {
  if (!isFile(filePath)) return false;
  const ct = guessContentType(filePath);
  const buf = fs.readFileSync(filePath);
  res.writeHead(200, { 'content-type': ct, 'cache-control': 'no-store' });
  res.end(buf);
  return true;
}

function htmlPage() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ChatOS UI Apps Sandbox</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
      #appRoot { height: 100vh; display:flex; flex-direction:column; }
      #sandboxToolbar { flex: 0 0 auto; border-bottom: 1px solid rgba(0,0,0,0.10); padding: 10px 12px; }
      #headerSlot { flex: 0 0 auto; border-bottom: 1px solid rgba(0,0,0,0.08); padding: 10px 12px; }
      #container { flex: 1 1 auto; min-height:0; overflow:hidden; }
      #containerInner { height:100%; overflow:auto; }
      .muted { opacity: 0.7; font-size: 12px; }
      .bar { display:flex; gap:10px; align-items:center; justify-content:space-between; }
      .btn { border:1px solid rgba(0,0,0,0.14); background:rgba(0,0,0,0.04); padding:6px 10px; border-radius:10px; cursor:pointer; font-weight:650; }
      .btn:active { transform: translateY(1px); }
      #promptsPanel { position: fixed; right: 12px; bottom: 12px; width: 420px; max-height: 70vh; display:none; flex-direction:column; background:rgba(255,255,255,0.96); color:#111; border:1px solid rgba(0,0,0,0.18); border-radius:14px; overflow:hidden; box-shadow: 0 18px 60px rgba(0,0,0,0.18); }
      @media (prefers-color-scheme: dark) {
        #promptsPanel { background: rgba(17,17,17,0.92); color: #eee; border-color: rgba(255,255,255,0.18); }
        #sandboxToolbar { border-bottom-color: rgba(255,255,255,0.12); }
        #headerSlot { border-bottom-color: rgba(255,255,255,0.10); }
        .btn { border-color: rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); color:#eee; }
      }
      #promptsPanelHeader { padding: 10px 12px; display:flex; align-items:center; justify-content:space-between; border-bottom: 1px solid rgba(0,0,0,0.12); }
      #promptsPanelBody { padding: 10px 12px; overflow:auto; display:flex; flex-direction:column; gap:10px; }
      #promptsFab { position: fixed; right: 16px; bottom: 16px; width: 44px; height: 44px; border-radius: 999px; display:flex; align-items:center; justify-content:center; }
      .card { border: 1px solid rgba(0,0,0,0.12); border-radius: 12px; padding: 10px; }
      .row { display:flex; gap:10px; }
      input, textarea, select { width:100%; padding:8px; border-radius:10px; border:1px solid rgba(0,0,0,0.14); background:rgba(0,0,0,0.03); color: inherit; }
      textarea { min-height: 70px; resize: vertical; }
      label { font-size: 12px; opacity: 0.8; }
      .danger { border-color: rgba(255,0,0,0.35); }
    </style>
  </head>
  <body>
    <div id="appRoot">
      <div id="sandboxToolbar">
        <div class="bar">
          <div>
            <div style="font-weight:800">ChatOS UI Apps Sandbox</div>
            <div class="muted">Host API mock · 模拟 module mount({ container, host, slots })</div>
          </div>
          <div class="row">
            <button id="btnReload" class="btn" type="button">Reload</button>
          </div>
        </div>
      </div>
      <div id="headerSlot"></div>
      <div id="container"><div id="containerInner"></div></div>
    </div>

    <button id="promptsFab" class="btn" type="button">:)</button>

    <div id="promptsPanel">
      <div id="promptsPanelHeader">
        <div style="font-weight:800">UI Prompts</div>
        <button id="promptsClose" class="btn" type="button">Close</button>
      </div>
      <div id="promptsPanelBody"></div>
    </div>

    <script type="module" src="/sandbox.mjs"></script>
  </body>
</html>`;
}

function sandboxClientJs() {
  return `const $ = (sel) => document.querySelector(sel);

const container = $('#containerInner');
const headerSlot = $('#headerSlot');
const fab = $('#promptsFab');
const panel = $('#promptsPanel');
const panelBody = $('#promptsPanelBody');
const panelClose = $('#promptsClose');

const setPanelOpen = (open) => { panel.style.display = open ? 'flex' : 'none'; };
fab.addEventListener('click', () => setPanelOpen(panel.style.display !== 'flex'));
panelClose.addEventListener('click', () => setPanelOpen(false));
window.addEventListener('chatos:uiPrompts:open', () => setPanelOpen(true));
window.addEventListener('chatos:uiPrompts:close', () => setPanelOpen(false));
window.addEventListener('chatos:uiPrompts:toggle', () => setPanelOpen(panel.style.display !== 'flex'));

const entries = [];
const listeners = new Set();
const emitUpdate = () => {
  const payload = { path: '(sandbox)', entries: [...entries] };
  for (const fn of listeners) { try { fn(payload); } catch {} }
  renderPrompts();
};

const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2));

function renderPrompts() {
  panelBody.textContent = '';
  const pending = new Map();
  for (const e of entries) {
    if (e?.type !== 'ui_prompt') continue;
    const id = String(e?.requestId || '');
    if (!id) continue;
    if (e.action === 'request') pending.set(id, e);
    if (e.action === 'response') pending.delete(id);
  }

  if (pending.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = '暂无待办（request 后会出现在这里）';
    panelBody.appendChild(empty);
    return;
  }

  for (const [requestId, req] of pending.entries()) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.style.fontWeight = '800';
    title.textContent = req?.prompt?.title || '(untitled)';

    const msg = document.createElement('div');
    msg.className = 'muted';
    msg.style.marginTop = '6px';
    msg.textContent = req?.prompt?.message || '';

    const source = document.createElement('div');
    source.className = 'muted';
    source.style.marginTop = '6px';
    source.textContent = req?.prompt?.source ? String(req.prompt.source) : '';

    const form = document.createElement('div');
    form.style.marginTop = '10px';
    form.style.display = 'grid';
    form.style.gap = '10px';

    const kind = String(req?.prompt?.kind || '');

    const mkBtn = (label, danger) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (danger ? ' danger' : '');
      btn.textContent = label;
      return btn;
    };

    const submit = async (response) => {
      entries.push({ ts: new Date().toISOString(), type: 'ui_prompt', action: 'response', requestId, response });
      emitUpdate();
    };

    if (kind === 'kv') {
      const fields = Array.isArray(req?.prompt?.fields) ? req.prompt.fields : [];
      const values = {};
      for (const f of fields) {
        const key = String(f?.key || '');
        if (!key) continue;
        const wrap = document.createElement('div');
        const lab = document.createElement('label');
        lab.textContent = f?.label ? String(f.label) : key;
        const input = document.createElement(f?.multiline ? 'textarea' : 'input');
        input.placeholder = f?.placeholder ? String(f.placeholder) : '';
        input.value = f?.default ? String(f.default) : '';
        input.addEventListener('input', () => { values[key] = String(input.value || ''); });
        values[key] = String(input.value || '');
        wrap.appendChild(lab);
        wrap.appendChild(input);
        form.appendChild(wrap);
      }
      const row = document.createElement('div');
      row.className = 'row';
      const ok = mkBtn('Submit');
      ok.addEventListener('click', () => submit({ status: 'ok', values }));
      const cancel = mkBtn('Cancel', true);
      cancel.addEventListener('click', () => submit({ status: 'cancel' }));
      row.appendChild(ok);
      row.appendChild(cancel);
      form.appendChild(row);
    } else if (kind === 'choice') {
      const options = Array.isArray(req?.prompt?.options) ? req.prompt.options : [];
      const multiple = Boolean(req?.prompt?.multiple);
      const selected = new Set();
      const wrap = document.createElement('div');
      const lab = document.createElement('label');
      lab.textContent = '选择';
      const select = document.createElement('select');
      if (multiple) select.multiple = true;
      for (const opt of options) {
        const v = String(opt?.value || '');
        const o = document.createElement('option');
        o.value = v;
        o.textContent = opt?.label ? String(opt.label) : v;
        select.appendChild(o);
      }
      select.addEventListener('change', () => {
        selected.clear();
        for (const o of select.selectedOptions) selected.add(String(o.value));
      });
      wrap.appendChild(lab);
      wrap.appendChild(select);
      form.appendChild(wrap);
      const row = document.createElement('div');
      row.className = 'row';
      const ok = mkBtn('Submit');
      ok.addEventListener('click', () => submit({ status: 'ok', value: multiple ? Array.from(selected) : Array.from(selected)[0] || '' }));
      const cancel = mkBtn('Cancel', true);
      cancel.addEventListener('click', () => submit({ status: 'cancel' }));
      row.appendChild(ok);
      row.appendChild(cancel);
      form.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'row';
      const ok = mkBtn('OK');
      ok.addEventListener('click', () => submit({ status: 'ok' }));
      const cancel = mkBtn('Cancel', true);
      cancel.addEventListener('click', () => submit({ status: 'cancel' }));
      row.appendChild(ok);
      row.appendChild(cancel);
      form.appendChild(row);
    }

    card.appendChild(title);
    if (msg.textContent) card.appendChild(msg);
    if (source.textContent) card.appendChild(source);
    card.appendChild(form);
    panelBody.appendChild(card);
  }
}

const getTheme = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const host = {
  bridge: { enabled: true },
  context: { get: () => ({ pluginId: __SANDBOX__.pluginId, appId: __SANDBOX__.appId, theme: getTheme(), bridge: { enabled: true } }) },
  theme: {
    get: getTheme,
    onChange: (listener) => {
      if (!window.matchMedia || typeof listener !== 'function') return () => {};
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const fn = () => { try { listener(getTheme()); } catch {} };
      mq.addEventListener('change', fn);
      return () => mq.removeEventListener('change', fn);
    },
  },
  admin: {
    state: async () => ({ ok: true, state: {} }),
    onUpdate: () => () => {},
    models: { list: async () => ({ ok: true, models: [] }) },
    secrets: { list: async () => ({ ok: true, secrets: [] }) },
  },
  registry: {
    list: async () => ({ ok: true, apps: [__SANDBOX__.registryApp] }),
  },
  backend: {
    invoke: async (method, params) => {
      const r = await fetch('/api/backend/invoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, params }),
      });
      const j = await r.json();
      if (j?.ok === false) throw new Error(j?.message || 'invoke failed');
      return j?.result;
    },
  },
  uiPrompts: {
    read: async () => ({ path: '(sandbox)', entries: [...entries] }),
    onUpdate: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    request: async (payload) => {
      const requestId = payload?.requestId ? String(payload.requestId) : uuid();
      const prompt = payload?.prompt && typeof payload.prompt === 'object' ? { ...payload.prompt } : null;
      if (prompt && !prompt.source) prompt.source = __SANDBOX__.pluginId + ':' + __SANDBOX__.appId;
      entries.push({ ts: new Date().toISOString(), type: 'ui_prompt', action: 'request', requestId, runId: payload?.runId, prompt });
      emitUpdate();
      return { ok: true, requestId };
    },
    respond: async (payload) => {
      const requestId = String(payload?.requestId || '');
      if (!requestId) throw new Error('requestId is required');
      const response = payload?.response && typeof payload.response === 'object' ? payload.response : null;
      entries.push({ ts: new Date().toISOString(), type: 'ui_prompt', action: 'response', requestId, runId: payload?.runId, response });
      emitUpdate();
      return { ok: true };
    },
    open: () => (setPanelOpen(true), { ok: true }),
    close: () => (setPanelOpen(false), { ok: true }),
    toggle: () => (setPanelOpen(panel.style.display !== 'flex'), { ok: true }),
  },
  ui: { navigate: (menu) => ({ ok: true, menu }) },
  chat: {
    agents: {
      list: async () => { throw new Error('host.chat.* not available in sandbox'); },
      ensureDefault: async () => { throw new Error('host.chat.* not available in sandbox'); },
      create: async () => { throw new Error('host.chat.* not available in sandbox'); },
      update: async () => { throw new Error('host.chat.* not available in sandbox'); },
      delete: async () => { throw new Error('host.chat.* not available in sandbox'); },
      createForApp: async () => { throw new Error('host.chat.* not available in sandbox'); },
    },
    sessions: {
      list: async () => { throw new Error('host.chat.* not available in sandbox'); },
      ensureDefault: async () => { throw new Error('host.chat.* not available in sandbox'); },
      create: async () => { throw new Error('host.chat.* not available in sandbox'); },
    },
    messages: { list: async () => { throw new Error('host.chat.* not available in sandbox'); } },
    send: async () => { throw new Error('host.chat.* not available in sandbox'); },
    abort: async () => { throw new Error('host.chat.* not available in sandbox'); },
    events: {
      subscribe: () => { throw new Error('host.chat.* not available in sandbox'); },
      unsubscribe: () => ({ ok: true }),
    },
  },
};

let dispose = null;

async function loadAndMount() {
  if (typeof dispose === 'function') { try { await dispose(); } catch {} dispose = null; }
  container.textContent = '';

  const entryUrl = __SANDBOX__.entryUrl;
  const mod = await import(entryUrl + (entryUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
  const mount = mod?.mount || mod?.default?.mount || (typeof mod?.default === 'function' ? mod.default : null);
  if (typeof mount !== 'function') throw new Error('module entry must export mount()');
  const ret = await mount({ container, host, slots: { header: headerSlot } });
  if (typeof ret === 'function') dispose = ret;
  else if (ret && typeof ret.dispose === 'function') dispose = () => ret.dispose();
}

$('#btnReload').addEventListener('click', () => loadAndMount().catch((e) => {
  const pre = document.createElement('pre');
  pre.style.padding = '12px';
  pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = '[sandbox] ' + (e?.stack || e?.message || String(e));
  container.appendChild(pre);
}));

loadAndMount().catch((e) => {
  const pre = document.createElement('pre');
  pre.style.padding = '12px';
  pre.style.whiteSpace = 'pre-wrap';
  pre.textContent = '[sandbox] ' + (e?.stack || e?.message || String(e));
  container.appendChild(pre);
});
`;
}

async function loadBackendFactory({ pluginDir, manifest }) {
  const entryRel = manifest?.backend?.entry ? String(manifest.backend.entry).trim() : '';
  if (!entryRel) return null;
  const abs = resolveInsideDir(pluginDir, entryRel);
  const fileUrl = url.pathToFileURL(abs).toString();
  const mod = await import(fileUrl + `?t=${Date.now()}`);
  if (typeof mod?.createUiAppsBackend !== 'function') {
    throw new Error('backend entry must export createUiAppsBackend(ctx)');
  }
  return mod.createUiAppsBackend;
}

export async function startSandboxServer({ pluginDir, port = 4399, appId = '' }) {
  const { manifest } = loadPluginManifest(pluginDir);
  const app = pickAppFromManifest(manifest, appId);
  const effectiveAppId = String(app?.id || '');
  const entryRel = String(app?.entry?.path || '').trim();
  if (!entryRel) throw new Error('apps[i].entry.path is required');

  const entryAbs = resolveInsideDir(pluginDir, entryRel);
  if (!isFile(entryAbs)) throw new Error(`module entry not found: ${entryRel}`);

  const entryUrl = `/plugin/${encodeURIComponent(entryRel).replaceAll('%2F', '/')}`;

  let backendInstance = null;
  let backendFactory = null;

  const ctxBase = {
    pluginId: String(manifest?.id || ''),
    pluginDir,
    stateDir: path.join(process.cwd(), '.chatos', 'state', 'chatos'),
    sessionRoot: process.cwd(),
    projectRoot: process.cwd(),
    dataDir: '',
    llm: null,
  };
  ctxBase.dataDir = path.join(process.cwd(), '.chatos', 'data', ctxBase.pluginId);
  ensureDir(ctxBase.stateDir);
  ensureDir(ctxBase.dataDir);

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = url.parse(req.url || '/', true);
      const pathname = parsed.pathname || '/';

      if (req.method === 'GET' && pathname === '/') {
        return sendText(res, 200, htmlPage(), 'text/html; charset=utf-8');
      }

      if (req.method === 'GET' && pathname === '/sandbox.mjs') {
        const js = sandboxClientJs()
          .replaceAll('__SANDBOX__.pluginId', JSON.stringify(ctxBase.pluginId))
          .replaceAll('__SANDBOX__.appId', JSON.stringify(effectiveAppId))
          .replaceAll('__SANDBOX__.entryUrl', JSON.stringify(entryUrl))
          .replaceAll('__SANDBOX__.registryApp', JSON.stringify({ plugin: { id: ctxBase.pluginId }, id: effectiveAppId, entry: { type: 'module', url: entryUrl } }));
        return sendText(res, 200, js, 'text/javascript; charset=utf-8');
      }

      if (req.method === 'GET' && pathname.startsWith('/plugin/')) {
        const rel = decodeURIComponent(pathname.slice('/plugin/'.length));
        const abs = resolveInsideDir(pluginDir, rel);
        if (!serveStaticFile(res, abs)) return sendText(res, 404, 'Not found');
        return;
      }

      if (req.method === 'GET' && pathname === '/api/manifest') {
        return sendJson(res, 200, { ok: true, manifest });
      }

      if (pathname === '/api/backend/invoke') {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const payload = body ? JSON.parse(body) : {};
            const method = typeof payload?.method === 'string' ? payload.method.trim() : '';
            if (!method) return sendJson(res, 400, { ok: false, message: 'method is required' });
            const params = payload?.params;

            if (!backendFactory) backendFactory = await loadBackendFactory({ pluginDir, manifest });
            if (!backendFactory) return sendJson(res, 200, { ok: false, message: 'backend not configured in plugin.json' });

            if (!backendInstance || typeof backendInstance !== 'object' || !backendInstance.methods) {
              backendInstance = await backendFactory({ ...ctxBase });
            }
            const fn = backendInstance?.methods?.[method];
            if (typeof fn !== 'function') return sendJson(res, 404, { ok: false, message: `method not found: ${method}` });
            const result = await fn(params, { ...ctxBase });
            return sendJson(res, 200, { ok: true, result });
          } catch (e) {
            return sendJson(res, 200, { ok: false, message: e?.message || String(e) });
          }
        });
        return;
      }

      sendText(res, 404, 'Not found');
    } catch (e) {
      sendJson(res, 500, { ok: false, message: e?.message || String(e) });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  // eslint-disable-next-line no-console
  console.log(`Sandbox running:
  http://localhost:${port}/
pluginDir:
  ${pluginDir}
app:
  ${ctxBase.pluginId}:${effectiveAppId}
`);
}
