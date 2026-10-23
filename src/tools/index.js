import { z } from 'zod';
import { getUpdateNotice } from '../updater.js';

/**
 * 格式化配额文本
 */
export function formatQuotaSummary(quota) {
  const vipText = quota.is_vip ? `VIP 会员 (有效期至: ${quota.vip_time})` : '普通会员';
  const contentRem = quota.is_vip ? '无限制' : `${quota.content_remaining} 条`;
  const folderRem = quota.is_vip ? '无限制' : `${quota.folder_remaining} 个`;

  return [
    `【iLinks 账号与容量配额】`,
    `用户: ${quota.user_name} (ID: ${quota.user_id}) | 账号身份: ${vipText}`,
    `----------------------------------------`,
    `📌 书签与笔记总用量: ${quota.content_count} / ${quota.content_limit} 条 (剩余额度: ${contentRem})`,
    `   └ 书签: ${quota.link_count} 条 | 笔记: ${quota.note_count} 条 (共享容量)`,
    `📁 文件夹数量: ${quota.folder_count} / ${quota.folder_limit} 个 (剩余可用: ${folderRem})`,
    `📥 暂存箱使用: ${quota.temp_count} / ${quota.temp_limit} 条 (剩余容量: ${quota.temp_remaining} 条)`,
    quota.is_banned ? `⚠️ 警告: 该账号处于封禁状态，无法继续添加内容。` : ''
  ].filter(Boolean).join('\n');
}

/**
 * 注册所有工具到 McpServer
 */
export function registerAllTools(server, client) {
  // 1. 配置认证 Token
  server.tool(
    'ilinks_configure_auth',
    '设置或切换 iLinks 认证 Token。若未配置环境变量或需要切换账号时使用。设置后会自动验证并返回账号及容量详情。',
    {
      token: z.string().describe('用户的 iLinks 密钥 (js_token)，可在网页控制台个人中心查看并复制'),
      api_base: z.string().optional().describe('iLinks API 地址，默认为 https://ilinks.fun')
    },
    async ({ token, api_base }) => {
      client.setAuth(token, api_base);
      try {
        const quota = await client.getQuota();
        return {
          content: [
            {
              type: 'text',
              text: `✅ 认证配置成功！已连接到 ${client.apiBase}\n\n${formatQuotaSummary(quota)}`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `❌ Token 验证失败: ${err.message}。请核对 Token 是否正确。`
            }
          ]
        };
      }
    }
  );

  // 2. 查询容量配额
  server.tool(
    'ilinks_get_quota',
    '查询当前登录用户的书签与文件夹容量配额，包括已使用量、上限、剩余可用量以及 VIP 状态。在添加书签或文件夹前推荐先检查容量。',
    {},
    async () => {
      try {
        const quota = await client.getQuota();
        const updateNotice = await getUpdateNotice('1.0.0');
        return {
          content: [
            {
              type: 'text',
              text: `${formatQuotaSummary(quota)}${updateNotice}`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `查询配额失败: ${err.message}` }]
        };
      }
    }
  );

  // 3. 列出所有文件夹
  server.tool(
    'ilinks_list_folders',
    '获取用户的所有文件夹列表。包含文件夹 ID、名称、类型 (bookmark/note)、图标、排序权重等。可用于在新增书签前确定目标分类文件夹。',
    {},
    async () => {
      try {
        const folders = await client.listFolders();
        if (!folders || folders.length === 0) {
          return {
            content: [{ type: 'text', text: '暂无文件夹。可通过 `ilinks_create_folder` 创建分类文件夹。' }]
          };
        }

        const lines = ['【您的文件夹分类列表】'];
        folders.forEach((f) => {
          const typeTag = f.content_type === 'note' ? '[笔记]' : '[书签]';
          const lockTag = f.need_password ? ' 🔒(密码保护)' : '';
          const info = f.info ? ` - ${f.info}` : '';
          lines.push(`• [ID: ${f.id}] ${typeTag} ${f.name}${lockTag}${info}`);
        });

        lines.push(`\n提示: 存入书签时，可指定上述对应的文件夹 ID。若不指定将自动放入暂存箱 (ID: 0)。`);

        return {
          content: [{ type: 'text', text: lines.join('\n') }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `获取文件夹列表失败: ${err.message}` }]
        };
      }
    }
  );

  // 4. 创建文件夹 (内置容量限制拦截)
  server.tool(
    'ilinks_create_folder',
    '创建新的书签或笔记文件夹。创建前会自动进行容量预检，达到文件夹上限时将自动拦截并提示。',
    {
      name: z.string().min(1).max(30).describe('文件夹名称 (1-30字符)'),
      content_type: z.enum(['bookmark', 'note']).default('bookmark').describe('文件夹类型：bookmark (书签) 或 note (笔记)'),
      icon: z.string().optional().describe('图标名称或图标 URL'),
      info: z.string().max(30).optional().describe('文件夹描述说明 (0-30字符)'),
      password: z.string().max(16).optional().describe('访问密码（可选，设置后公开页面需密码才能查看内容）')
    },
    async ({ name, content_type = 'bookmark', icon = '', info = '', password = '' }) => {
      try {
        // 容量前置预检
        const quota = await client.getQuota();
        if (!quota.is_vip && quota.folder_remaining <= 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: [
                  `🚫【文件夹容量已满拦截】`,
                  `您当前已创建 ${quota.folder_count} 个文件夹，已达到系统上限 (${quota.folder_limit} 个)！无法创建新文件夹。`,
                  `\n💡 建议操作：`,
                  `1. 使用 \`ilinks_delete_folder\` 删除不再需要的旧文件夹以释放名额；`,
                  `2. 升级为 VIP 会员享受无限文件夹与无限书签额度。`
                ].join('\n')
              }
            ]
          };
        }

        const res = await client.createFolder({
          name,
          content_type,
          icon,
          info,
          password
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ 文件夹「${name}」创建成功！(当前文件夹总数: ${quota.folder_count + 1}/${quota.folder_limit})`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `创建文件夹失败: ${err.message}` }]
        };
      }
    }
  );

  // 5. 更新文件夹
  server.tool(
    'ilinks_update_folder',
    '修改现有文件夹的名称、图标、描述或密码。',
    {
      id: z.number().describe('文件夹 ID'),
      name: z.string().min(1).max(30).describe('文件夹新名称'),
      content_type: z.enum(['bookmark', 'note']).default('bookmark').describe('文件夹类型'),
      icon: z.string().optional().describe('图标'),
      info: z.string().max(30).optional().describe('描述'),
      password: z.string().max(16).optional().describe('密码（留空表示不修改或清空）')
    },
    async ({ id, name, content_type = 'bookmark', icon = '', info = '', password = '' }) => {
      try {
        await client.updateFolder({
          id,
          name,
          content_type,
          icon,
          info,
          password
        });
        return {
          content: [{ type: 'text', text: `✅ 文件夹 #${id}「${name}」已成功更新。` }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `更新文件夹失败: ${err.message}` }]
        };
      }
    }
  );

  // 6. 删除文件夹
  server.tool(
    'ilinks_delete_folder',
    '删除指定 ID 的文件夹。注意：请先确认该文件夹下的书签已清理或转移，谨慎删除。',
    {
      id: z.number().describe('要删除的文件夹 ID')
    },
    async ({ id }) => {
      try {
        await client.deleteFolder(id);
        return {
          content: [{ type: 'text', text: `✅ 文件夹 #${id} 已成功删除，释放了 1 个文件夹配额空间。` }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `删除文件夹失败: ${err.message}` }]
        };
      }
    }
  );

  // 7. 查看书签列表
  server.tool(
    'ilinks_list_bookmarks',
    '查看当前用户的书签列表。支持按文件夹 ID 过滤，或查看暂存箱 (folder_id=0)。支持分页限制 limit 与 offset。',
    {
      folder_id: z.number().optional().describe('文件夹 ID。传 0 则仅查看暂存箱，不传则查看全部书签'),
      limit: z.number().default(50).describe('单次返回数量 (默认 50)'),
      offset: z.number().default(0).describe('偏移量 (默认 0)')
    },
    async ({ folder_id, limit = 50, offset = 0 }) => {
      try {
        let bookmarks = [];
        let title = '全部书签';

        if (folder_id === 0) {
          bookmarks = await client.listTempBookmarks();
          title = '暂存箱书签 (未分类)';
        } else {
          bookmarks = await client.listBookmarks();
          if (folder_id !== undefined) {
            bookmarks = bookmarks.filter((b) => b.fid === folder_id);
            title = `文件夹 #${folder_id} 下的书签`;
          }
        }

        const total = bookmarks.length;
        const page = bookmarks.slice(offset, offset + limit);

        if (page.length === 0) {
          return {
            content: [{ type: 'text', text: `【${title}】暂无书签。` }]
          };
        }

        const lines = [`【${title}】(共 ${total} 条，当前显示 ${offset + 1} - ${offset + page.length} 条):`];
        page.forEach((b) => {
          const info = b.info ? ` | 备注: ${b.info}` : '';
          const folderTag = b.fid === 0 ? '[暂存箱]' : `[文件夹 #${b.fid}]`;
          lines.push(`• [#${b.id}] ${b.name} - ${b.url} ${folderTag}${info}`);
        });

        return {
          content: [{ type: 'text', text: lines.join('\n') }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `获取书签失败: ${err.message}` }]
        };
      }
    }
  );

  // 8. 搜索书签
  server.tool(
    'ilinks_search_bookmarks',
    '根据关键词搜索用户已保存的书签，对名称、URL 或备注进行多字段智能匹配。',
    {
      query: z.string().min(1).describe('搜索关键词'),
      folder_id: z.number().optional().describe('可选限定在特定文件夹内搜索')
    },
    async ({ query, folder_id }) => {
      try {
        const bookmarks = await client.listBookmarks();
        const kw = query.toLowerCase().trim();

        const results = bookmarks.filter((b) => {
          if (folder_id !== undefined && b.fid !== folder_id) {
            return false;
          }
          const nameMatch = (b.name || '').toLowerCase().includes(kw);
          const urlMatch = (b.url || '').toLowerCase().includes(kw);
          const infoMatch = (b.info || '').toLowerCase().includes(kw);
          return nameMatch || urlMatch || infoMatch;
        });

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `未找到包含关键词「${query}」的书签。` }]
          };
        }

        const lines = [`🔍 找到 ${results.length} 条匹配「${query}」的书签:`];
        results.forEach((b) => {
          const folderTag = b.fid === 0 ? '[暂存箱]' : `[文件夹 #${b.fid}]`;
          const info = b.info ? ` | 备注: ${b.info}` : '';
          lines.push(`• [#${b.id}] ${b.name} - ${b.url} ${folderTag}${info}`);
        });

        return {
          content: [{ type: 'text', text: lines.join('\n') }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `搜索书签失败: ${err.message}` }]
        };
      }
    }
  );

  // 9. 创建单个书签 (内置严格容量限制拦截)
  server.tool(
    'ilinks_create_bookmark',
    '向指定文件夹或暂存箱添加新书签。内置严格的容量配额预检与拦截机制，书签容量满或暂存箱满时将精准拦截并告知用户。',
    {
      title: z.string().min(1).max(100).describe('书签标题/网站名称 (1-100字符)'),
      url: z.string().url().describe('网页链接，必须以 http:// 或 https:// 开头'),
      folder_id: z.number().default(0).describe('目标文件夹 ID。填 0 或不填则存入暂存箱'),
      info: z.string().max(500).optional().describe('书签备注或简介 (0-500字符)'),
      icon: z.string().max(255).optional().describe('网站图标 URL (可选)')
    },
    async ({ title, url, folder_id = 0, info = '', icon = '' }) => {
      try {
        // 容量前置预检
        const quota = await client.getQuota();

        // 1. 检查总书签+笔记配额
        if (!quota.is_vip && quota.content_remaining <= 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: [
                  `🚫【书签容量已满拦截】`,
                  `您当前书签使用量已达上限 (${quota.content_count} / ${quota.content_limit} 条)！`,
                  `本次添加「${title}」已被安全拦截，未能写入。`,
                  `\n💡 建议操作：`,
                  `1. 使用 \`ilinks_search_bookmarks\` 搜索并清理不再需要的旧书签，释放容量空间；`,
                  `2. 升级为 VIP 会员解锁无限书签与无限笔记存储。`
                ].join('\n')
              }
            ]
          };
        }

        // 2. 检查暂存箱配额 (folder_id === 0)
        if (folder_id === 0 && quota.temp_remaining <= 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: [
                  `🚫【暂存箱已满拦截】`,
                  `您当前的暂存箱已有 ${quota.temp_count} / ${quota.temp_limit} 条书签，已达暂存箱上限！`,
                  `本次添加「${title}」已被拦截。`,
                  `\n💡 建议操作：`,
                  `1. 使用 \`ilinks_list_folders\` 查看您的分类文件夹，并在添加时指定具体的 \`folder_id\`；`,
                  `2. 整理暂存箱中的已有书签，将其移动归档到相应文件夹。`
                ].join('\n')
              }
            ]
          };
        }

        // 提交添加请求
        await client.createBookmark({
          fid: folder_id,
          name: title,
          url,
          info,
          icon
        });

        const targetFolderDesc = folder_id === 0 ? '暂存箱 (未分类)' : `文件夹 #${folder_id}`;
        const newRem = quota.is_vip ? '无限制' : `${quota.content_remaining - 1} 条`;

        return {
          content: [
            {
              type: 'text',
              text: [
                `✅ 书签「${title}」添加成功！`,
                `- 网址: ${url}`,
                `- 归类位置: ${targetFolderDesc}`,
                `- 剩余书签容量: ${newRem}`
              ].join('\n')
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `添加书签失败: ${err.message}` }]
        };
      }
    }
  );

  // 10. 批量创建书签 (内置批量容量预检与拦截)
  server.tool(
    'ilinks_batch_create_bookmarks',
    '批量添加多个书签到指定文件夹。单次最多 50 条。执行前会自动严格校验剩余容量，容量不足时提前拦截保护。',
    {
      folder_id: z.number().min(1).describe('目标文件夹 ID (必须指定具体文件夹，批量添加不支持暂存箱)'),
      bookmarks: z
        .array(
          z.object({
            title: z.string().min(1).describe('书签标题'),
            url: z.string().url().describe('网页链接'),
            info: z.string().optional().describe('备注说明'),
            icon: z.string().optional().describe('图标')
          })
        )
        .min(1)
        .max(50)
        .describe('书签对象数组，最多 50 条')
    },
    async ({ folder_id, bookmarks }) => {
      try {
        const count = bookmarks.length;
        const quota = await client.getQuota();

        // 批量容量前置预检
        if (!quota.is_vip && count > quota.content_remaining) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: [
                  `🚫【批量添加容量不足拦截】`,
                  `您尝试批量添加 ${count} 条书签，但当前剩余可用额度仅为 ${quota.content_remaining} 条 (当前总用量: ${quota.content_count}/${quota.content_limit} 条)！`,
                  `为了保证数据一致性，本次批量添加已全部拦截。`,
                  `\n💡 建议操作：`,
                  `1. 拆分本次书签列表，仅添加前 ${quota.content_remaining} 条；`,
                  `2. 删除已废弃的旧书签释放配额；`,
                  `3. 升级为 VIP 会员享受无限存储配额。`
                ].join('\n')
              }
            ]
          };
        }

        await client.batchCreateBookmarks({
          folder_id,
          links: bookmarks.map((b) => ({
            name: b.title,
            url: b.url,
            info: b.info || '',
            icon: b.icon || ''
          }))
        });

        const newRem = quota.is_vip ? '无限制' : `${quota.content_remaining - count} 条`;

        return {
          content: [
            {
              type: 'text',
              text: `✅ 成功批量添加 ${count} 条书签到文件夹 #${folder_id}！剩余可用容量: ${newRem}。`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `批量添加失败: ${err.message}` }]
        };
      }
    }
  );

  // 11. 更新书签
  server.tool(
    'ilinks_update_bookmark',
    '更新书签的标题、网址、所属文件夹或备注信息。',
    {
      id: z.number().describe('书签 ID'),
      folder_id: z.number().describe('新的文件夹 ID (不可填 0，若要移至暂存箱请使用 ilinks_move_to_temp)'),
      title: z.string().min(1).max(100).describe('书签标题'),
      url: z.string().url().describe('网页链接'),
      info: z.string().max(500).optional().describe('备注说明'),
      icon: z.string().max(255).optional().describe('网站图标')
    },
    async ({ id, folder_id, title, url, info = '', icon = '' }) => {
      try {
        await client.updateBookmark({
          id,
          fid: folder_id,
          name: title,
          url,
          info,
          icon
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ 书签 #${id}「${title}」已成功更新并移至文件夹 #${folder_id}。`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `更新书签失败: ${err.message}` }]
        };
      }
    }
  );

  // 12. 删除书签 (释放容量)
  server.tool(
    'ilinks_delete_bookmark',
    '删除指定 ID 的书签。删除后将立即释放 1 个书签容量配额空间。',
    {
      id: z.number().describe('要删除的书签 ID')
    },
    async ({ id }) => {
      try {
        await client.deleteBookmark(id);
        return {
          content: [
            {
              type: 'text',
              text: `✅ 书签 #${id} 已成功删除，释放了 1 个书签容量配额。`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `删除书签失败: ${err.message}` }]
        };
      }
    }
  );

  // 13. 将书签移入暂存箱
  server.tool(
    'ilinks_move_to_temp',
    '将指定 ID 的书签移入暂存箱 (未分类)。移入前会检查暂存箱是否有余量。',
    {
      id: z.number().describe('要移动的书签 ID')
    },
    async ({ id }) => {
      try {
        const quota = await client.getQuota();
        if (quota.temp_remaining <= 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `🚫【暂存箱已满】暂存箱已有 ${quota.temp_count}/${quota.temp_limit} 条书签，已达上限，无法移入。请先清理暂存箱。`
              }
            ]
          };
        }

        await client.moveToTemp(id);
        return {
          content: [{ type: 'text', text: `✅ 书签 #${id} 已移入暂存箱。\n\n(提示: 操作已完成。请注意操作频控，避免连续高频写入，下次写操作建议间隔 2 秒以上)` }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `移至暂存箱失败: ${err.message}` }]
        };
      }
    }
  );

  // 14. 查看与搜索笔记列表
  server.tool(
    'ilinks_list_notes',
    '获取用户的笔记列表。当用户要求查看笔记、搜索笔记或需要查看笔记内容时调用。支持按笔记分类文件夹 ID 过滤，或使用关键词在正文模糊搜索。',
    {
      folder_id: z.number().optional().describe('可选：指定笔记文件夹 ID 进行筛选。若不指定则查询全部笔记'),
      keyword: z.string().optional().describe('可选：搜索关键词，按笔记标题或正文内容模糊匹配'),
      limit: z.number().optional().describe('可选：返回记录数限制，默认 20 条，最大 50 条')
    },
    async ({ folder_id, keyword, limit = 20 }) => {
      try {
        let notes = await client.listNotes({ folder_id, limit: 50 });
        if (keyword && keyword.trim()) {
          const q = keyword.trim().toLowerCase();
          notes = notes.filter((n) => {
            const content = (n.content || '').toLowerCase();
            const firstLine = (n.first_line || '').toLowerCase();
            const summary = (n.summary || '').toLowerCase();
            return content.includes(q) || firstLine.includes(q) || summary.includes(q);
          });
        }

        if (!notes || notes.length === 0) {
          return {
            content: [{
              type: 'text',
              text: keyword ? `未找到包含关键词 "${keyword}" 的笔记。` : '暂无笔记记录。可通过 `ilinks_create_note` 发布新笔记。'
            }]
          };
        }

        const displayNotes = notes.slice(0, Math.min(limit || 20, 50));
        const lines = [`【您的 iLinks 笔记列表 (共 ${notes.length} 条)】`];
        displayNotes.forEach((note) => {
          const title = note.first_line || note.summary || `笔记 #${note.id}`;
          const date = (note.updated_at || note.created_at || '').slice(0, 10);
          const comments = note.comment_count ? ` 💬${note.comment_count}` : '';
          const likes = note.like_count ? ` 👍${note.like_count}` : '';
          lines.push(`• [ID: ${note.id}] (分类ID: ${note.fid}) ${title} (${date})${comments}${likes}`);
        });

        lines.push(`\n提示: 可通过 \`ilinks_get_note\` 传入笔记 ID 查看完整 Markdown 正文内容。`);
        return {
          content: [{ type: 'text', text: lines.join('\n') }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `获取笔记列表失败: ${err.message}` }]
        };
      }
    }
  );

  // 15. 查看单篇笔记详情
  server.tool(
    'ilinks_get_note',
    '根据笔记 ID 查看单篇笔记的完整详情。包含 Markdown 正文、所属分类、发布时间及评论。',
    {
      id: z.number().describe('笔记 ID')
    },
    async ({ id }) => {
      try {
        const notes = await client.listNotes();
        const note = (notes || []).find((n) => n.id === id);
        if (!note) {
          return {
            isError: true,
            content: [{ type: 'text', text: `未找到 ID 为 ${id} 的笔记。` }]
          };
        }

        const lines = [
          `【笔记详情 (ID: ${note.id})】`,
          `所属分类文件夹 ID: ${note.fid}`,
          `创建时间: ${note.created_at} | 更新时间: ${note.updated_at || note.created_at}`,
          `互动统计: 评论 ${note.comment_count || 0} 条 | 点赞 ${note.like_count || 0} 次`,
          `----------------------------------------`,
          note.content || '（正文为空）'
        ];

        return {
          content: [{ type: 'text', text: lines.join('\n') }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `获取笔记详情失败: ${err.message}` }]
        };
      }
    }
  );

  // 16. 发布新笔记
  server.tool(
    'ilinks_create_note',
    '发布一篇新笔记。正文支持完整 Markdown 语法（单篇限 20,000 字以内，首行自动作为笔记标题；若含图片仅支持 Markdown 外链语法 ![描述](https://...)，严禁 Base64 编码）。发布前自动预检书签与笔记共享容量配额（普通用户 188 条上限），若容量已满主动拦截保护。【频控约束】严禁连续高频并发写入，每次调用后需间隔至少 2 秒。',
    {
      content: z.string().max(20000).describe('笔记正文，必须为标准 Markdown 格式，单篇限 20,000 字以内。首行自动提取为标题。配图必须使用公网图片 URL 外链格式 ![描述](https://...)，严禁使用 Base64 图片'),
      folder_id: z.number().optional().describe('可选：目标笔记分类文件夹 ID。若未提供将自动匹配或引导创建笔记分类'),
      weight: z.number().optional().describe('可选：排序权重，数字越大越靠前，默认 0')
    },
    async ({ content, folder_id, weight = 0 }) => {
      try {
        // 0. Base64 图片防护拦截
        if (content.includes('data:image/')) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: '🚫【图片格式不支持】iLinks 笔记暂不支持直接嵌入 Base64 图片，这会导致内容极速超出 20,000 字限制。请将图片托管于外部图床/公网地址后，以标准 Markdown 外链形式写入：`![图片描述](https://...)`。'
              }
            ]
          };
        }

        // 1. 容量配额预检拦截
        const quota = await client.getQuota();
        if (!quota.is_vip && quota.content_remaining <= 0) {
          return {
            content: [
              {
                type: 'text',
                text: [
                  `🛑【容量已达上限，已主动安全拦截】`,
                  `您的 iLinks 书签与笔记共享容量已达到上限 (${quota.content_limit} 条)，无法发布新笔记。`,
                  `当前书签: ${quota.link_count} 条，笔记: ${quota.note_count} 条。`,
                  ``,
                  `💡 优化指引：`,
                  `1. 可通过 \`ilinks_delete_bookmark\` 或 \`ilinks_delete_note\` 删除不再需要的旧内容以释放容量；`,
                  `2. 升级 VIP 会员解锁无限容量。`,
                  ``,
                  `📝 您的笔记内容草稿已妥善留存如下，不会丢失：`,
                  content
                ].join('\n')
              }
            ]
          };
        }

        // 2. 文件夹解析与校验
        let targetFid = folder_id;
        const folders = await client.listFolders();
        const noteFolders = (folders || []).filter((f) => f.content_type === 'note');

        if (!targetFid) {
          if (noteFolders.length > 0) {
            targetFid = noteFolders[0].id;
          } else {
            // 没有笔记文件夹，检查文件夹容量
            if (!quota.is_vip && quota.folder_remaining <= 0) {
              return {
                isError: true,
                content: [{
                  type: 'text',
                  text: `无法发布笔记：您当前尚未创建【笔记】分类文件夹，且文件夹容量已满 (${quota.folder_limit} 个)。请先删除无用文件夹或创建笔记分类。`
                }]
              };
            }
            // 自动创建一个默认笔记文件夹
            const newFolder = await client.createFolder({
              name: '我的笔记',
              content_type: 'note',
              info: 'AI 自动创建的笔记分类'
            });
            targetFid = newFolder.id;
          }
        } else {
          const match = (folders || []).find((f) => f.id === targetFid);
          if (match && match.content_type !== 'note') {
            return {
              isError: true,
              content: [{
                type: 'text',
                text: `目标文件夹 [ID: ${targetFid}] "${match.name}" 是【书签】文件夹，不能存放笔记。请指定笔记文件夹，或通过 \`ilinks_create_folder\` 创建笔记分类。`
              }]
            };
          }
        }

        const res = await client.createNote({
          fid: targetFid,
          content,
          weight
        });

        const newId = res && res.id ? res.id : '成功';
        return {
          content: [
            {
              type: 'text',
              text: `✅ 笔记发布成功！[ID: ${newId}] 已归入分类文件夹 #${targetFid}。\n\n(提示: 操作已完成。请注意操作频控，避免连续高频写入，下次写操作建议间隔 2 秒以上)`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `发布笔记失败: ${err.message}` }]
        };
      }
    }
  );

  // 17. 更新笔记
  server.tool(
    'ilinks_update_note',
    '更新已有笔记的正文内容、所属分类文件夹或排序权重。正文支持完整 Markdown 语法（单篇限 20,000 字以内，首行自动提取为标题；配图仅支持外链格式 ![描述](https://...)，严禁 Base64）。【频控约束】严禁连续高频并发写入，每次调用后需间隔至少 2 秒。',
    {
      id: z.number().describe('要修改的笔记 ID'),
      content: z.string().max(20000).describe('修改后的完整笔记正文内容 (Markdown 格式，限 20,000 字内；首行自动提取为标题；配图仅限外链格式 ![描述](https://...)，严禁 Base64)'),
      folder_id: z.number().optional().describe('可选：修改归属的笔记分类文件夹 ID。若不填则保持原分类不变'),
      weight: z.number().optional().describe('可选：排序权重')
    },
    async ({ id, content, folder_id, weight = 0 }) => {
      try {
        // 0. Base64 图片防护拦截
        if (content.includes('data:image/')) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: '🚫【图片格式不支持】iLinks 笔记暂不支持直接嵌入 Base64 图片，这会导致内容极速超出 20,000 字限制。请将图片托管于外部图床/公网地址后，以标准 Markdown 外链形式写入：`![图片描述](https://...)`。'
              }
            ]
          };
        }
        let fid = folder_id;
        if (!fid) {
          const notes = await client.listNotes();
          const target = (notes || []).find((n) => n.id === id);
          if (target) {
            fid = target.fid;
          }
        }

        if (!fid) {
          return {
            isError: true,
            content: [{ type: 'text', text: `未找到笔记 #${id} 的原始所属文件夹，请显式提供 folder_id 参数。` }]
          };
        }

        await client.updateNote({
          id,
          fid,
          content,
          weight
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ 笔记 #${id} 已成功更新！\n\n(提示: 操作已完成。请注意操作频控，避免连续高频写入，下次写操作建议间隔 2 秒以上)`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `更新笔记失败: ${err.message}` }]
        };
      }
    }
  );

  // 18. 删除笔记
  server.tool(
    'ilinks_delete_note',
    '删除指定 ID 的笔记。删除后将立即释放 1 个内容容量配额空间，便于继续保存新书签或发布新笔记。【频控约束】严禁连续高频并发写入，每次调用后需间隔至少 2 秒。',
    {
      id: z.number().describe('要删除的笔记 ID')
    },
    async ({ id }) => {
      try {
        await client.deleteNote(id);
        const quota = await client.getQuota();
        const rem = quota.is_vip ? '无限制' : `${quota.content_remaining} 条`;
        return {
          content: [
            {
              type: 'text',
              text: `✅ 笔记 #${id} 已成功删除，释放了 1 个容量配额。\n当前总容量已用: ${quota.content_count}/${quota.content_limit} 条 (剩余可用: ${rem})。\n\n(提示: 操作已完成。请注意操作频控，避免连续高频写入，下次写操作建议间隔 2 秒以上)`
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `删除笔记失败: ${err.message}` }]
        };
      }
    }
  );
}

