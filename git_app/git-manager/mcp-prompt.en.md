# Git Manager

This application exposes a set of MCP tools for managing Git repositories locally:

- `status`: Check the working directory status (branch, staged, modified, untracked files, etc.)
- `clone`: Clone a repository from a URL
- `init`: Initialize a new Git repository
- `commit`: Commit changes (specific files or all changes)
- `push`: Push changes to a remote repository
- `pull`: Pull changes from a remote repository
- `branch`: List branches or create a new branch
- `checkout`: Switch to a branch or create and switch to a new branch
- `fetch`: Fetch updates from remote repositories

Usage tips (important):

1) Before performing any Git operation, it's recommended to check the current repository status with `status` to understand the branch and file changes.
2) The `commit` operation automatically runs `git add` on files. If you want to commit specific files, specify them in the `files` parameter; otherwise it commits all changes (`git add .`).
3) Before running `push` or `pull`, it's recommended to `fetch` first to ensure you have the latest remote information.
4) After creating a new branch, you can use the `checkout` tool with `createNew=true` parameter to switch to the new branch.
5) If a command times out (`timedOut=true`) or output is truncated (`truncated=true`), it may be due to a large repository or slow network connection; consider increasing the timeout.

Authentication methods:

- **Username/Password**: Include authentication in the Git URL, or enter credentials on first push.
- **Token**: Recommended method. Use token in the Git URL instead of password (e.g., `https://username:token@github.com/user/repo.git`).
- **SSH Key**: Use SSH URL format (e.g., `git@github.com:user/repo.git`). Ensure SSH keys are configured and can connect successfully.
