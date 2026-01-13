export const GIT_MANAGER_STYLES = `
  .git-tools-root {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    box-sizing: border-box;
  }
  .git-tools-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .git-tools-title {
    font-weight: 750;
    letter-spacing: 0.2px;
  }
  .git-tools-meta {
    font-size: 12px;
    opacity: 0.72;
  }
  .git-tools-pill {
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--ds-panel-border);
    background: var(--ds-subtle-bg);
    white-space: nowrap;
    user-select: none;
  }
  .git-tools-pill[data-tone='ok'] {
    box-shadow: 0 0 0 3px rgba(46, 160, 67, 0.12);
  }
  .git-tools-pill[data-tone='bad'] {
    box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.12);
  }
  .git-tools-btn {
    border: 1px solid var(--ds-panel-border);
    background: var(--ds-subtle-bg);
    border-radius: 12px;
    padding: 8px 10px;
    cursor: pointer;
    font-weight: 650;
  }
  .git-tools-btn:hover {
    box-shadow: 0 0 0 3px var(--ds-focus-ring);
  }
  .git-tools-btn[data-variant='danger'] {
    border-color: rgba(248, 81, 73, 0.5);
  }
  .git-tools-btn[data-variant='danger']:hover {
    box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.24);
  }
  .git-tools-btn:disabled,
  .git-tools-btn[data-disabled='1'] {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none !important;
  }
  .git-tools-select,
  .git-tools-input {
    border: 1px solid var(--ds-panel-border);
    background: var(--ds-subtle-bg);
    color: inherit;
    border-radius: 12px;
    padding: 8px 10px;
    outline: none;
  }
  .git-tools-select {
    min-width: 160px;
  }
  .git-tools-input {
    min-width: 220px;
  }
  .git-tools-textarea {
    border: 1px solid var(--ds-panel-border);
    background: var(--ds-subtle-bg);
    color: inherit;
    border-radius: 12px;
    padding: 8px 10px;
    outline: none;
    min-width: 320px;
    min-height: 60px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
  }
  .git-tools-card {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ds-panel-border);
    background: var(--ds-panel-bg);
    border-radius: 14px;
    overflow: hidden;
  }
  .git-tools-card-header {
    padding: 10px 12px;
    border-bottom: 1px solid var(--ds-panel-border);
    font-size: 13px;
    font-weight: 650;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .git-tools-terminal {
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
  .git-tools-out-stdout { color: var(--ds-code-text); }
  .git-tools-out-stderr { color: #f85149; }
  :root[data-theme='dark'] .git-tools-out-stderr { color: #ff7b72; }
  .git-tools-section {
    border: 1px solid var(--ds-panel-border);
    background: var(--ds-panel-bg);
    border-radius: 14px;
    padding: 12px;
  }
  .git-tools-section-title {
    font-size: 13px;
    font-weight: 650;
    margin-bottom: 8px;
  }
  .git-tools-row-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
`;

