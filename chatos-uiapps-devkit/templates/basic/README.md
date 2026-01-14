# __PLUGIN_NAME__

这是一个 **ChatOS UI Apps 插件工程**（UI Apps Plugins）。

## 你应该在哪写什么

- `plugin/plugin.json`：插件清单（应用列表、入口、后端、AI 贡献）
- `plugin/apps/__APP_ID__/index.mjs`：**module 入口**（导出 `mount({ container, host, slots })`）
- `plugin/backend/index.mjs`：**插件后端**（导出 `createUiAppsBackend(ctx)`，通过 `host.backend.invoke()` 调用）
- `plugin/apps/__APP_ID__/mcp-server.mjs`：应用自带 MCP Server（可选）
- `plugin/apps/__APP_ID__/mcp-prompt.zh.md` / `.en.md`：MCP Prompt（可选）

## 开发与预览（本地沙箱）

```bash
npm install
npm run dev
```

沙箱会：

- 用 HTTP 运行你的 `module` 入口（模拟 ChatOS 的 `mount()` 调用）
- 提供 `host.*` 的 mock（含 `host.backend.invoke()`、`host.uiPrompts.*`）

## 安装到本机 ChatOS

```bash
npm run validate
npm run install:chatos
```

或打包成 zip（用于 ChatOS UI：应用 → 导入应用包）：

```bash
npm run pack
```

## 协议文档

`docs/` 目录包含当前版本的协议快照（建议团队内统一对齐）。

## 启用 MCP（可选）

本模板默认只启用 `ai.mcpPrompt`（不启用 `ai.mcp`），避免第三方插件在未打包依赖时运行失败。

如果你要启用 MCP：

1) 实现并打包 `plugin/apps/__APP_ID__/mcp-server.mjs`（建议 bundle 成单文件）  
2) 在 `plugin/plugin.json` 的 `apps[i].ai.mcp` 写入 `entry/command/args/...`  
