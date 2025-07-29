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
      
      const disposition = response.headers.get("content-disposition");
      if (disposition && disposition.includes('attachment')) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: '文件下载失败' }}));
            throw new Error(errorData.error?.message || `文件下载失败: ${response.statusText}`);
        }
        return response.blob();
      }

      // 修复：如果响应体为空，返回一个成功的空对象，而不是尝试解析JSON
      const text = await response.text();
      const data = text ? JSON.parse(text) : { success: true, data: {} };

      if (!response.ok) {
        throw new Error(data.error?.message || "请求失败");
      }

      return data;
    } catch (error) {
      console.error("API请求错误:", error);
      throw error;
    }
  }

  // --- 认证 ---
  async login(username, password) { const res = await this.request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }); if (res.success && res.data.access_token) { this.setToken(res.data.access_token); } return res; }
  async logout() { this.setToken(null); }
  async getCurrentUser() { return this.request("/auth/me"); }
  async changePassword(oldPassword, newPassword) { return this.request("/auth/change-password", { method: "POST", body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }), }); }
  async getUsersTree() { return this.request("/auth/users/tree"); }
  
  // --- 用户管理 ---
  async getUsers(params = {}) { const q = new URLSearchParams(params).toString(); return this.request(`/users?${q}`); }
  async createUser(userData) { return this.request("/users", { method: "POST", body: JSON.stringify(userData) }); }
  async updateUser(userId, userData) { return this.request(`/users/${userId}`, { method: "PUT", body: JSON.stringify(userData) }); }
  async deleteUser(userId) { return this.request(`/users/${userId}`, { method: "DELETE" }); }
  async resetUserPassword(userId, newPassword) { return this.request(`/users/${userId}/reset-password`, { method: "POST", body: JSON.stringify({ new_password: newPassword }), }); }
  
  // --- 组管理 ---
  async getAdminGroups(params = {}) { const q = new URLSearchParams(params).toString(); return this.request(`/admin-groups?${q}`); }
  async createAdminGroup(groupData) { return this.request("/admin-groups", { method: "POST", body: JSON.stringify(groupData) }); }
  async updateAdminGroup(groupId, groupData) { return this.request(`/admin-groups/${groupId}`, { method: "PUT", body: JSON.stringify(groupData) }); }
  async deleteAdminGroup(groupId) { return this.request(`/admin-groups/${groupId}`, { method: "DELETE" }); }
  async getUserGroups(params = {}) { const q = new URLSearchParams(params).toString(); return this.request(`/user-groups?${q}`); }
  async createUserGroup(groupData) { return this.request("/user-groups", { method: "POST", body: JSON.stringify(groupData) }); }
  async updateUserGroup(groupId, groupData) { return this.request(`/user-groups/${groupId}`, { method: "PUT", body: JSON.stringify(groupData) }); }
  async deleteUserGroup(groupId) { return this.request(`/user-groups/${groupId}`, { method: "DELETE" }); }
  async linkUserGroups(adminGroupId, data) { return this.request(`/admin-groups/${adminGroupId}/user-groups`, { method: "POST", body: JSON.stringify(data) }); }
  
  // --- 文件和会话管理 ---
  async getSessionHistory() { return this.request('/files/history'); }
  async uploadFile(file) { const formData = new FormData(); formData.append("file", file); return this.request("/files/upload", { method: "POST", body: formData }); }
  async getFile(fileId) { return this.request(`/files/${fileId}`); }
  async renameFile(fileId, newName) { return this.request(`/files/${fileId}/rename`, { method: 'PUT', body: JSON.stringify({ new_name: newName }) }); }
  async deleteFile(fileId) { return this.request(`/files/${fileId}`, { method: "DELETE" }); }
  async getFileQAPairs(fileId) { return this.request(`/files/${fileId}/qa-pairs`); }
  async updateQAPair(fileId, qaId, qaPairData) { return this.request(`/files/${fileId}/qa-pairs/${qaId}`, { method: "PUT", body: JSON.stringify(qaPairData) }); }
  async deleteQAPair(fileId, qaId) { return this.request(`/files/${fileId}/qa-pairs/${qaId}`, { method: "DELETE" }); }
  async exportFile(fileId, format = "jsonl") { const q = new URLSearchParams({ format }).toString(); return this.request(`/files/${fileId}/export?${q}`, { method: "GET" }); }

  // --- 协作任务 ---
  async getCollaborationTasks(params = {}) { const q = new URLSearchParams(params).toString(); return this.request(`/collaboration-tasks?${q}`); }
  async createCollaborationTask(formData) { return this.request("/collaboration-tasks", { method: "POST", body: formData }); }
  async getCollaborationTask(taskId) { return this.request(`/collaboration-tasks/${taskId}`); }
  async getManageableUsersForTask(taskId) { return this.request(`/collaboration-tasks/${taskId}/manageable-users`); }
  async assignCollaborationTask(taskId, assignmentData) { return this.request(`/collaboration-tasks/${taskId}/assign`, { method: "POST", body: JSON.stringify(assignmentData) }); }
  async submitCollaborationTaskAssignment(taskId) { return this.request(`/collaboration-tasks/${taskId}/submit`, { method: "POST" }); }
  async getCollaborationTaskEditorData(taskId, params = {}) { 
  const q = new URLSearchParams(params).toString();
  return this.request(`/collaboration-tasks/${taskId}/editor-data?${q}`);  }
  async deleteCollaborationTask(taskId) { return this.request(`/collaboration-tasks/${taskId}`, { method: "DELETE" }); }
  async saveDraft(taskId, draftData) {
    return this.request(`/collaboration-tasks/${taskId}/draft`, { method: "POST", body: JSON.stringify(draftData) });
}
  async deleteCollaborationQAPair(taskId, qaPairId) {
    return this.request(`/collaboration-tasks/${taskId}/qa-pairs/${qaPairId}`, { method: 'DELETE' });
}
  async exportCollaborationTask(taskId, format = 'jsonl') {
    const q = new URLSearchParams({ format }).toString();
    return this.request(`/collaboration-tasks/${taskId}/export?${q}`, { method: "GET" });
}
  async getCollaborationTaskSummaryData(taskId, params = {}) { const q = new URLSearchParams(params).toString(); return this.request(`/collaboration-tasks/${taskId}/summary-data?${q}`); }
  async getCollaborationTaskProgress(taskId) { return this.request(`/collaboration-tasks/${taskId}/progress`); }
  async updateSummaryItem(taskId, qaPairId, data) { return this.request(`/collaboration-tasks/${taskId}/summary/${qaPairId}`, { method: "PUT", body: JSON.stringify(data) }); }

  // --- 通知功能 (已恢复) ---
  async getNotifications(params = {}) { const q = new URLSearchParams(params).toString(); return this.request(`/notifications?${q}`); }
  async markNotificationAsRead(notificationId) { return this.request(`/notifications/${notificationId}/read`, { method: "PUT" }); }
  async markAllNotificationsAsRead() { return this.request("/notifications/mark-all-read", { method: "PUT" }); }
  async getUnreadNotificationCount() { return this.request("/notifications/unread-count"); }
}

export const apiClient = new ApiClient();

