#!/usr/bin/env bash
set -e

# ==============================================================================
# ilinks-mcp 官方一键发布脚本 (发布到 npm 官方公共仓库)
# ==============================================================================

cd "$(dirname "$0")"

echo "🔍 [1/3] 正在检查 npm 登录状态..."
WHOAMI=$(npm whoami 2>/dev/null || true)
if [ -z "$WHOAMI" ]; then
  echo "❌ 未检测到 npm 登录态，请先执行: npm login 登录您的 npm 账号。"
  exit 1
fi
echo "✅ 已登录为 npm 用户: $WHOAMI"

echo "🧪 [2/3] 运行自动化工具与连接预检测试..."
npm test

echo "📦 [3/3] 正在正式发布 ilinks-mcp 到 npm 官方仓库..."
npm publish --access public

echo ""
echo "🎉 恭喜！ilinks-mcp 已成功发布到 npm！"
echo "👉 全网任何用户与 AI Agent 现已可直接通过以下方式秒级运行（无需本地克隆代码）："
echo "   npx -y ilinks-mcp"
