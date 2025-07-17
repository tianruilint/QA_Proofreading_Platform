const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5001/api/v1`;

class ApiClient {
  constructor() {
    this.token = localStorage.getItem("auth_token");
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  getHeaders(contentType = "application/json") {
    const headers = {};
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getHeaders(options.headers ? options.headers["Content-Type"] : "application/json"),
      ...options,
    };

    if (options.body instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "请求失败");
      }

      return data;
    } catch (error) {
      console.error("API请求错误:", error);
      throw error;
    }
  }

  // --- 认证相关 ---
  async login(username, password) {
    const response = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    
    if (response.success && response.data.access_token) {
      this.setToken(response.data.access_token);
    }
    
    return response;
  }

  async logout() {
    try {
      // await this.request("/auth/logout", { method: "POST" }); // 后端没有实现logout
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser() {
    return this.request("/auth/me");
  }

  async changePassword(oldPassword, newPassword) {
    return this.request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
  }

  async getUsersTree() {
    return this.request("/auth/users/tree");
  }
  
  // --- 用户管理 ---
  async getUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/users${queryString ? `?${queryString}` : ""}`);
  }

  async createUser(userData) {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId, userData) {
    return this.request(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId) {
    return this.request(`/users/${userId}`, { method: "DELETE" });
  }

  async resetUserPassword(userId, newPassword) {
    return this.request(`/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    });
  }
  
  // --- 组管理 ---
  async getAdminGroups(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/admin-groups${queryString ? `?${queryString}` : ""}`);
  }

  async createAdminGroup(groupData) {
    return this.request("/admin-groups", {
      method: "POST",
      body: JSON.stringify(groupData),
    });
  }

  async updateAdminGroup(groupId, groupData) {
    return this.request(`/admin-groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify(groupData),
    });
  }

  async deleteAdminGroup(groupId) {
    return this.request(`/admin-groups/${groupId}`, { method: "DELETE" });
  }

  async getUserGroups(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/user-groups${queryString ? `?${queryString}` : ""}`);
  }

  async createUserGroup(groupData) {
    return this.request("/user-groups", {
      method: "POST",
      body: JSON.stringify(groupData),
    });
  }

  async updateUserGroup(groupId, groupData) {
    return this.request(`/user-groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify(groupData),
    });
  }

  async deleteUserGroup(groupId) {
    return this.request(`/user-groups/${groupId}`, { method: "DELETE" });
  }

  async linkUserGroups(adminGroupId, data) {
    return this.request(`/admin-groups/${adminGroupId}/user-groups`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  
  // --- 文件和会话管理 ---
  async getSessionHistory() {
    return this.request('/files/history');
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: "POST",
      headers: this.getHeaders(null),
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "文件上传失败");
    }

    return data;
  }

  async getFile(fileId) {
    return this.request(`/files/${fileId}`);
  }

  async renameFile(fileId, newName) {
    return this.request(`/files/${fileId}/rename`, {
        method: 'PUT',
        body: JSON.stringify({ new_name: newName })
    });
  }

  async deleteFile(fileId) {
    return this.request(`/files/${fileId}`, { method: "DELETE" });
  }

  async getFileQAPairs(fileId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/files/${fileId}/qa-pairs${queryString ? `?${queryString}` : ""}`);
  }

  async updateQAPair(fileId, qaId, qaPairData) {
    return this.request(`/files/${fileId}/qa-pairs/${qaId}`, {
      method: "PUT",
      body: JSON.stringify(qaPairData),
    });
  }

  async deleteQAPair(fileId, qaId) {
    return this.request(`/files/${fileId}/qa-pairs/${qaId}`, { method: "DELETE" });
  }

  async exportFile(fileId, exportType = "jsonl", startIndex = null, endIndex = null) {
    const body = { type: exportType };
    if (startIndex !== null) body.start_index = startIndex;
    if (endIndex !== null) body.end_index = endIndex;

    const headers = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/files/${fileId}/export`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "导出失败");
    }

    return response.blob();
  }

  // ... (其他任务管理等方法保持不变)
}

export const apiClient = new ApiClient();

