# Git Manager

本应用向 ChatOS 暴露了一组 MCP tools，用于在本地管理 Git 仓库：

- `status`：查看仓库工作区状态（分支、已暂存、已修改、未跟踪文件等）
- `clone`：从 URL 克隆远程仓库
- `init`：初始化新的 Git 仓库
- `commit`：提交更改（可指定文件或提交所有更改）
- `push`：推送更改到远程仓库
- `pull`：从远程仓库拉取更改
- `branch`：列出分支或创建新分支
- `checkout`：切换分支或创建并切换到新分支
- `fetch`：从远程仓库获取更新

使用建议（重要）：

1) 执行任何 Git 操作前，建议先用 `status` 查看当前仓库状态，了解分支和文件变更情况。
2) `commit` 操作会自动 `git add` 文件。如需提交特定文件，请在 `files` 参数中指定；否则会提交所有更改（`git add .`）。
3) 执行 `push` 或 `pull` 前建议先 `fetch` 确保获取最新远程信息。
4) 创建新分支后可使用 `checkout` 的 `createNew=true` 参数切换到新分支。
5) 若命令超时（`timedOut=true`）或输出被截断（`truncated=true`），可能是仓库较大或网络较慢，可适当增加等待时间。

认证方式说明：

- **用户名密码**：在 Git URL 中包含认证信息，或在首次推送时输入凭据。
- **Token**：推荐方式。在 Git URL 中使用 token 替代密码（例如：`https://username:token@github.com/user/repo.git`）。
- **SSH 密钥**：使用 SSH URL 格式（例如：`git@github.com:user/repo.git`）。需确保 SSH 密钥已配置并可正常连接。
