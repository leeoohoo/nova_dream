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

function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMd(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+?)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return out;
}

function renderMarkdown(md) {
  const text = String(md || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  let html = '';
  let inCode = false;
  let listMode = '';
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const content = paragraph.map((l) => renderInlineMd(l)).join('<br />');
    html += `<p>${content}</p>`;
    paragraph = [];
  };

  const closeList = () => {
    if (!listMode) return;
    html += listMode === 'ol' ? '</ol>' : '</ul>';
    listMode = '';
  };

  for (const rawLine of lines) {
    const line = String(rawLine ?? '');
    const trimmed = line.trimEnd();

    const fence = trimmed.trim().match(/^```(\S+)?\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      if (!inCode) {
        inCode = true;
        const lang = escapeHtml(fence[1] || '');
        html += `<pre><code data-lang="${lang}">`;
      } else {
        inCode = false;
        html += '</code></pre>';
      }
      continue;
    }

    if (inCode) {
      html += `${escapeHtml(line)}\n`;
      continue;
    }

    if (!trimmed.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(6, heading[1].length);
      html += `<h${level}>${renderInlineMd(heading[2])}</h${level}>`;
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html += `<blockquote>${renderInlineMd(quote[1] || '')}</blockquote>`;
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      if (listMode && listMode !== 'ul') closeList();
      if (!listMode) {
        listMode = 'ul';
        html += '<ul>';
      }
      html += `<li>${renderInlineMd(ul[1])}</li>`;
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      if (listMode && listMode !== 'ol') closeList();
      if (!listMode) {
        listMode = 'ol';
        html += '<ol>';
      }
      html += `<li>${renderInlineMd(ol[1])}</li>`;
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  if (inCode) html += '</code></pre>';
  return html;
}

function tagsToText(tags) {
  return (Array.isArray(tags) ? tags : []).join(', ');
}

function parseTags(input) {
  const raw = String(input ?? '');
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const tag of parts) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function mount({ container, host, slots }) {
  if (!container) throw new Error('container is required');
  if (!host || typeof host !== 'object') throw new Error('host is required');

  const ctx = typeof host?.context?.get === 'function' ? host.context.get() : { pluginId: '', appId: '', theme: 'light' };
  const bridgeEnabled = Boolean(ctx?.bridge?.enabled);
  const headerSlot = isElement(slots?.header) ? slots.header : null;

  const ensureBridge = () => {
    if (!bridgeEnabled) throw new Error('Host bridge not available (backend.invoke disabled)');
  };

  const api = {
    async init() {
      ensureBridge();
      return await host.backend.invoke('notes.init');
    },
    async listFolders() {
      ensureBridge();
      return await host.backend.invoke('notes.listFolders');
    },
    async createFolder(params) {
      ensureBridge();
      return await host.backend.invoke('notes.createFolder', params);
    },
    async renameFolder(params) {
      ensureBridge();
      return await host.backend.invoke('notes.renameFolder', params);
    },
    async deleteFolder(params) {
      ensureBridge();
      return await host.backend.invoke('notes.deleteFolder', params);
    },
    async listNotes(params) {
      ensureBridge();
      return await host.backend.invoke('notes.listNotes', params);
    },
    async createNote(params) {
      ensureBridge();
      return await host.backend.invoke('notes.createNote', params);
    },
    async getNote(params) {
      ensureBridge();
      return await host.backend.invoke('notes.getNote', params);
    },
    async updateNote(params) {
      ensureBridge();
      return await host.backend.invoke('notes.updateNote', params);
    },
    async deleteNote(params) {
      ensureBridge();
      return await host.backend.invoke('notes.deleteNote', params);
    },
    async listTags() {
      ensureBridge();
      return await host.backend.invoke('notes.listTags');
    },
    async searchNotes(params) {
      ensureBridge();
      return await host.backend.invoke('notes.searchNotes', params);
    },
  };

  const style = document.createElement('style');
  style.textContent = `
    .np-root {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      box-sizing: border-box;
    }
    .np-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .np-title {
      font-weight: 750;
      letter-spacing: 0.2px;
    }
    .np-meta {
      font-size: 12px;
      opacity: 0.72;
    }
    .np-pill {
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      white-space: nowrap;
      user-select: none;
    }
    .np-pill[data-tone='ok'] { box-shadow: 0 0 0 3px rgba(46, 160, 67, 0.12); }
    .np-pill[data-tone='bad'] { box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.12); }
    .np-btn {
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      border-radius: 12px;
      padding: 8px 10px;
      cursor: pointer;
      font-weight: 650;
    }
    .np-btn:hover { box-shadow: 0 0 0 3px var(--ds-focus-ring); }
    .np-btn:disabled,
    .np-btn[data-disabled='1'] {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none !important;
    }
    .np-input, .np-select, .np-textarea {
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      color: inherit;
      border-radius: 12px;
      padding: 8px 10px;
      outline: none;
      box-sizing: border-box;
    }
    .np-input { width: 100%; }
    .np-select { width: 100%; }
    .np-textarea {
      width: 100%;
      height: 100%;
      resize: none;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
      line-height: 1.45;
      background: var(--ds-code-bg);
      border-color: var(--ds-code-border);
    }
    .np-grid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 12px;
    }
    .np-card {
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-panel-bg);
      border-radius: 14px;
      overflow: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .np-card-header {
      padding: 10px 12px;
      border-bottom: 1px solid var(--ds-panel-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 13px;
      font-weight: 650;
    }
    .np-card-body {
      padding: 12px;
      flex: 1;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .np-section-title {
      font-size: 12px;
      font-weight: 750;
      opacity: 0.85;
      margin-bottom: 6px;
    }
    .np-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .np-item {
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      border-radius: 12px;
      padding: 8px 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .np-item:hover { box-shadow: 0 0 0 3px var(--ds-focus-ring); }
    .np-item[data-active='1'] {
      border-color: rgba(46, 160, 67, 0.55);
      box-shadow: 0 0 0 3px rgba(46, 160, 67, 0.18);
    }
    .np-item-title { font-weight: 700; }
    .np-item-meta { font-size: 12px; opacity: 0.72; }
    .np-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .np-chip {
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-subtle-bg);
      cursor: pointer;
      user-select: none;
    }
    .np-chip[data-active='1'] {
      border-color: rgba(46, 160, 67, 0.55);
      box-shadow: 0 0 0 3px rgba(46, 160, 67, 0.18);
    }
    .np-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .np-row .np-input {
      flex: 1;
      min-width: 180px;
    }
    .np-editor-top {
      display: grid;
      grid-template-columns: 1fr 200px;
      gap: 10px;
    }
    .np-editor-top-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .np-editor-split {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .np-preview {
      border: 1px solid var(--ds-code-border);
      background: var(--ds-panel-bg);
      border-radius: 12px;
      padding: 12px;
      overflow: auto;
      min-height: 0;
    }
    .np-preview h1, .np-preview h2, .np-preview h3, .np-preview h4, .np-preview h5, .np-preview h6 { margin: 10px 0 6px; }
    .np-preview p { margin: 8px 0; line-height: 1.6; }
    .np-preview pre {
      padding: 10px;
      border-radius: 12px;
      background: var(--ds-code-bg);
      border: 1px solid var(--ds-code-border);
      overflow: auto;
    }
    .np-preview code {
      padding: 2px 6px;
      border-radius: 8px;
      background: var(--ds-code-bg);
      border: 1px solid var(--ds-code-border);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
    }
    .np-preview pre code { padding: 0; border: none; background: transparent; }
    .np-preview blockquote {
      margin: 8px 0;
      padding: 8px 10px;
      border-left: 3px solid rgba(46, 160, 67, 0.7);
      background: rgba(46, 160, 67, 0.06);
      border-radius: 10px;
    }
    .np-preview ul, .np-preview ol { margin: 8px 0 8px 18px; }
    .np-preview img { max-width: 100%; }

    .np-menu-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: transparent;
    }
    .np-menu {
      position: absolute;
      min-width: 220px;
      max-width: min(360px, calc(100vw - 20px));
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-panel-bg);
      border-radius: 12px;
      box-shadow: var(--ds-panel-shadow);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .np-menu-item {
      width: 100%;
      text-align: left;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-weight: 650;
    }
    .np-menu-item:hover {
      background: var(--ds-subtle-bg);
      border-color: var(--ds-panel-border);
    }
    .np-menu-item[data-danger='1'] { color: #f85149; }
    :root[data-theme='dark'] .np-menu-item[data-danger='1'] { color: #ff7b72; }
    .np-menu-item:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .np-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: rgba(0, 0, 0, 0.28);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      box-sizing: border-box;
    }
    .np-modal {
      width: min(560px, 100%);
      border: 1px solid var(--ds-panel-border);
      background: var(--ds-panel-bg);
      border-radius: 14px;
      box-shadow: var(--ds-panel-shadow);
      overflow: hidden;
    }
    .np-modal-header {
      padding: 12px 14px;
      border-bottom: 1px solid var(--ds-panel-border);
      font-weight: 750;
    }
    .np-modal-body {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .np-modal-desc {
      font-size: 12px;
      opacity: 0.72;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .np-modal-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .np-modal-label {
      font-size: 12px;
      font-weight: 650;
      opacity: 0.82;
    }
    .np-modal-error { font-size: 12px; color: #f85149; }
    :root[data-theme='dark'] .np-modal-error { color: #ff7b72; }
    .np-modal-actions {
      padding: 12px 14px;
      border-top: 1px solid var(--ds-panel-border);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .np-btn[data-variant='danger'] { border-color: rgba(248, 81, 73, 0.5); }
    .np-btn[data-variant='danger']:hover { box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.24); }
  `;

  const root = document.createElement('div');
  root.className = 'np-root';
  root.appendChild(style);

  const header = document.createElement('div');
  header.className = 'np-header';

  const headerLeft = document.createElement('div');
  headerLeft.style.display = 'flex';
  headerLeft.style.flexDirection = 'column';
  headerLeft.style.gap = '2px';

  const title = document.createElement('div');
  title.className = 'np-title';
  title.textContent = '记事本';

  const meta = document.createElement('div');
  meta.className = 'np-meta';
  meta.textContent = `${ctx?.pluginId || ''}:${ctx?.appId || ''} · bridge=${bridgeEnabled ? 'enabled' : 'disabled'}`;

  headerLeft.appendChild(title);
  headerLeft.appendChild(meta);

  const headerRight = document.createElement('div');
  headerRight.style.display = 'flex';
  headerRight.style.alignItems = 'center';
  headerRight.style.gap = '8px';
  headerRight.style.flexWrap = 'wrap';

  const btnNewFolder = document.createElement('button');
  btnNewFolder.type = 'button';
  btnNewFolder.className = 'np-btn';
  btnNewFolder.textContent = '新建文件夹';

  const btnNewNote = document.createElement('button');
  btnNewNote.type = 'button';
  btnNewNote.className = 'np-btn';
  btnNewNote.textContent = '新建笔记';

  const btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'np-btn';
  btnSave.textContent = '保存';

  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'np-btn';
  btnDelete.textContent = '删除';

  const statusPill = document.createElement('div');
  statusPill.className = 'np-pill';
  statusPill.dataset.tone = 'bad';
  statusPill.textContent = 'Notes: initializing...';

  headerRight.appendChild(statusPill);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  const grid = document.createElement('div');
  grid.className = 'np-grid';

  const leftCard = document.createElement('div');
  leftCard.className = 'np-card';
  const leftHeader = document.createElement('div');
  leftHeader.className = 'np-card-header';
  leftHeader.textContent = '分类与检索';
  const leftBody = document.createElement('div');
  leftBody.className = 'np-card-body';

  const createSection = document.createElement('div');
  const createTitle = document.createElement('div');
  createTitle.className = 'np-section-title';
  createTitle.textContent = '新建';

  const createFolderRow = document.createElement('div');
  createFolderRow.className = 'np-row';
  const newFolderInput = document.createElement('input');
  newFolderInput.className = 'np-input';
  newFolderInput.type = 'text';
  newFolderInput.placeholder = '文件夹路径，例如：work/ideas';
  createFolderRow.appendChild(newFolderInput);
  createFolderRow.appendChild(btnNewFolder);

  const createNoteRow = document.createElement('div');
  createNoteRow.className = 'np-row';
  const newNoteTitleInput = document.createElement('input');
  newNoteTitleInput.className = 'np-input';
  newNoteTitleInput.type = 'text';
  newNoteTitleInput.placeholder = '笔记标题（可空）';
  createNoteRow.appendChild(newNoteTitleInput);
  createNoteRow.appendChild(btnNewNote);

  const createHint = document.createElement('div');
  createHint.className = 'np-meta';
  createHint.textContent = '新笔记将创建在：根目录';

  createSection.appendChild(createTitle);
  createSection.appendChild(createFolderRow);
  createSection.appendChild(createNoteRow);
  createSection.appendChild(createHint);

  const searchInput = document.createElement('input');
  searchInput.className = 'np-input';
  searchInput.type = 'text';
  searchInput.placeholder = '搜索标题/文件夹（可配合标签）…';

  const folderSection = document.createElement('div');
  const folderTitle = document.createElement('div');
  folderTitle.className = 'np-section-title';
  folderTitle.textContent = '文件夹';
  const folderList = document.createElement('div');
  folderList.className = 'np-list';
  folderSection.appendChild(folderTitle);
  folderSection.appendChild(folderList);

  const tagSection = document.createElement('div');
  const tagTitle = document.createElement('div');
  tagTitle.className = 'np-section-title';
  tagTitle.textContent = '标签';
  const tagRow = document.createElement('div');
  tagRow.className = 'np-chip-row';
  tagSection.appendChild(tagTitle);
  tagSection.appendChild(tagRow);

  const notesSection = document.createElement('div');
  const notesTitle = document.createElement('div');
  notesTitle.className = 'np-section-title';
  notesTitle.textContent = '文档';
  const noteList = document.createElement('div');
  noteList.className = 'np-list';
  notesSection.appendChild(notesTitle);
  notesSection.appendChild(noteList);

  leftBody.appendChild(createSection);
  leftBody.appendChild(searchInput);
  leftBody.appendChild(folderSection);
  leftBody.appendChild(tagSection);
  leftBody.appendChild(notesSection);

  leftCard.appendChild(leftHeader);
  leftCard.appendChild(leftBody);

  const rightCard = document.createElement('div');
  rightCard.className = 'np-card';
  const rightHeader = document.createElement('div');
  rightHeader.className = 'np-card-header';
  rightHeader.textContent = '';
  const rightHeaderTitle = document.createElement('div');
  rightHeaderTitle.textContent = '编辑与预览';
  const rightHeaderActions = document.createElement('div');
  rightHeaderActions.className = 'np-row';
  rightHeaderActions.appendChild(btnSave);
  rightHeaderActions.appendChild(btnDelete);
  rightHeader.appendChild(rightHeaderTitle);
  rightHeader.appendChild(rightHeaderActions);
  const rightBody = document.createElement('div');
  rightBody.className = 'np-card-body';

  const editorTop = document.createElement('div');
  editorTop.className = 'np-editor-top';

  const titleInput = document.createElement('input');
  titleInput.className = 'np-input';
  titleInput.type = 'text';
  titleInput.placeholder = '标题';

  const folderSelect = document.createElement('select');
  folderSelect.className = 'np-select';
  folderSelect.title = '选择文件夹';

  editorTop.appendChild(titleInput);
  editorTop.appendChild(folderSelect);

  const editorTopRow = document.createElement('div');
  editorTopRow.className = 'np-editor-top-row';

  const tagsInput = document.createElement('input');
  tagsInput.className = 'np-input';
  tagsInput.type = 'text';
  tagsInput.placeholder = '标签（逗号分隔）';

  const infoBox = document.createElement('div');
  infoBox.className = 'np-meta';
  infoBox.style.alignSelf = 'center';
  infoBox.textContent = '未选择笔记';

  editorTopRow.appendChild(tagsInput);
  editorTopRow.appendChild(infoBox);

  const split = document.createElement('div');
  split.className = 'np-editor-split';

  const textarea = document.createElement('textarea');
  textarea.className = 'np-textarea';
  textarea.placeholder = '开始写 Markdown…';

  const preview = document.createElement('div');
  preview.className = 'np-preview';
  preview.innerHTML = '<div class="np-meta">预览区</div>';

  split.appendChild(textarea);
  split.appendChild(preview);

  rightBody.appendChild(editorTop);
  rightBody.appendChild(editorTopRow);
  rightBody.appendChild(split);

  rightCard.appendChild(rightHeader);
  rightCard.appendChild(rightBody);

  grid.appendChild(leftCard);
  grid.appendChild(rightCard);

  if (headerSlot) {
    try {
      headerSlot.textContent = '';
    } catch {
      // ignore
    }
    try {
      headerSlot.appendChild(header);
    } catch {
      root.appendChild(header);
    }
  } else {
    root.appendChild(header);
  }
  root.appendChild(grid);

  try {
    container.textContent = '';
  } catch {
    // ignore
  }
  container.appendChild(root);

  let disposed = false;
  let folders = [];
  let tags = [];
  let notes = [];
  let selectedFolder = '';
  let selectedTags = [];
  let selectedNoteId = '';
  let currentNote = null;
  let currentContent = '';
  let dirty = false;
  let controlsEnabled = false;

  const setStatus = (text, tone) => {
    statusPill.textContent = text;
    statusPill.dataset.tone = tone === 'ok' ? 'ok' : 'bad';
  };

  let activeLayer = null;

  const closeActiveLayer = () => {
    const layer = activeLayer;
    activeLayer = null;
    if (!layer) return;
    try {
      layer.dispose?.();
    } catch {
      // ignore
    }
  };

  const showMenu = (x, y, items = []) => {
    if (disposed) return;
    closeActiveLayer();

    const overlay = document.createElement('div');
    overlay.className = 'np-menu-overlay';

    const menu = document.createElement('div');
    menu.className = 'np-menu';

    const close = () => {
      try {
        document.removeEventListener('keydown', onKeyDown, true);
      } catch {
        // ignore
      }
      try {
        overlay.remove();
      } catch {
        // ignore
      }
      if (activeLayer?.overlay === overlay) activeLayer = null;
    };

    const onKeyDown = (ev) => {
      if (ev?.key !== 'Escape') return;
      try {
        ev.preventDefault();
      } catch {
        // ignore
      }
      close();
    };

    overlay.addEventListener('mousedown', (ev) => {
      if (ev?.target !== overlay) return;
      close();
    });
    overlay.addEventListener('contextmenu', (ev) => {
      try {
        ev.preventDefault();
      } catch {
        // ignore
      }
      close();
    });

    (Array.isArray(items) ? items : []).forEach((item) => {
      const label = typeof item?.label === 'string' ? item.label : '';
      if (!label) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'np-menu-item';
      btn.textContent = label;
      btn.disabled = item?.disabled === true;
      btn.dataset.danger = item?.danger === true ? '1' : '0';
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        close();
        try {
          await item?.onClick?.();
        } catch (err) {
          setStatus(`Notes: ${err?.message || String(err)}`, 'bad');
        }
      });
      menu.appendChild(btn);
    });

    overlay.appendChild(menu);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown, true);

    menu.style.left = `${Math.max(0, Math.floor(x))}px`;
    menu.style.top = `${Math.max(0, Math.floor(y))}px`;
    try {
      const rect = menu.getBoundingClientRect();
      const margin = 8;
      let left = Math.floor(x);
      let top = Math.floor(y);
      if (left + rect.width + margin > window.innerWidth) left = Math.max(margin, window.innerWidth - rect.width - margin);
      if (top + rect.height + margin > window.innerHeight) top = Math.max(margin, window.innerHeight - rect.height - margin);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    } catch {
      // ignore
    }

    activeLayer = { overlay, dispose: close };
  };

  const showDialog = ({ title, description = '', fields = [], confirmText = '确定', cancelText = '取消', danger = false } = {}) =>
    new Promise((resolve) => {
      if (disposed) return resolve(null);
      closeActiveLayer();

      const overlay = document.createElement('div');
      overlay.className = 'np-modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'np-modal';

      const header = document.createElement('div');
      header.className = 'np-modal-header';
      header.textContent = typeof title === 'string' && title.trim() ? title.trim() : '提示';

      const body = document.createElement('div');
      body.className = 'np-modal-body';

      const desc = document.createElement('div');
      desc.className = 'np-modal-desc';
      desc.textContent = typeof description === 'string' ? description : '';
      if (desc.textContent.trim()) {
        body.appendChild(desc);
      }

      const errorEl = document.createElement('div');
      errorEl.className = 'np-modal-error';
      errorEl.textContent = '';

      const inputs = [];
      (Array.isArray(fields) ? fields : []).forEach((field) => {
        if (!field || typeof field !== 'object') return;
        const name = typeof field.name === 'string' ? field.name.trim() : '';
        if (!name) return;
        const row = document.createElement('div');
        row.className = 'np-modal-field';

        const label = document.createElement('div');
        label.className = 'np-modal-label';
        label.textContent = typeof field.label === 'string' ? field.label : name;
        row.appendChild(label);

        let control = null;
        const kind = field.kind === 'select' ? 'select' : 'text';
        if (kind === 'select') {
          const select = document.createElement('select');
          select.className = 'np-select';
          const options = Array.isArray(field.options) ? field.options : [];
          options.forEach((opt) => {
            const value = typeof opt?.value === 'string' ? opt.value : '';
            const labelText = typeof opt?.label === 'string' ? opt.label : value;
            const option = document.createElement('option');
            option.value = value;
            option.textContent = labelText || value || '（空）';
            select.appendChild(option);
          });
          select.value = typeof field.value === 'string' ? field.value : '';
          control = select;
        } else {
          const input = document.createElement('input');
          input.className = 'np-input';
          input.type = 'text';
          input.placeholder = typeof field.placeholder === 'string' ? field.placeholder : '';
          input.value = typeof field.value === 'string' ? field.value : '';
          control = input;
        }

        row.appendChild(control);
        body.appendChild(row);
        inputs.push({
          name,
          required: field.required === true,
          kind,
          control,
          getValue: () => (kind === 'select' ? String(control.value ?? '') : String(control.value ?? '')),
        });
      });

      if (inputs.length > 0) {
        body.appendChild(errorEl);
      }

      const actions = document.createElement('div');
      actions.className = 'np-modal-actions';

      const btnCancel = document.createElement('button');
      btnCancel.type = 'button';
      btnCancel.className = 'np-btn';
      btnCancel.textContent = cancelText || '取消';

      const btnOk = document.createElement('button');
      btnOk.type = 'button';
      btnOk.className = 'np-btn';
      btnOk.textContent = confirmText || '确定';
      btnOk.dataset.variant = danger ? 'danger' : '';

      const close = (result) => {
        try {
          document.removeEventListener('keydown', onKeyDown, true);
        } catch {
          // ignore
        }
        try {
          overlay.remove();
        } catch {
          // ignore
        }
        if (activeLayer?.overlay === overlay) activeLayer = null;
        resolve(result);
      };

      const validate = () => {
        errorEl.textContent = '';
        for (const it of inputs) {
          if (!it.required) continue;
          const v = String(it.getValue() || '').trim();
          if (!v) {
            errorEl.textContent = `请填写：${it.name}`;
            try {
              it.control.focus();
            } catch {
              // ignore
            }
            return false;
          }
        }
        return true;
      };

      const onKeyDown = (ev) => {
        if (ev?.key === 'Escape') {
          try {
            ev.preventDefault();
          } catch {
            // ignore
          }
          close(null);
          return;
        }
        if (ev?.key === 'Enter') {
          const tag = String(ev?.target?.tagName || '').toLowerCase();
          if (tag === 'textarea') return;
          try {
            ev.preventDefault();
          } catch {
            // ignore
          }
          btnOk.click();
        }
      };

      btnCancel.addEventListener('click', () => close(null));
      btnOk.addEventListener('click', () => {
        if (inputs.length > 0 && !validate()) return;
        const out = {};
        inputs.forEach((it) => {
          out[it.name] = it.getValue();
        });
        close(out);
      });

      overlay.addEventListener('mousedown', (ev) => {
        if (ev?.target !== overlay) return;
        close(null);
      });

      actions.appendChild(btnCancel);
      actions.appendChild(btnOk);
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKeyDown, true);

      activeLayer = { overlay, dispose: () => close(null) };

      const first = inputs[0]?.control;
      if (first) {
        setTimeout(() => {
          try {
            first.focus();
          } catch {
            // ignore
          }
        }, 0);
      } else {
        setTimeout(() => {
          try {
            btnOk.focus();
          } catch {
            // ignore
          }
        }, 0);
      }
    });

  const confirmDialog = async (message, options = {}) => {
    const res = await showDialog({
      title: options?.title || '确认',
      description: typeof message === 'string' ? message : '',
      fields: [],
      confirmText: options?.confirmText || '确定',
      cancelText: options?.cancelText || '取消',
      danger: options?.danger === true,
    });
    return Boolean(res);
  };

  const setControlsEnabled = (enabled) => {
    controlsEnabled = enabled;
    setButtonEnabled(btnNewFolder, enabled);
    setButtonEnabled(btnNewNote, enabled);
    setButtonEnabled(btnSave, enabled && Boolean(currentNote));
    setButtonEnabled(btnDelete, enabled && Boolean(currentNote));
    newFolderInput.disabled = !enabled;
    newNoteTitleInput.disabled = !enabled;
    searchInput.disabled = !enabled;
    titleInput.disabled = !enabled;
    folderSelect.disabled = !enabled;
    tagsInput.disabled = !enabled;
    textarea.disabled = !enabled;
  };

  const updateCreateHint = () => {
    const label = selectedFolder ? selectedFolder : '根目录';
    createHint.textContent = `新笔记将创建在：${label}`;
  };

  const ensureSafeToSwitch = async () => {
    if (!dirty) return true;
    const ok = await confirmDialog('当前笔记有未保存的修改，确定丢弃并继续吗？', {
      title: '未保存的更改',
      danger: true,
      confirmText: '丢弃并继续',
    });
    if (!ok) return false;
    dirty = false;
    return true;
  };

  const renderFolderOptions = () => {
    folderSelect.innerHTML = '';
    const opts = [''].concat(folders.filter((f) => f !== ''));
    for (const f of opts) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f ? f : '（根目录）';
      folderSelect.appendChild(opt);
    }
  };

  const renderFolderList = () => {
    folderList.innerHTML = '';
    for (const f of folders) {
      const item = document.createElement('div');
      item.className = 'np-item';
      item.dataset.active = f === selectedFolder ? '1' : '0';
      const depth = f ? f.split('/').length - 1 : 0;
      item.style.paddingLeft = `${10 + depth * 12}px`;
      const name = f ? f.split('/').slice(-1)[0] : '（根目录）';
      const titleEl = document.createElement('div');
      titleEl.className = 'np-item-title';
      titleEl.textContent = name;
      const metaEl = document.createElement('div');
      metaEl.className = 'np-item-meta';
      metaEl.textContent = f ? f : '全部笔记的根目录';
      item.appendChild(titleEl);
      item.appendChild(metaEl);
      item.addEventListener('click', async () => {
        if (disposed) return;
        if (!(await ensureSafeToSwitch())) return;
        selectedFolder = f;
        updateCreateHint();
        await refreshNotes();
        renderFolderList();
      });
      item.addEventListener('contextmenu', (ev) => {
        if (disposed) return;
        try {
          ev.preventDefault();
          ev.stopPropagation();
        } catch {
          // ignore
        }

        showMenu(ev.clientX, ev.clientY, [
          {
            label: '设为当前文件夹',
            onClick: async () => {
              if (!(await ensureSafeToSwitch())) return;
              selectedFolder = f;
              updateCreateHint();
              await refreshNotes();
              renderFolderList();
            },
          },
          {
            label: '在此新建笔记…',
            onClick: async () => {
              if (!(await ensureSafeToSwitch())) return;
              const values = await showDialog({
                title: '新建笔记',
                description: `目标文件夹：${f ? f : '根目录'}`,
                fields: [{ name: 'title', label: '标题', kind: 'text', value: '', placeholder: '可空' }],
                confirmText: '创建',
              });
              if (!values) return;
              const noteTitle = normalizeString(values.title);
              setStatus('Notes: creating note...', 'bad');
              const res = await api.createNote({ folder: f, title: noteTitle });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'create note failed'}`, 'bad');
                return;
              }
              selectedFolder = f;
              updateCreateHint();
              await refreshFoldersAndTags();
              await refreshNotes();
              const id = res?.note?.id || '';
              if (id) await openNote(id);
              setStatus('Notes: note created', 'ok');
            },
          },
          {
            label: '新建子文件夹…',
            onClick: async () => {
              if (!(await ensureSafeToSwitch())) return;
              const values = await showDialog({
                title: '新建文件夹',
                fields: [
                  {
                    name: 'folder',
                    label: '文件夹路径',
                    kind: 'text',
                    value: f ? `${f}/` : '',
                    placeholder: '例如：work/ideas',
                    required: true,
                  },
                ],
                confirmText: '创建',
              });
              if (!values) return;
              const folder = normalizeString(values.folder);
              if (!folder) return;
              setStatus('Notes: creating folder...', 'bad');
              const res = await api.createFolder({ folder });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'create folder failed'}`, 'bad');
                return;
              }
              selectedFolder = res?.folder || folder;
              updateCreateHint();
              await refreshFoldersAndTags();
              await refreshNotes();
              setStatus('Notes: folder created', 'ok');
            },
          },
          {
            label: '重命名文件夹…',
            disabled: !f,
            onClick: async () => {
              if (!(await ensureSafeToSwitch())) return;
              const values = await showDialog({
                title: '重命名文件夹',
                description: `当前：${f}`,
                fields: [{ name: 'to', label: '新路径', kind: 'text', value: f, placeholder: '例如：work/notes', required: true }],
                confirmText: '重命名',
              });
              if (!values) return;
              const to = normalizeString(values.to);
              if (!to) return;
              setStatus('Notes: renaming folder...', 'bad');
              const res = await api.renameFolder({ from: f, to });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'rename failed'}`, 'bad');
                return;
              }
              if (selectedFolder === f) {
                selectedFolder = to;
              } else if (selectedFolder.startsWith(`${f}/`)) {
                selectedFolder = `${to}/${selectedFolder.slice(f.length + 1)}`;
              }
              if (currentNote?.folder === f) {
                currentNote.folder = to;
              } else if (currentNote?.folder && String(currentNote.folder).startsWith(`${f}/`)) {
                currentNote.folder = `${to}/${String(currentNote.folder).slice(f.length + 1)}`;
              }
              updateCreateHint();
              await refreshFoldersAndTags();
              await refreshNotes();
              renderEditor(true);
              setStatus('Notes: folder renamed', 'ok');
            },
          },
          {
            label: '删除文件夹（递归）',
            disabled: !f,
            danger: true,
            onClick: async () => {
              if (!(await ensureSafeToSwitch())) return;
              const ok = await confirmDialog(`确定删除文件夹「${f}」及其所有子目录与笔记吗？`, {
                title: '删除文件夹',
                danger: true,
                confirmText: '删除',
              });
              if (!ok) return;
              setStatus('Notes: deleting folder...', 'bad');
              const res = await api.deleteFolder({ folder: f, recursive: true });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'delete folder failed'}`, 'bad');
                return;
              }
              if (selectedFolder === f || selectedFolder.startsWith(`${f}/`)) {
                selectedFolder = '';
              }
              updateCreateHint();
              await refreshFoldersAndTags();
              await refreshNotes();
              renderEditor(true);
              setStatus('Notes: folder deleted', 'ok');
            },
          },
        ]);
      });
      folderList.appendChild(item);
    }
  };

  const renderTags = () => {
    tagRow.innerHTML = '';
    if (!Array.isArray(tags) || tags.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'np-meta';
      empty.textContent = '暂无标签';
      tagRow.appendChild(empty);
      return;
    }
    for (const t of tags) {
      const chip = document.createElement('div');
      chip.className = 'np-chip';
      chip.dataset.active = selectedTags.some((x) => x.toLowerCase() === String(t.tag || '').toLowerCase()) ? '1' : '0';
      chip.textContent = `${t.tag} (${t.count})`;
      chip.addEventListener('click', async () => {
        if (disposed) return;
        const key = String(t.tag || '').toLowerCase();
        const idx = selectedTags.findIndex((x) => x.toLowerCase() === key);
        if (idx >= 0) selectedTags.splice(idx, 1);
        else selectedTags.push(t.tag);
        await refreshNotes();
        renderTags();
      });
      tagRow.appendChild(chip);
    }
  };

  const renderNotes = () => {
    noteList.innerHTML = '';
    if (!Array.isArray(notes) || notes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'np-meta';
      empty.textContent = '暂无文档';
      noteList.appendChild(empty);
      return;
    }
    for (const n of notes) {
      const item = document.createElement('div');
      item.className = 'np-item';
      item.dataset.active = n.id === selectedNoteId ? '1' : '0';

      const titleEl = document.createElement('div');
      titleEl.className = 'np-item-title';
      titleEl.textContent = n.title || 'Untitled';

      const metaEl = document.createElement('div');
      metaEl.className = 'np-item-meta';
      const folderText = n.folder ? n.folder : '（根目录）';
      const tagText = Array.isArray(n.tags) && n.tags.length > 0 ? ` · ${n.tags.join(', ')}` : '';
      metaEl.textContent = `${folderText}${tagText}`;

      item.appendChild(titleEl);
      item.appendChild(metaEl);

      item.addEventListener('click', async () => {
        if (disposed) return;
        if (n.id === selectedNoteId) return;
        if (!(await ensureSafeToSwitch())) return;
        await openNote(n.id);
      });

      item.addEventListener('contextmenu', (ev) => {
        if (disposed) return;
        try {
          ev.preventDefault();
          ev.stopPropagation();
        } catch {
          // ignore
        }

        showMenu(ev.clientX, ev.clientY, [
          {
            label: n.id === selectedNoteId ? '当前已打开' : '打开',
            disabled: n.id === selectedNoteId,
            onClick: async () => {
              if (n.id === selectedNoteId) return;
              if (!(await ensureSafeToSwitch())) return;
              await openNote(n.id);
            },
          },
          {
            label: '重命名…',
            onClick: async () => {
              const values = await showDialog({
                title: '重命名笔记',
                description: `ID: ${n.id}`,
                fields: [
                  { name: 'title', label: '标题', kind: 'text', value: n.title || '', placeholder: '例如：周报', required: true },
                ],
                confirmText: '重命名',
              });
              if (!values) return;
              const nextTitle = normalizeString(values.title);
              if (!nextTitle) return;
              if (n.id === selectedNoteId && currentNote) {
                currentNote.title = nextTitle;
                try {
                  titleInput.value = nextTitle;
                } catch {
                  // ignore
                }
                dirty = true;
                renderEditor(false);
                await doSave();
                return;
              }
              setStatus('Notes: updating note...', 'bad');
              const res = await api.updateNote({ id: n.id, title: nextTitle });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'update failed'}`, 'bad');
                return;
              }
              await refreshFoldersAndTags();
              await refreshNotes();
              setStatus('Notes: note updated', 'ok');
            },
          },
          {
            label: '移动到文件夹…',
            onClick: async () => {
              const options = (Array.isArray(folders) ? folders : ['']).map((f) => ({ value: f, label: f ? f : '（根目录）' }));
              const values = await showDialog({
                title: '移动笔记',
                description: `当前：${n.folder ? n.folder : '根目录'}`,
                fields: [{ name: 'folder', label: '目标文件夹', kind: 'select', options, value: n.folder || '' }],
                confirmText: '移动',
              });
              if (!values) return;
              const nextFolder = normalizeString(values.folder);
              if (n.id === selectedNoteId && currentNote) {
                currentNote.folder = nextFolder;
                try {
                  folderSelect.value = nextFolder;
                } catch {
                  // ignore
                }
                dirty = true;
                renderEditor(false);
                await doSave();
                return;
              }
              setStatus('Notes: moving note...', 'bad');
              const res = await api.updateNote({ id: n.id, folder: nextFolder });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'move failed'}`, 'bad');
                return;
              }
              await refreshFoldersAndTags();
              await refreshNotes();
              setStatus('Notes: note moved', 'ok');
            },
          },
          {
            label: '设置标签…',
            onClick: async () => {
              const values = await showDialog({
                title: '设置标签',
                description: '用逗号分隔，例如：work, todo',
                fields: [
                  { name: 'tags', label: '标签', kind: 'text', value: tagsToText(n.tags), placeholder: 'tag1, tag2' },
                ],
                confirmText: '应用',
              });
              if (!values) return;
              const nextTags = parseTags(values.tags);
              if (n.id === selectedNoteId && currentNote) {
                currentNote.tags = nextTags;
                try {
                  tagsInput.value = tagsToText(nextTags);
                } catch {
                  // ignore
                }
                dirty = true;
                renderEditor(false);
                await doSave();
                return;
              }
              setStatus('Notes: updating tags...', 'bad');
              const res = await api.updateNote({ id: n.id, tags: nextTags });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'update failed'}`, 'bad');
                return;
              }
              await refreshFoldersAndTags();
              await refreshNotes();
              setStatus('Notes: tags updated', 'ok');
            },
          },
          {
            label: '删除',
            danger: true,
            onClick: async () => {
              if (n.id === selectedNoteId && currentNote) {
                await doDelete();
                return;
              }
              const ok = await confirmDialog(`确定删除「${n.title || 'Untitled'}」吗？`, {
                title: '删除笔记',
                danger: true,
                confirmText: '删除',
              });
              if (!ok) return;
              setStatus('Notes: deleting note...', 'bad');
              const res = await api.deleteNote({ id: n.id });
              if (!res?.ok) {
                setStatus(`Notes: ${res?.message || 'delete failed'}`, 'bad');
                return;
              }
              await refreshFoldersAndTags();
              await refreshNotes();
              setStatus('Notes: note deleted', 'ok');
            },
          },
        ]);
      });

      noteList.appendChild(item);
    }
  };

  const renderEditor = (force = false) => {
    if (!currentNote) {
      infoBox.textContent = '未选择笔记';
      titleInput.value = '';
      tagsInput.value = '';
      textarea.value = '';
      preview.innerHTML = '<div class="np-meta">预览区</div>';
      setButtonEnabled(btnSave, false);
      setButtonEnabled(btnDelete, false);
      return;
    }
    infoBox.textContent = dirty ? `未保存 · ${currentNote.updatedAt || ''}` : `${currentNote.updatedAt || ''}`;
    if (force || document.activeElement !== titleInput) titleInput.value = currentNote.title || '';
    if (force || document.activeElement !== folderSelect) folderSelect.value = currentNote.folder || '';
    if (force || document.activeElement !== tagsInput) tagsInput.value = tagsToText(currentNote.tags);
    if (force || document.activeElement !== textarea) textarea.value = currentContent;
    preview.innerHTML = renderMarkdown(currentContent);
    setButtonEnabled(btnSave, controlsEnabled);
    setButtonEnabled(btnDelete, controlsEnabled);
  };

  const refreshFoldersAndTags = async () => {
    const [folderRes, tagRes] = await Promise.all([api.listFolders(), api.listTags()]);
    folders = Array.isArray(folderRes?.folders) ? folderRes.folders : [''];
    if (!folders.includes('')) folders.unshift('');
    tags = Array.isArray(tagRes?.tags) ? tagRes.tags : [];
    renderFolderOptions();
    renderFolderList();
    renderTags();
  };

  const refreshNotes = async () => {
    const query = normalizeString(searchInput.value);
    const res = await api.listNotes({
      folder: selectedFolder,
      tags: selectedTags,
      match: 'all',
      query,
      limit: 200,
    });
    notes = Array.isArray(res?.notes) ? res.notes : [];
    if (selectedNoteId && !notes.some((n) => n.id === selectedNoteId)) {
      selectedNoteId = '';
      currentNote = null;
      currentContent = '';
      dirty = false;
      renderEditor(true);
    }
    renderNotes();
  };

  const openNote = async (id) => {
    let res = null;
    try {
      res = await api.getNote({ id });
    } catch (err) {
      setStatus(`Notes: ${err?.message || String(err)}`, 'bad');
      return;
    }
    if (!res?.ok) {
      setStatus(`Notes: ${res?.message || 'load failed'}`, 'bad');
      return;
    }
    selectedNoteId = id;
    currentNote = res.note || null;
    currentContent = String(res.content ?? '');
    dirty = false;
    renderNotes();
    renderEditor(true);
  };

  const doSave = async () => {
    if (!currentNote) return;
    const nextTitle = normalizeString(titleInput.value);
    const nextFolder = normalizeString(folderSelect.value);
    const nextTags = parseTags(tagsInput.value);
    let res = null;
    try {
      res = await api.updateNote({ id: currentNote.id, title: nextTitle, folder: nextFolder, tags: nextTags, content: currentContent });
    } catch (err) {
      setStatus(`Notes: ${err?.message || String(err)}`, 'bad');
      return;
    }
    if (!res?.ok) {
      setStatus(`Notes: ${res?.message || 'save failed'}`, 'bad');
      return;
    }
    currentNote = res.note || currentNote;
    dirty = false;
    setStatus('Notes: saved', 'ok');
    await refreshFoldersAndTags();
    await refreshNotes();
    renderEditor(true);
  };

  const doDelete = async () => {
    if (!currentNote) return;
    const ok = await confirmDialog(`确定删除「${currentNote.title || 'Untitled'}」吗？`, {
      title: '删除笔记',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    let res = null;
    try {
      res = await api.deleteNote({ id: currentNote.id });
    } catch (err) {
      setStatus(`Notes: ${err?.message || String(err)}`, 'bad');
      return;
    }
    if (!res?.ok) {
      setStatus(`Notes: ${res?.message || 'delete failed'}`, 'bad');
      return;
    }
    selectedNoteId = '';
    currentNote = null;
    currentContent = '';
    dirty = false;
    setStatus('Notes: deleted', 'ok');
    await refreshFoldersAndTags();
    await refreshNotes();
    renderEditor(true);
  };

  btnNewFolder.addEventListener('click', async () => {
    if (disposed) return;
    const folder = normalizeString(newFolderInput.value);
    if (!folder) {
      setStatus('Notes: folder is required', 'bad');
      try {
        newFolderInput.focus();
      } catch {
        // ignore
      }
      return;
    }
    setStatus('Notes: creating folder...', 'bad');
    let res = null;
    try {
      res = await api.createFolder({ folder });
    } catch (err) {
      setStatus(`Notes: ${err?.message || String(err)}`, 'bad');
      return;
    }
    if (!res?.ok) {
      setStatus(`Notes: ${res?.message || 'create folder failed'}`, 'bad');
      return;
    }
    newFolderInput.value = '';
    const created = normalizeString(res?.folder) || folder;
    if (created && !dirty) {
      selectedFolder = created;
      updateCreateHint();
    }
    await refreshFoldersAndTags();
    if (created && !dirty) {
      await refreshNotes();
    }
    setStatus('Notes: folder created', 'ok');
  });

  btnNewNote.addEventListener('click', async () => {
    if (disposed) return;
    if (!(await ensureSafeToSwitch())) return;
    const title = normalizeString(newNoteTitleInput.value);
    setStatus('Notes: creating note...', 'bad');
    let res = null;
    try {
      res = await api.createNote({ folder: selectedFolder, title });
    } catch (err) {
      setStatus(`Notes: ${err?.message || String(err)}`, 'bad');
      return;
    }
    if (!res?.ok) {
      setStatus(`Notes: ${res?.message || 'create note failed'}`, 'bad');
      return;
    }
    newNoteTitleInput.value = '';
    await refreshFoldersAndTags();
    await refreshNotes();
    const id = res?.note?.id || '';
    if (id) await openNote(id);
    setStatus('Notes: note created', 'ok');
  });

  btnSave.addEventListener('click', () => doSave());
  btnDelete.addEventListener('click', () => doDelete());

  searchInput.addEventListener('input', async () => {
    if (disposed) return;
    await refreshNotes();
  });

  titleInput.addEventListener('input', () => {
    if (!currentNote) return;
    dirty = true;
    currentNote.title = normalizeString(titleInput.value);
    renderEditor(false);
  });

  folderSelect.addEventListener('change', () => {
    if (!currentNote) return;
    dirty = true;
    currentNote.folder = normalizeString(folderSelect.value);
    renderEditor(false);
  });

  tagsInput.addEventListener('input', () => {
    if (!currentNote) return;
    dirty = true;
    currentNote.tags = parseTags(tagsInput.value);
    renderEditor(false);
  });

  textarea.addEventListener('input', () => {
    if (!currentNote) return;
    dirty = true;
    currentContent = String(textarea.value ?? '');
    renderEditor(false);
  });

  newFolderInput.addEventListener('keydown', (ev) => {
    if (ev?.key !== 'Enter') return;
    try {
      ev.preventDefault();
    } catch {
      // ignore
    }
    btnNewFolder.click();
  });

  newNoteTitleInput.addEventListener('keydown', (ev) => {
    if (ev?.key !== 'Enter') return;
    try {
      ev.preventDefault();
    } catch {
      // ignore
    }
    btnNewNote.click();
  });

  const bootstrap = async () => {
    if (!bridgeEnabled) {
      setControlsEnabled(false);
      setStatus('Notes: bridge disabled (must run in ChatOS desktop UI)', 'bad');
      return;
    }
    setControlsEnabled(false);
    try {
      const res = await api.init();
      if (!res?.ok) {
        setStatus(`Notes: ${res?.message || 'init failed'}`, 'bad');
        return;
      }
      await refreshFoldersAndTags();
      await refreshNotes();
      updateCreateHint();
      setStatus('Notes: ready', 'ok');
      setControlsEnabled(true);
      renderEditor(true);
    } catch (err) {
      setStatus(`Notes: ${err?.message || String(err)}`, 'bad');
    }
  };

  bootstrap();

  return () => {
    disposed = true;
    closeActiveLayer();
  };
}
