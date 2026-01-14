📌 待完成的核心事项（按优先级）
1. 项目规范化（必须完成）
❌ 根目录添加 LICENSE 文件（MIT 模板）
❌ 创建 CONTRIBUTING.md：说明如何贡献代码、搭建环境
❌ 创建 Issue/PR 模板：在 .github/ 目录下添加
ISSUE_TEMPLATE/bug_report.md
ISSUE_TEMPLATE/feature_request.md
PULL_REQUEST_TEMPLATE.md
2. CI/CD 完善
❌ 添加统一测试脚本：在根目录或各子项目的 package.json 中添加 test 命令
❌ 扩展 GitHub Actions：添加测试步骤，确保 PR 通过测试后才能合并
❌ 启用 Dependabot：自动创建依赖更新 PR（在仓库 Settings → Code security and analysis 中启用）
3. 社区与长期维护
❌ 创建 CHANGELOG.md：记录版本变更历史
❌ 配置语义化版本发布：明确如何打标签、发布到 npm
❌ 启用 GitHub Discussions：方便社区交流（在仓库 Settings → Features 中启用）