# WSL Tools (Windows Subsystem for Linux)

This app exposes MCP tools to run `wsl.exe` (WSL) on **Windows**:

- `mcp_com_leeoohoo_wsl_manager_status`: check whether WSL is available
- `mcp_com_leeoohoo_wsl_manager_list_distributions`: list installed distributions (`wsl --list --verbose`)
- `mcp_com_leeoohoo_wsl_manager_exec`: execute a command inside WSL (via `bash -lc`)

Guidelines:

1) If unsure about the environment, call `mcp_com_leeoohoo_wsl_manager_status` first. If WSL is unavailable, explain how to enable/install WSL instead of running commands.
2) If a specific distribution is needed, call `mcp_com_leeoohoo_wsl_manager_list_distributions` and use the returned `distroName`.
3) Ask for confirmation before running destructive commands (e.g. `rm -rf`, system config changes, large installs/upgrades).
4) If output is truncated (`truncated=true`), narrow the output or use more specific commands.
