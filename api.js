// API基础配置
const API_BASE_URL = 'http://localhost:5000/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('session_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('session_token', token);
    } else {
      localStorage.removeItem('session_token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || '请求失败');
      }
      
      return data;
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }

  // 认证相关
  async getUsers() {
    return this.request('/auth/users');
  }

  async login(userId) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
    
    if (response.success && response.data.session_token) {
      this.setToken(response.data.session_token);
    }
    
    return response;
  }

  async logout() {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });
    
    this.setToken(null);
    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // 单文件校对相关
  async uploadSingleFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.request('/single_file/upload', {
      method: 'POST',
      headers: {
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      },
      body: formData,
    });
  }

  async getSingleFileQAPairs(sessionId, page = 1, pageSize = 20, search = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      ...(search && { search }),
    });
    
    return this.request(`/single_file/${sessionId}/qa_pairs?${params}`);
  }

  async updateSingleFileQAPair(sessionId, qaId, data) {
    return this.request(`/single_file/${sessionId}/qa_pairs/${qaId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async exportSingleFileJsonl(sessionId) {
    return this.request(`/single_file/${sessionId}/export/jsonl`, {
      method: 'POST',
    });
  }

  async exportSingleFileExcel(sessionId) {
    return this.request(`/single_file/${sessionId}/export/excel`, {
      method: 'POST',
    });
  }

  // 协作任务相关
  async createCollaborationTask(file, assignments) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assignments', JSON.stringify({ assignments }));
    
    return this.request('/collaboration/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });
  }

  async getTask(taskId) {
    return this.request(`/collaboration/tasks/${taskId}`);
  }

  async getAssignmentQAPairs(assignmentId, page = 1, pageSize = 20, search = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      ...(search && { search }),
    });
    
    return this.request(`/collaboration/assignments/${assignmentId}/qa_pairs?${params}`);
  }

  async updateAssignmentQAPair(assignmentId, qaId, data) {
    return this.request(`/collaboration/assignments/${assignmentId}/qa_pairs/${qaId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async submitAssignment(assignmentId) {
    return this.request(`/collaboration/assignments/${assignmentId}/submit`, {
      method: 'POST',
    });
  }

  async exportTaskJsonl(taskId) {
    return this.request(`/collaboration/tasks/${taskId}/export/jsonl`, {
      method: 'POST',
    });
  }

  async exportTaskExcel(taskId) {
    return this.request(`/collaboration/tasks/${taskId}/export/excel`, {
      method: 'POST',
    });
  }

  // 任务列表相关
  async getPendingTasks() {
    return this.request('/tasks/pending');
  }

  async getCompletedTasks() {
    return this.request('/tasks/completed');
  }

  // 文件下载
  getDownloadUrl(filename) {
    return `/downloads/${filename}`;
  }
}

export const apiClient = new ApiClient();

