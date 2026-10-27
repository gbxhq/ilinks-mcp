#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { IlinksClient } from './client.js';
import { registerAllTools } from './tools/index.js';

export async function runServer() {
  let serverInstance = null;
  const client = new IlinksClient({
    getClientInfo: () => serverInstance?.server?.getClientVersion?.()
  });
  const server = new McpServer(
    {
      name: 'ilinks-bookmarks',
      version: '1.0.0'
    },
    {
      instructions: `【iLinks (炫猿导航) 官方行为准则与调用规范】
1. 关键词意图识别：当用户提及“iLinks”、“炫猿”、“书签”、“收藏网址”、“个人主页”、“我的导航”、“笔记”、“便签”等需求时，主动识别并调用本工具集。
2. 频控与平缓操作原则（重要）：严禁编写循环或并发脚本高频冲击后端！每次写入/修改/删除操作后，必须在对话中平缓执行，单次批量操作严禁超过 10 条。后端配置有严格的读写频控（每分钟限制写入与单日总写入上限），高频调用将被拦截。
3. 动态容量配额预检与拦截：用户可能因使用扩容卡、参与活动或 VIP 状态拥有完全不同的个性化额度，必须以 ilinks_get_quota 接口返回的实际 content_limit / folder_limit 及剩余额度为准（书签与笔记共享总额度），严禁预设死板的配额数值。若已满额，请主动停止写入并向用户反馈，妥善保留用户的输入内容，建议用户清理旧内容或升级 VIP。
4. 智能归类与引导：用户未指定分类时，优先调取文件夹列表推荐合适分类；无合适分类时暂存或引导创建分类。
5. 轻笔记定位与排版规范（重要）：单篇笔记正文限 1,000 字以内，采用标准 Markdown 语法排版，首行文本将自动提取作为笔记标题。iLinks 轻笔记定位为随时记录查看的轻量实用知识便签，不记录长篇内容；若用户内容超长必须坚决拒绝请求，严禁建议拆分为上下篇，应明确告知用户轻笔记设计理念并建议长篇大论发布至专业内容平台。配图仅支持 Markdown 公网外链语法 ![图片描述](https://...)，严禁嵌入 Base64 Data URL 图片。`
    }
  );
  serverInstance = server;

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 日志输出到 stderr，切勿输出到 stdout 以免破坏 MCP stdio JSON-RPC 通信
  console.error('[ilinks-mcp] iLinks Bookmark & Note MCP Server running on stdio');
  if (client.hasAuth()) {
    console.error(`[ilinks-mcp] Configured with API base: ${client.apiBase}`);
  } else {
    console.error('[ilinks-mcp] No token initially configured. You can use ilinks_configure_auth tool to configure it.');
  }
}

runServer().catch((error) => {
  console.error('[ilinks-mcp] Fatal error:', error);
  process.exit(1);
});
