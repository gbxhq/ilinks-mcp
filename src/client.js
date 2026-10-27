/**
 * iLinks API HTTP 客户端
 */

export class IlinksClient {
  constructor(options = {}) {
    this.apiBase = this.sanitizeApiBase(
      options.apiBase || process.env.ILINKS_API_BASE || process.env.XYDH_API_BASE || 'https://ilinks.fun'
    );
    this.token = (options.token || process.env.ILINKS_TOKEN || process.env.XYDH_TOKEN || '').trim();
    this.getClientInfo = typeof options.getClientInfo === 'function' ? options.getClientInfo : null;
  }

  sanitizeApiBase(base) {
    let url = String(base || 'https://ilinks.fun').trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url.replace(/\/+$/, '');
  }

  getAgentClientName() {
    let clientName = '';
    if (this.getClientInfo) {
      try {
        const info = this.getClientInfo();
        if (info && typeof info === 'object' && info.name) {
          clientName = String(info.name).trim();
        }
      } catch (e) {
        // ignore
      }
    }
    if (!clientName && process.env.ILINKS_AGENT_CLIENT) {
      clientName = String(process.env.ILINKS_AGENT_CLIENT).trim();
    }
    return clientName || 'AI Agent';
  }

  setAuth(token, apiBase) {
    if (token) this.token = String(token).trim();
    if (apiBase) this.apiBase = this.sanitizeApiBase(apiBase);
  }

  hasAuth() {
    return Boolean(this.token);
  }

  async request(path, options = {}) {
    if (!this.hasAuth()) {
      throw new Error(
        '未检测到 iLinks 认证 Token。请在启动配置中设置 ILINKS_TOKEN 环境变量，或通过工具 `ilinks_configure_auth` 填入您的秘钥 (可登录 iLinks 控制台复制)。'
      );
    }

    const agentClient = this.getAgentClientName();
    const url = `${this.apiBase}${path}`;
    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'X-Token': this.token,
      'X-Agent-Source': 'mcp',
      'X-Agent-Client': agentClient,
      ...(options.headers || {})
    };

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body
      });

      if (!response.ok) {
        throw new Error(`HTTP 异常 ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      if (json.code !== 0) {
        // 提取业务错误信息
        const msg = json.msg || json.error || '请求失败';
        const err = new Error(msg);
        err.code = json.code;
        err.raw = json;
        throw err;
      }

      return json.data;
    } catch (error) {
      if (error.code !== undefined) {
        throw error;
      }
      throw new Error(`连接 iLinks 服务失败 (${this.apiBase}): ${error.message}`);
    }
  }

  /**
   * 获取账号详细配额及容量统计
   */
  async getQuota() {
    return await this.request('/api/v1/user/quota');
  }

  /**
   * 获取账号基本详情
   */
  async getMe() {
    return await this.request('/api/v1/user/me');
  }

  /**
   * 获取所有文件夹列表
   */
  async listFolders() {
    return await this.request('/api/v1/myfolders');
  }

  /**
   * 创建新文件夹
   */
  async createFolder({ name, icon = '', weight = 0, password = '', info = '', content_type = 'bookmark' }) {
    return await this.request('/api/v1/folder', {
      method: 'POST',
      body: {
        name,
        icon,
        weight,
        password,
        info,
        content_type
      }
    });
  }

  /**
   * 更新文件夹
   */
  async updateFolder({ id, name, icon = '', weight = 0, password = '', info = '', content_type = 'bookmark' }) {
    return await this.request('/api/v1/folder', {
      method: 'PUT',
      body: {
        id,
        name,
        icon,
        weight,
        password,
        info,
        content_type
      }
    });
  }

  /**
   * 删除文件夹
   */
  async deleteFolder(id) {
    return await this.request(`/api/v1/folder?id=${id}`, {
      method: 'DELETE',
      body: { id }
    });
  }

  /**
   * 获取用户的全部书签
   */
  async listBookmarks() {
    return await this.request('/api/v1/mylinks');
  }

  /**
   * 获取暂存箱书签 (fid = 0)
   */
  async listTempBookmarks() {
    return await this.request('/api/v1/templinks');
  }

  /**
   * 创建书签
   */
  async createBookmark({ fid = 0, name, url, info = '', icon = '', weight = 0 }) {
    return await this.request('/api/v1/link', {
      method: 'POST',
      body: {
        fid,
        name,
        url,
        info,
        icon,
        weight
      }
    });
  }

  /**
   * 批量创建书签
   */
  async batchCreateBookmarks({ folder_id, links }) {
    return await this.request('/api/v1/links', {
      method: 'POST',
      body: {
        folder_id,
        links: links.map(item => ({
          name: item.name || item.title,
          url: item.url,
          info: item.info || '',
          icon: item.icon || '',
          weight: item.weight || 0
        }))
      }
    });
  }

  /**
   * 更新书签
   */
  async updateBookmark({ id, fid, name, url, info = '', icon = '', weight = 0 }) {
    return await this.request('/api/v1/link', {
      method: 'PUT',
      body: {
        id,
        fid,
        name,
        url,
        info,
        icon,
        weight
      }
    });
  }

  /**
   * 删除书签
   */
  async deleteBookmark(id) {
    return await this.request(`/api/v1/link?id=${id}`, {
      method: 'DELETE',
      body: { id }
    });
  }

  /**
   * 将书签移入暂存箱
   */
  async moveToTemp(id) {
    return await this.request('/api/v1/link/temp', {
      method: 'PUT',
      body: { id }
    });
  }

  /**
   * 获取用户的笔记列表
   * @param {Object} [options]
   * @param {number|null} [options.folder_id] 指定文件夹 ID
   * @param {number} [options.limit] 分页限制
   * @param {number} [options.offset] 分页偏移
   */
  async listNotes({ folder_id = null, limit = 50, offset = 0 } = {}) {
    if (folder_id) {
      const res = await this.request(`/api/v1/notesbyfolderid/${folder_id}?limit=${limit}&offset=${offset}`);
      return res && res.items ? res.items : (Array.isArray(res) ? res : []);
    }
    const res = await this.request('/api/v1/mynotes');
    return Array.isArray(res) ? res : (res && res.items ? res.items : []);
  }

  /**
   * 创建笔记
   * @param {Object} data
   * @param {number} data.fid 目标笔记文件夹 ID
   * @param {string} data.content Markdown 正文
   * @param {number} [data.weight] 排序权重
   */
  async createNote({ fid, content, weight = 0 }) {
    return await this.request('/api/v1/notes/posts', {
      method: 'POST',
      body: {
        fid: Number(fid),
        content,
        weight: Number(weight) || 0
      }
    });
  }

  /**
   * 更新笔记
   * @param {Object} data
   * @param {number} data.id 笔记 ID
   * @param {number} data.fid 笔记文件夹 ID
   * @param {string} data.content Markdown 正文
   * @param {number} [data.weight] 排序权重
   */
  async updateNote({ id, fid, content, weight = 0 }) {
    return await this.request('/api/v1/notes/posts', {
      method: 'PUT',
      body: {
        id: Number(id),
        fid: Number(fid),
        content,
        weight: Number(weight) || 0
      }
    });
  }

  /**
   * 删除笔记
   * @param {number} id 笔记 ID
   */
  async deleteNote(id) {
    return await this.request(`/api/v1/notes/posts?id=${id}`, {
      method: 'DELETE',
      body: { id: Number(id) }
    });
  }
}

