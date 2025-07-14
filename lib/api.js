const API_BASE_URL = '/api/v1';

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // 用户相关API
  async getUsers() {
    return this.request('/users');
  }

  async login(userData) {
    return this.request('/auth/login', {
      method: 'POST',
      body: userData,
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // 任务相关API
  async getTasks() {
    return this.request('/tasks');
  }

  async createTask(taskData) {
    return this.request('/tasks', {
      method: 'POST',
      body: taskData,
    });
  }

  async assignTask(taskId, assignmentData) {
    return this.request(`/tasks/${taskId}/assign`, {
      method: 'POST',
      body: assignmentData,
    });
  }

  // 文件相关API
  async uploadFile(formData) {
    return this.request('/single-file/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // 让浏览器自动设置Content-Type
    });
  }

  async getFileSessions() {
    return this.request('/single-file/sessions');
  }

  async getFileSession(sessionId) {
    return this.request(`/single-file/sessions/${sessionId}`);
  }

  async saveQAPairs(sessionId, qaPairs) {
    return this.request(`/single-file/sessions/${sessionId}/qa-pairs`, {
      method: 'POST',
      body: { qa_pairs: qaPairs },
    });
  }

  // 用户组相关API
  async getUserGroups() {
    return this.request('/user-groups');
  }

  async createUserGroup(groupData) {
    return this.request('/user-groups', {
      method: 'POST',
      body: groupData,
    });
  }

  async getAdminGroups() {
    return this.request('/admin-groups');
  }

  async createAdminGroup(groupData) {
    return this.request('/admin-groups', {
      method: 'POST',
      body: groupData,
    });
  }

  async bindAdminGroupToUserGroup(bindingData) {
    return this.request('/admin-groups/bind', {
      method: 'POST',
      body: bindingData,
    });
  }

  // 溯源相关API
  async getTaskTraceability(taskId) {
    return this.request(`/traceability/task/${taskId}`);
  }

  async getSessionTraceability(sessionId) {
    return this.request(`/traceability/session/${sessionId}`);
  }

  async getQAPairHistory(qaPairId) {
    return this.request(`/traceability/qa-pair/${qaPairId}`);
  }

  async getUserWorkSummary(userId, startDate, endDate) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    return this.request(`/traceability/user/${userId}/summary?${params}`);
  }
}

export const apiClient = new ApiClient();

