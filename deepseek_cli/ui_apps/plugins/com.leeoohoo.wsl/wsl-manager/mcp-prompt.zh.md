# WSL Tools（Windows Subsystem for Linux）

本应用向 ChatOS 暴露了一组 MCP tools，用于在 **Windows** 上调用 `wsl.exe`（WSL）：

- `mcp_com_leeoohoo_wsl_manager_status`：检查 WSL 是否可用
- `mcp_com_leeoohoo_wsl_manager_list_distributions`：列出已安装的发行版（类似 `wsl --list --verbose`）
- `mcp_com_leeoohoo_wsl_manager_exec`：在 WSL 中执行命令（通过 `bash -lc`）

使用建议（重要）：

1) 若不确定环境，先调用 `mcp_com_leeoohoo_wsl_manager_status`。如果 WSL 不可用，给出启用/安装 WSL 的指引，而不是继续执行命令。
2) 需要指定发行版时，先调用 `mcp_com_leeoohoo_wsl_manager_list_distributions`，再用返回的 `distroName` 执行。
3) 执行带破坏性的命令（例如 `rm -rf`、改系统配置、安装/升级大量包）前先向用户确认。
4) 若输出被截断（`truncated=true`），建议用户缩小输出或改用更精确的命令。
