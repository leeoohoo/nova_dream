# __PLUGIN_NAME__（Notepad 示例模板）

这是一个更接近“真实应用”的 **ChatOS UI Apps** 示例模板：Markdown 记事本（文件夹分类 + 标签检索 + 编辑/预览）。

## 快速开始

```bash
npm install
npm run dev
```

## 目录说明

- `plugin/plugin.json`：插件清单（应用列表、入口、后端、AI 贡献）
- `plugin/apps/__APP_ID__/`：前端 module（浏览器环境，导出 `mount({ container, host, slots })`）
- `plugin/backend/`：插件后端（Node/Electron main，导出 `createUiAppsBackend(ctx)`）
- `plugin/shared/`：共享存储实现（后端持久化所需）
- `docs/`：协议文档快照（随工程分发）

## 后端 API（示例）

前端通过 `host.backend.invoke(method, params)` 调用后端方法，本模板提供 `notes.*` 一组方法用于管理笔记：

- `notes.listFolders / notes.createFolder / notes.renameFolder / notes.deleteFolder`
- `notes.listNotes / notes.createNote / notes.getNote / notes.updateNote / notes.deleteNote`
- `notes.listTags / notes.searchNotes`

## MCP（可选）

模板内包含 `plugin/apps/__APP_ID__/mcp-server.mjs` 与 `mcp-prompt.*.md`，但默认 **未在** `plugin/plugin.json` 启用 `ai.mcp`（避免打包时遗漏依赖导致运行失败）。

如需启用 MCP：

1) 实现并 **bundle 成单文件**（建议 esbuild/rollup，把 `@modelcontextprotocol/sdk` 等依赖打进去）  
2) 在 `plugin/plugin.json` 的 `apps[i].ai.mcp` 写入 `entry/command/args/...` 并指向 bundle 产物  

