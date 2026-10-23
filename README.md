# iLinks 官方 MCP 服务 (`ilinks-mcp`)

`ilinks-mcp` 是 iLinks 导航官方基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 标准协议构建的 AI Agent 书签管理服务。

无论您使用的是 **WorkBuddy**、各类桌面 AI 助手，还是自建的 Agent 系统，都可以直接接入。您只需要像平常聊天一样对 Agent 发出自然语言指令，就能完成书签与文件夹的检索、添加、智能归类、更新、删除与容量治理。

---

## 🌟 核心特性

- 🔐 **个人专属秘钥接入**：登录 iLinks 后台即可一键复制 Token。
- 📊 **智能配额与安全拦截**：
  - 普通用户：书签+笔记配额默认 **188 条**，文件夹 **18 个**，暂存箱 **100 条**；VIP 用户无上限。
  - **容量超额拦截保护**：新增前自动预检，超限时主动拦截并给出清晰原因与优化指引，保护已有数据安全。
- 🔍 **多字段智能搜索**：支持在标题、URL、备注中进行模糊匹配。
- 📁 **分类归档与暂存**：支持指定分类存放，未指定时可放入暂存箱后续整理。
- 📦 **批量操作支持**：支持单次最多批量添加 50 条书签，并预检剩余容量。
- 🤖 **Agent 自动安装 Prompt**：支持一键将 Prompt 发送给 Agent 自动完成安装与挂载。

---

## 🛠️ 工具集 (Tools)

| 工具名称 | 功能描述 | 容量检查 |
| :--- | :--- | :---: |
| `ilinks_get_quota` | 查询当前账号的详细容量配额与 VIP 状态 | - |
| `ilinks_list_folders` | 获取所有分类文件夹列表（ID、名称、类型、图标） | - |
| `ilinks_create_folder` | 创建新的分类文件夹 | ✅ 满额拦截 |
| `ilinks_update_folder` | 修改文件夹名称、图标、描述或密码 | - |
| `ilinks_delete_folder` | 删除指定文件夹（释放 1 个文件夹配额） | - |
| `ilinks_list_bookmarks` | 查看全部书签、特定分类书签或暂存箱 | - |
| `ilinks_search_bookmarks` | 按关键词模糊搜索书签（名称/网址/备注） | - |
| `ilinks_create_bookmark` | 添加单个书签至指定分类或暂存箱 | ✅ 满额拦截 |
| `ilinks_batch_create_bookmarks` | 批量添加多条书签至指定分类 | ✅ 批量预检拦截 |
| `ilinks_update_bookmark` | 修改书签标题、链接、所属分类或备注 | - |
| `ilinks_delete_bookmark` | 删除书签（立即释放 1 个书签配额） | - |
| `ilinks_move_to_temp` | 将书签移入暂存箱 | ✅ 暂存箱满拦截 |
| `ilinks_configure_auth` | 运行时动态配置或切换当前 Token | - |

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
你是一个智能工作伙伴。我现在需要你帮我接入 iLinks 个人书签管理的 MCP 插件。

以下是服务接入信息：
- 插件服务名：ilinks-bookmarks
- API 接口地址 (ILINKS_API_BASE)：https://ilinks.fun
- 我的个人专属 Token (ILINKS_TOKEN)：【请填入您的Token】

请你执行以下步骤：
1. 检测当前环境是否能通过 `npx -y ilinks-mcp` 启动服务；如果 npm 仓库中已有此包，直接配置 npx 启动；
2. 如果 npm 尚未发布此包，请帮我在本地目录（如 ~/.ilinks-mcp）配置源码或启动脚本，并通过 node 执行 `bin/ilinks-mcp.js`；
3. 将该服务配置添加到当前客户端的 MCP 配置文件中（服务名: ilinks-bookmarks）；
4. 启动并测试调用 `ilinks_get_quota` 工具，确认能够正常读取我的书签和文件夹配额；
5. 读取成功后，向我汇报我当前的账号容量情况（书签数、文件夹数、剩余配额、VIP状态）；
6. 后续当我需要查询、搜索、保存、整理或删除书签时，请直接调用该工具集完成。注意：书签和文件夹均有容量上限（普通用户书签188条/文件夹18个），满额时请主动拦截并提醒我清理旧书签或升级 VIP。
```

---

## 💬 常用对话指令示例

配置成功后，直接对您的 Agent 说话：
- **查容量**：“我目前的书签和分类用了多少，还有多少剩余空间？”
- **存书签**：“帮我把 https://news.ycombinator.com 存到 资讯 分类中，标题叫 Hacker News。”
- **智能分类**：“我想把这个链接存起来：https://github.com/gin-gonic/gin ，你看看我现有分类哪个合适？”
- **搜书签**：“搜一下我存过的关于 Python 或 Vue 的书签。”
- **改书签**：“把书签 #12 移动到 学习资料 文件夹。”
- **删书签**：“把那个失效的网址删掉，帮我腾出 1 个容量空间。”
