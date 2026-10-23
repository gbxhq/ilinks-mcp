/**
 * 远程版本检测与自省更新提醒工具
 * 轻量、异步、非阻塞，静默降级，绝不影响工具核心调用
 */

let updateNoticeCache = null;
let lastCheckTime = 0;
const CHECK_INTERVAL = 1000 * 60 * 60 * 4; // 4 小时缓存一次，避免频繁请求

/**
 * 比较两个语义化版本号，若 remoteVersion > currentVersion 返回 true
 */
function isNewerVersion(current, remote) {
  if (!current || !remote) return false;
  const cParts = String(current).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const rParts = String(remote).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(cParts.length, rParts.length); i++) {
    const c = cParts[i] || 0;
    const r = rParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

/**
 * 检查 GitHub 仓库最新版本并返回提示信息
 */
export async function getUpdateNotice(currentVersion = '1.0.0') {
  const now = Date.now();
  if (updateNoticeCache !== null && now - lastCheckTime < CHECK_INTERVAL) {
    return updateNoticeCache;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500); // 1.5 秒超时保护

    const res = await fetch('https://raw.githubusercontent.com/gbxhq/ilinks-mcp/main/package.json', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return '';
    }

    const pkg = await res.json();
    lastCheckTime = now;

    if (pkg && pkg.version && isNewerVersion(currentVersion, pkg.version)) {
      updateNoticeCache = `\n\n💡 [新版本提示] iLinks MCP 插件已有新版本 v${pkg.version}（当前运行 v${currentVersion}）。若使用 npx，重启客户端即可自动加载最新版；若使用本地源码，可在目录执行 git pull 更新。`;
      return updateNoticeCache;
    }

    updateNoticeCache = '';
    return '';
  } catch {
    // 任何网络异常或超时直接忽略，绝不中断正常业务
    return '';
  }
}
