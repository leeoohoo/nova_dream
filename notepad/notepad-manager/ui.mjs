import { isElement } from './dom.mjs';
import { NOTEPAD_MANAGER_STYLES } from './styles.mjs';

export function createNotepadManagerUi({ container, slots, ctx, bridgeEnabled }) {
  if (!container) throw new Error('container is required');

  const headerSlot = isElement(slots?.header) ? slots.header : null;

  const style = document.createElement('style');
  style.textContent = NOTEPAD_MANAGER_STYLES;

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
  preview.innerHTML = '<div class=\"np-meta\">预览区</div>';

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

  const setStatus = (text, tone) => {
    statusPill.textContent = text;
    statusPill.dataset.tone = tone === 'ok' ? 'ok' : 'bad';
  };

  return {
    root,
    header,
    btnNewFolder,
    btnNewNote,
    btnSave,
    btnDelete,
    statusPill,
    newFolderInput,
    newNoteTitleInput,
    createHint,
    searchInput,
    folderList,
    tagRow,
    noteList,
    titleInput,
    folderSelect,
    tagsInput,
    infoBox,
    textarea,
    preview,
    setStatus,
  };
}

