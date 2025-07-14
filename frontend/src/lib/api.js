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

    // 对于FormData，fetch会自动设置Content-Type，所以这里不需要手动设置
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

  // 认证相关
  async login(username, password) {
    const response = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    
    if (response.success && response.data.access_token) { // 修正为access_token
      this.setToken(response.data.access_token);
    }
    
    return response;
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST" });
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

  async createGuestSession() {
    return this.request("/auth/guest-session", { method: "POST" });
  }

  // 用户管理
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

  // 组管理
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

  async linkUserGroups(adminGroupId, userGroupIds) {
    return this.request(`/admin-groups/${adminGroupId}/user-groups`, {
      method: "POST",
      body: JSON.stringify({ user_group_ids: userGroupIds }),
    });
  }

  // 文件管理
  async uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    // fetch会自动设置Content-Type为multipart/form-data，不需要手动设置
    const response = await fetch(`${API_BASE_URL}/files/upload`, {
      method: "POST",
      headers: this.getHeaders(null), // 明确不设置Content-Type，让fetch自动处理FormData
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

  async deleteFile(fileId) {
    return this.request(`/files/${fileId}`, { method: "DELETE" });
  }

  // 访客会话管理
  async createGuestFileSession(filename, fileData) {
    return this.request("/guest-sessions", {
      method: "POST",
      body: JSON.stringify({ filename, file_data: fileData }),
    });
  }

  async getGuestSession(sessionId) {
    return this.request(`/guest-sessions/${sessionId}`);
  }

  async updateGuestSession(sessionId, fileData) {
    return this.request(`/guest-sessions/${sessionId}`, {
      method: "PUT",
      body: JSON.stringify({ file_data: fileData }),
    });
  }

  async exportGuestSession(sessionId, exportType = "jsonl") {
    const response = await fetch(`${API_BASE_URL}/guest-sessions/${sessionId}/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: exportType }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "导出失败");
    }

    return response.blob();
  }

  // 任务管理
  async getTasks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/tasks${queryString ? `?${queryString}` : ""}`);
  }

  async createTask(formData) {
    const headers = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "任务创建失败");
    }

    return data;
  }

  async getTask(taskId) {
    return this.request(`/tasks/${taskId}`);
  }

  async assignTask(taskId, assignments) {
    return this.request(`/tasks/${taskId}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignments }),
    });
  }

  async submitTaskAssignment(taskId) {
    return this.request(`/tasks/${taskId}/submit`, { method: "POST" });
  }

  async getTaskQAPairs(taskId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/tasks/${taskId}/qa-pairs${queryString ? `?${queryString}` : ""}`);
  }

  async exportTask(taskId, exportType = "jsonl") {
    const headers = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/export`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: exportType }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "导出失败");
    }

    return response.blob();
  }

  async deleteTask(taskId) {
    return this.request(`/tasks/${taskId}`, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();


