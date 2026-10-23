# iLinks 官方 MCP 服务 (`ilinks-mcp`)

`ilinks-mcp` 是 iLinks 导航官方基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 标准协议构建的 AI Agent 书签管理服务。

无论您使用的是 **WorkBuddy**、各类桌面 AI 助手，还是自建的 Agent 系统，都可以直接接入。您只需要像平常聊天一样对 Agent 发出自然语言指令，就能完成书签与文件夹的检索、添加、智能归类、更新、删除与容量治理。

---

## 🌟 核心特性

- 🔐 **个人专属秘钥接入**：登录 iLinks 后台即可一键复制 Token。
- 📊 **动态配额与安全拦截**：
  - **个性化动态配额**：根据用户真实数据（默认额度、扩容卡兑换、活动奖励或 VIP 会员）实时计算，书签与笔记共享总额度，以个人后台实际数据为准；VIP 用户无上限。
  - **容量超额拦截保护**：新增前自动预检，超限时主动拦截并给出清晰原因与优化指引，保护已有数据安全。
- 🔍 **多字段智能搜索**：支持在标题、URL、备注中进行模糊匹配。
- 📁 **分类归档与暂存**：支持指定分类存放，未指定时可放入暂存箱后续整理。
- 📦 **批量操作支持**：支持单次最多批量添加 50 条书签，并预检剩余容量。
- 🤖 **Agent 自动安装 Prompt**：支持一键将 Prompt 发送给 Agent 自动完成安装与挂载。

---

## 🛠️ 工具集全景 (Tools)

| 分类 | 工具名称 | 功能描述 | 容量检查 |
| :--- | :--- | :--- | :---: |
| **容量与分类** | `ilinks_get_quota` | 查询当前账号的书签与笔记容量配额及 VIP 状态 | - |
| | `ilinks_list_folders` | 获取分类文件夹列表（书签分类/笔记分类、ID、图标） | - |
| | `ilinks_create_folder` | 创建新分类文件夹（支持书签或笔记分类） | ✅ 满额拦截 |
| | `ilinks_update_folder` | 修改文件夹名称、图标、描述或密码 | - |
| | `ilinks_delete_folder` | 删除指定文件夹（释放 1 个文件夹配额） | - |
| **书签管理** | `ilinks_list_bookmarks` | 查看全部书签、特定分类书签或暂存箱 | - |
| | `ilinks_search_bookmarks` | 按关键词模糊搜索书签（名称/网址/备注） | - |
| | `ilinks_create_bookmark` | 添加单个书签至指定分类或暂存箱 | ✅ 满额拦截 |
| | `ilinks_batch_create_bookmarks` | 批量添加多条书签至指定分类（建议单次 <= 10 条） | ✅ 批量预检拦截 |
| | `ilinks_update_bookmark` | 修改书签标题、链接、所属分类或备注 | - |
| | `ilinks_delete_bookmark` | 删除书签（立即释放 1 个书签容量配额） | - |
| | `ilinks_move_to_temp` | 将书签移入暂存箱 | ✅ 暂存箱满拦截 |
| **笔记管理** | `ilinks_list_notes` | 查看或按关键词正文模糊搜索个人笔记列表 | - |
| | `ilinks_get_note` | 查看单篇笔记完整 Markdown 正文、发布时间与评论 | - |
| | `ilinks_create_note` | 发布新笔记（Markdown，单篇上限 20,000 字，配图仅限外链），自动预检共享容量 | ✅ 满额拦截 |
| | `ilinks_update_note` | 修改已有笔记的正文内容、所属分类或权重（限 20,000 字） | - |
| | `ilinks_delete_note` | 删除笔记（立即释放 1 个内容容量配额） | - |
| **认证配置** | `ilinks_configure_auth` | 运行时动态配置或切换当前 Token | - |

---

## 📝 笔记排版与格式规范

1. **单篇字数上限**：单篇笔记最长支持 **20,000 字**（数据库、后端 API 与前端编辑器三层严格校验）。超出将直接触发报错拦截。
2. **Markdown 语法与标题**：笔记正文全面支持标准 Markdown 语法（标题、列表、代码块、表格等）。系统会自动提取**首行非空文本**作为笔记标题。
3. **图片仅限公网外链（无内置图床）**：
   - iLinks 系统定位为轻量书签与便签体系，**不提供本地图片二进制文件上传服务**；
   - 笔记中如需配图，**必须使用标准 Markdown 公网图片外链**：`![图片描述](https://example.com/pic.png)`；
   - **严禁嵌入 Base64 Data URL 图片**（单张图片 Base64 即可超出 20,000 字并导致保存失败，工具层已内置自动拦截防护）。

---

## 🚦 操作频控与安全规范 (Rate Limiting)

为了防止 AI 循环高频并发冲击服务器并保障服务高可用，系统已建立**双层频控防护网**：

1. **协议层与 Prompt 指引（对 AI 的硬性要求）**：
   - MCP 服务初始化时通过官方标准 `instructions` 向宿主模型植入规范：**严禁编写循环或并发脚本高频写入！**
   - 每次写操作（新增/修改/删除）必须平缓执行，**两次写操作之间需间隔至少 2 秒**；
   - 批量添加书签单次不得超过 10 条。
2. **服务端后端硬核频控（多维计数防护）**：
   - **动态突发拦截**：写操作设有短期平缓频率保护，高频并发写入将被服务端直接拦截；
   - **单日累计安全限制**：设有单日总写入安全阈值，防止自动化脚本或爬虫刷写，次日 00:00 自动恢复；
   - **查询读取保护**：对密集批量查询设有自适应限流保护；
   - **双引擎保障**：服务端 Redis 计数优先，自动具备单机内存线程安全计数器降级兜底。

---

## 💡 AI 如何识别意图与关键词？

- **自动识别**：MCP 工具描述与系统指令已内置意图映射。当您对 AI 提到“帮我存这个网站”、“查一下我的书签”、“记一条笔记”、“还有多少空间”时，AI 会根据语义自动唤醒对应工具。
- **精准触发**：在指令中带上 **`iLinks`** 或 **`炫猿`**（例如：“帮我把这个链接存到我的 iLinks 导航”），可确保 100% 精准唤醒该工具集。


---

## 🚀 接入配置指南（以 WorkBuddy 等代表客户端为例）

### 1. 获取专属 Token
1. 登录 iLinks 网站：`https://ilinks.fun`；
2. 进入 **控制台 -> AI接入**，点击复制您的专属 Token。

---

### 2. 客户端配置方式

#### 方式 A：已发布到 npm 时的极简方式（npx 运行）
当作者将包发布到 npm 官方仓库后，客户端支持通过 `npx` 直接拉取运行：
```json
{
  "mcpServers": {
    "ilinks-bookmarks": {
      "command": "npx",
      "args": ["-y", "ilinks-mcp"],
      "env": {
        "ILINKS_API_BASE": "https://ilinks.fun",
        "ILINKS_TOKEN": "您的专属Token"
      }
    }
  }
}
```

> **提示（关于发布 npm）**：
> 如果您是开发者/站长，想要支持用户直接执行 `npx ilinks-mcp`，只需在 `ilinks-mcp` 目录下执行：
> ```bash
> npm login
> npm publish --access public
> ```
> 发布成功后，全网用户即可零门槛免下载运行！

---

#### 方式 B：未发布到 npm 时的本地 / 源码运行方式（立即可用）
在包尚未发布到 npm 官方仓库前，可通过本地克隆独立开源仓库源码的方式直接启动：

1. 克隆独立客户端开源代码到本地目录（例如 `~/.ilinks-mcp`）：
   ```bash
   git clone https://github.com/gbxhq/ilinks-mcp.git ~/.ilinks-mcp
   cd ~/.ilinks-mcp && npm install
   ```
2. 在 WorkBuddy 或其他客户端中配置绝对路径：
   ```json
   {
     "mcpServers": {
       "ilinks-bookmarks": {
         "command": "node",
         "args": ["/Users/您的用户名/.ilinks-mcp/bin/ilinks-mcp.js"],
         "env": {
           "ILINKS_API_BASE": "https://ilinks.fun",
           "ILINKS_TOKEN": "您的专属Token"
         }
       }
     }
   }
   ```

---

#### 方式 C：通过 Git 仓库直接运行（NPX 原生支持，免 npm 注册）
npx 支持直接指向独立的 GitHub 开源仓库，无需发布 npm：
```json
{
  "mcpServers": {
    "ilinks-bookmarks": {
      "command": "npx",
      "args": ["-y", "github:gbxhq/ilinks-mcp"],
      "env": {
        "ILINKS_API_BASE": "https://ilinks.fun",
        "ILINKS_TOKEN": "您的专属Token"
      }
    }
  }
}
```

---

## 🤖 一键发给 Agent 自动安装的智能 Prompt

如果您的 Agent 拥有终端执行或安装环境（如具备命令执行能力的本地工作伙伴）：
您可以直接将以下 Prompt 复制发给它，它会自动判断环境并完成本地安装与测试：

```text
请帮我安装并接入 iLinks 书签管理的 MCP 服务：

【服务信息】
- 服务名称：ilinks-bookmarks
- 环境变量：
  - ILINKS_API_BASE: https://ilinks.fun
  - ILINKS_TOKEN: 【请填入您的专属Token】
- 仓库地址：https://github.com/gbxhq/ilinks-mcp

【安装步骤】
1. 将该服务写入当前客户端的 MCP 配置文件中：
   - 方式 A（推荐）：command 为 "npx"，args 为 ["-y", "github:gbxhq/ilinks-mcp"]（或 ["-y", "ilinks-mcp"]）
   - 方式 B（本地源码）：git clone https://github.com/gbxhq/ilinks-mcp.git 到本地目录，执行 npm install，通过 node 运行 bin/ilinks-mcp.js
2. 启动服务并调用 `ilinks_get_quota` 测试连通性。
3. 详细功能说明、工具集规范及使用约束请阅读仓库 README 或通过工具列表获取。
4. 安装验证完成后，向我确认已接入成功即可。
```

---

## 💬 常用对话指令示例

配置成功后，直接对您的 Agent 说话（推荐带上 `iLinks` 或自然语言表达）：
- **查容量**：“查看我当前的 iLinks 书签与笔记容量，还有多少剩余空间？”
- **存书签**：“帮我把 https://news.ycombinator.com 存到 iLinks 的【资讯】分类中，标题叫 Hacker News。”
- **智能分类**：“我想存一下这个链接：https://github.com/gin-gonic/gin ，你看看我现有分类哪个最合适？”
- **发笔记**：“帮我在 iLinks 记一条笔记，内容是常用的 Docker 命令总结（带代码块）。”
- **看笔记**：“搜索一下我写过的关于 Vue 3 的笔记，并查看详情。”
- **改内容**：“把笔记 #10 的正文修改一下，补充两个技巧。”
- **删旧内容**：“把那个失效的书签或旧笔记删掉，帮我腾出 1 个容量名额。”

