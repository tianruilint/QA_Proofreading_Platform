import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { CollaborationTaskEditor } from './CollaborationTaskEditor';
// import { CollaborationTaskSummary } from './CollaborationTaskSummary';
import { 
  Plus, 
  Upload, 
  FileText, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Edit,
  Edit3,
  Trash2,
  Download,
  UserPlus,
  BarChart3,
  Calendar,
  User,
  Shield,
  Search
} from 'lucide-react';

export function CollaborationTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'create', 'detail', 'editor', 'summary'
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTask, setAssigningTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'draft', 'in_progress', 'completed', 'finalized'
  const [filterRole, setFilterRole] = useState('all'); // 'all', 'creator', 'assignee'
  const [searchTerm, setSearchTerm] = useState('');
  
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    deadline: '',
    file: null
  });

  // 分配任务相关状态
  const [assignForm, setAssignForm] = useState({
    strategy: 'average', // 'average' or 'manual'
    selectedUsers: [],
    selectedGroups: [],
    includeAdmin: false,
    adminQaCount: 0,
    manualAssignments: []
  });
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCollaborationTasks();
      if (response.success) {
        setTasks(response.data);
      } else {
        toast.error(`获取任务列表失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`获取任务列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 过滤任务
  const filteredTasks = tasks.filter(task => {
    // 状态过滤
    if (filterStatus !== 'all' && task.status !== filterStatus) {
      return false;
    }
    
    // 角色过滤
    if (filterRole === 'creator' && task.created_by !== user.id) {
      return false;
    }
    if (filterRole === 'assignee') {
      const isAssignee = task.assignments && task.assignments.some(a => a.assigned_to === user.id);
      if (!isAssignee) {
        return false;
      }
    }
    
    // 搜索过滤
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return task.name.toLowerCase().includes(searchLower) ||
             (task.description && task.description.toLowerCase().includes(searchLower));
    }
    
    return true;
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  // 获取状态显示
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'draft':
        return { text: '草稿', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText };
      case 'in_progress':
        return { text: '进行中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock };
      case 'completed':
        return { text: '已完成', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle };
      case 'finalized':
        return { text: '已确认', color: 'text-purple-600', bg: 'bg-purple-100', icon: Shield };
      default:
        return { text: '未知', color: 'text-gray-600', bg: 'bg-gray-100', icon: AlertCircle };
    }
  };

  // 获取用户在任务中的角色
  const getUserRole = (task) => {
    if (task.created_by === user.id) {
      return 'creator';
    }
    if (task.assignments && task.assignments.some(a => a.assigned_to === user.id)) {
      return 'assignee';
    }
    return 'viewer';
  };

  // 创建任务
  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!createForm.title || !createForm.file) {
      toast.error('请填写任务标题并选择文件');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', createForm.title);
      formData.append('description', createForm.description);
      if (createForm.deadline) {
        formData.append('deadline', createForm.deadline);
      }
      formData.append('file', createForm.file);

      const response = await apiClient.createCollaborationTask(formData);
      if (response.success) {
        toast.success('协作任务创建成功');
        setShowCreateModal(false);
        setCreateForm({ title: '', description: '', deadline: '', file: null });
        fetchTasks();
      } else {
        toast.error(`创建任务失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`创建任务失败: ${error.message}`);
    }
  };

  // 获取可分配的用户和用户组
  const fetchManageableUsers = async (taskId) => {
    try {
      const response = await apiClient.getManageableUsersForTask(taskId);
      if (response.success) {
        setAvailableUsers(response.data.users || []);
        setAvailableGroups(response.data.user_groups || []);
      } else {
        toast.error(`获取可分配用户失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`获取可分配用户失败: ${error.message}`);
    }
  };

  // 打开分配模态框
  const openAssignModal = async (task) => {
    setSelectedTask(task);
    await fetchManageableUsers(task.id);
    setShowAssignModal(true);
  };

  // 分配任务
  const handleAssignTask = async () => {
    if (!selectedTask) return;

    try {
      const assignmentData = {
        strategy: assignForm.strategy,
        selected_users: assignForm.selectedUsers,
        selected_groups: assignForm.selectedGroups,
        include_admin: assignForm.includeAdmin,
        admin_qa_count: assignForm.adminQaCount,
        manual_assignments: assignForm.manualAssignments
      };

      const response = await apiClient.assignCollaborationTask(selectedTask.id, assignmentData);
      if (response.success) {
        toast.success('任务分配成功');
        setShowAssignModal(false);
        setAssignForm({
          strategy: 'average',
          selectedUsers: [],
          selectedGroups: [],
          includeAdmin: false,
          adminQaCount: 0,
          manualAssignments: []
        });
        fetchTasks();
      } else {
        toast.error(`任务分配失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`任务分配失败: ${error.message}`);
    }
  };

  // 提交任务
  const handleSubmitTask = async (taskId) => {
    try {
      const response = await apiClient.submitCollaborationTaskAssignment(taskId);
      if (response.success) {
        toast.success('任务提交成功');
        fetchTasks();
      } else {
        toast.error(`任务提交失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`任务提交失败: ${error.message}`);
    }
  };

  // 导出任务
  const handleExportTask = async (taskId, type = 'jsonl') => {
    try {
      const response = await apiClient.exportCollaborationTask(taskId, type);
      // 处理文件下载
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `collaboration_task_${taskId}.${type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('任务导出成功');
    } catch (error) {
      toast.error(`任务导出失败: ${error.message}`);
    }
  };

  // 删除任务
  const handleDeleteTask = async (taskId) => {
    if (!confirm('确定要删除这个协作任务吗？此操作不可撤销。')) {
      return;
    }

    try {
      const response = await apiClient.deleteCollaborationTask(taskId);
      if (response.success) {
        toast.success('任务删除成功');
        fetchTasks();
      } else {
        toast.error(`任务删除失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`任务删除失败: ${error.message}`);
    }
  };

  // 进入汇总视图
  const enterSummaryView = (task) => {
    setSelectedTask(task);
    setCurrentView('summary');
  };

  // 进入编辑器
  const enterTaskEditor = (task) => {
    setSelectedTask(task);
    setCurrentView('editor');
  };

  // 返回任务列表
  const backToTaskList = () => {
    setCurrentView('list');
    setSelectedTask(null);
    fetchTasks(); // 刷新任务列表
  };

  // 渲染任务卡片
  const renderTaskCard = (task) => {
    const statusDisplay = getStatusDisplay(task.status);
    const StatusIcon = statusDisplay.icon;

    return (
      <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h3>
            <p className="text-gray-600 text-sm mb-3">{task.description}</p>
            
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <FileText className="w-4 h-4 mr-1" />
                {task.total_qa_pairs} 个QA对
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {task.progress?.total_assignments || 0} 人参与
              </div>
              {task.deadline && (
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(task.deadline).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color}`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusDisplay.text}
            </span>
          </div>
        </div>

        {/* 进度条 */}
        {task.progress && task.progress.total_assignments > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>完成进度</span>
              <span>{Math.round(task.progress.completion_rate * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${task.progress.completion_rate * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            创建于 {new Date(task.created_at).toLocaleDateString()}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 查看详情 */}
            <button
              onClick={() => setCurrentView('detail')}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="查看详情"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* 管理员操作 */}
            {task.user_role === 'creator' && (
              <>
                {task.status === 'draft' && (
                  <button
                    onClick={() => openAssignModal(task)}
                    className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                    title="分配任务"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
                
                {(task.status === 'in_progress' || task.status === 'completed') && (
                  <button
                    onClick={() => enterSummaryView(task)}
                    className="p-2 text-purple-400 hover:text-purple-600 transition-colors"
                    title="查看汇总"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                )}
                
                {task.status === 'completed' && (
                  <button
                    onClick={() => handleExportTask(task.id)}
                    className="p-2 text-green-400 hover:text-green-600 transition-colors"
                    title="导出结果"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                  title="删除任务"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {/* 被分配用户操作 */}
            {task.user_role === 'assignee' && task.assignment && (
              <>
                {task.assignment.status === 'pending' || task.assignment.status === 'in_progress' ? (
                  <>
                    <button
                      onClick={() => enterTaskEditor(task)}
                      className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                      title="开始编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSubmitTask(task.id)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                    >
                      提交任务
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => enterTaskEditor(task)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="查看编辑内容"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded">
                      已提交
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 任务列表视图 */}
      {currentView === 'list' && (
        <div className="space-y-6">
          {/* 头部操作栏 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">协作任务</h1>
              <p className="text-sm text-gray-600 mt-1">管理和参与协作校对任务</p>
            </div>
            
            {user.role === 'admin' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建任务
              </button>
            )}
          </div>

          {/* 过滤和搜索栏 */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 搜索框 */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜索任务名称或描述..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {/* 状态过滤 */}
              <div className="sm:w-40">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">所有状态</option>
                  <option value="draft">草稿</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="finalized">已确认</option>
                </select>
              </div>
              
              {/* 角色过滤 */}
              <div className="sm:w-40">
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">所有任务</option>
                  <option value="creator">我创建的</option>
                  <option value="assignee">分配给我的</option>
                </select>
              </div>
            </div>
          </div>

          {/* 任务列表 */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || filterStatus !== 'all' || filterRole !== 'all' 
                  ? '没有找到匹配的任务' 
                  : '暂无协作任务'
                }
              </h3>
              <p className="text-gray-600">
                {searchTerm || filterStatus !== 'all' || filterRole !== 'all'
                  ? '请尝试调整搜索条件或过滤器'
                  : user.role === 'admin' 
                    ? '点击上方按钮创建第一个协作任务'
                    : '等待管理员创建协作任务'
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTasks.map((task) => {
                const statusDisplay = getStatusDisplay(task.status);
                const StatusIcon = statusDisplay.icon;
                const userRole = getUserRole(task);
                
                return (
                  <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    {/* 任务头部 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{task.name}</h3>
                        {task.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                        )}
                      </div>
                      
                      <div className="ml-4 flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusDisplay.text}
                        </span>
                        
                        {/* 角色标识 */}
                        {userRole === 'creator' && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            <User className="w-3 h-3 mr-1" />
                            创建者
                          </span>
                        )}
                        {userRole === 'assignee' && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            <User className="w-3 h-3 mr-1" />
                            参与者
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 任务信息 */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        创建于 {new Date(task.created_at).toLocaleDateString('zh-CN')}
                      </div>
                      
                      {task.assignments && task.assignments.length > 0 && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="w-4 h-4 mr-2" />
                          {task.assignments.length} 人参与
                        </div>
                      )}
                      
                      {task.progress && (
                        <div className="flex items-center text-sm text-gray-600">
                          <BarChart3 className="w-4 h-4 mr-2" />
                          完成率 {Math.round(task.progress.completion_rate * 100)}%
                        </div>
                      )}
                    </div>

                    {/* 进度条 */}
                    {task.progress && (
                      <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress.completion_rate * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-2">
                        {/* 查看详情 */}
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setCurrentView('detail');
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* 管理员操作 */}
                        {userRole === 'creator' && (
                          <>
                            {task.status === 'draft' && (
                              <button
                                onClick={() => openAssignModal(task)}
                                className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                                title="分配任务"
                              >
                                <UserPlus className="w-4 h-4" />
                              </button>
                            )}
                            
                            {(task.status === 'in_progress' || task.status === 'completed') && (
                              <button
                                onClick={() => enterSummaryView(task)}
                                className="p-2 text-purple-400 hover:text-purple-600 transition-colors"
                                title="查看汇总"
                              >
                                <BarChart3 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}

                        {/* 被分配者操作 */}
                        {userRole === 'assignee' && task.status === 'in_progress' && (
                          <button
                            onClick={() => enterTaskEditor(task)}
                            className="p-2 text-green-400 hover:text-green-600 transition-colors"
                            title="开始编辑"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        
                        {userRole === 'assignee' && task.status === 'completed' && (
                          <button
                            onClick={() => enterTaskEditor(task)}
                            className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                            title="查看我的部分"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {task.updated_at && new Date(task.updated_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 创建任务模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">创建协作任务</h2>
            
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  任务标题 *
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入任务标题"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  任务描述
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="输入任务描述"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  截止时间
                </label>
                <input
                  type="datetime-local"
                  value={createForm.deadline}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  JSONL文件 *
                </label>
                <input
                  type="file"
                  accept=".jsonl"
                  onChange={(e) => setCreateForm(prev => ({ ...prev, file: e.target.files[0] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  创建任务
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 分配任务模态框 */}
      {showAssignModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">分配任务: {selectedTask.title}</h2>
            
            <div className="space-y-6">
              {/* 分配策略选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分配策略
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="average"
                      checked={assignForm.strategy === 'average'}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, strategy: e.target.value }))}
                      className="mr-2"
                    />
                    平均分配（系统自动计算）
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="manual"
                      checked={assignForm.strategy === 'manual'}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, strategy: e.target.value }))}
                      className="mr-2"
                    />
                    自定义分配（手动指定范围）
                  </label>
                </div>
              </div>

              {/* 用户组选择 */}
              {availableGroups.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择用户组
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                    {availableGroups.map(group => (
                      <label key={group.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={assignForm.selectedGroups.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignForm(prev => ({
                                ...prev,
                                selectedGroups: [...prev.selectedGroups, group.id]
                              }));
                            } else {
                              setAssignForm(prev => ({
                                ...prev,
                                selectedGroups: prev.selectedGroups.filter(id => id !== group.id)
                              }));
                            }
                          }}
                          className="mr-2"
                        />
                        {group.name} ({group.user_count} 人)
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 单个用户选择 */}
              {availableUsers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择单个用户
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                    {availableUsers.map(user => (
                      <label key={user.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={assignForm.selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignForm(prev => ({
                                ...prev,
                                selectedUsers: [...prev.selectedUsers, user.id]
                              }));
                            } else {
                              setAssignForm(prev => ({
                                ...prev,
                                selectedUsers: prev.selectedUsers.filter(id => id !== user.id)
                              }));
                            }
                          }}
                          className="mr-2"
                        />
                        {user.display_name} ({user.username})
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 管理员自参与选项 */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={assignForm.includeAdmin}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, includeAdmin: e.target.checked }))}
                    className="mr-2"
                  />
                  管理员参与任务
                </label>
                
                {assignForm.includeAdmin && assignForm.strategy === 'average' && (
                  <div className="mt-2 ml-6">
                    <label className="block text-sm text-gray-600 mb-1">
                      管理员负责的QA对数量
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={selectedTask.total_qa_pairs}
                      value={assignForm.adminQaCount}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, adminQaCount: parseInt(e.target.value) || 0 }))}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleAssignTask}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  确认分配
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 任务编辑器视图 */}
      {currentView === 'editor' && selectedTask && (
        <CollaborationTaskEditor 
          task={selectedTask}
          onBack={backToTaskList}
        />
      )}

      {/* 任务汇总视图 */}
      {/* {currentView === 'summary' && selectedTask && (
        <CollaborationTaskSummary 
          task={selectedTask}
          onBack={backToTaskList}
        />
      )} */}
    </div>
  );
}
