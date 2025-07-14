import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  Clock, 
  CheckCircle, 
  FileText, 
  Users, 
  Crown,
  Loader2,
  Plus,
  Search,
  Eye,
  Trash2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

export function TaskList({ onTaskSelect, onPageChange }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('all'); // all, assigned, created
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.data.tasks);
      } else {
        setError('加载任务列表失败');
      }
    } catch (error) {
      setError('加载任务列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (formData) => {
    try {
      const response = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadTasks();
        setShowCreateModal(false);
      } else {
        const error = await response.json();
        alert(error.error.message);
      }
    } catch (error) {
      console.error('创建任务失败:', error);
      alert('创建任务失败');
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadTasks();
      } else {
        const error = await response.json();
        alert(error.error.message);
      }
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除任务失败');
    }
  };

  const viewTraceability = (taskId) => {
    if (onPageChange) {
      onPageChange('traceability', { taskId });
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'assigned') {
      return task.assignments?.some(assignment => assignment.user_id === user.id);
    } else if (filter === 'created') {
      return task.created_by === user.id;
    }
    return true;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '待开始';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      default: return '未知';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-gray-500">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">协作任务</h1>
          {user?.is_admin && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              创建任务
            </Button>
          )}
        </div>

        {/* 筛选器 */}
        <div className="flex space-x-2 mb-4">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            全部任务
          </Button>
          <Button
            variant={filter === 'assigned' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('assigned')}
          >
            分配给我的
          </Button>
          {user?.is_admin && (
            <Button
              variant={filter === 'created' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('created')}
            >
              我创建的
            </Button>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {task.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3">
                  {task.description}
                </p>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    {task.original_filename}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {task.assignments?.length || 0} 人参与
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                  {getStatusText(task.status)}
                </span>
                
                {task.created_by === user.id && (
                  <Badge variant="outline" className="text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    创建者
                  </Badge>
                )}
              </div>
            </div>

            {/* 分配信息 */}
            {task.assignments && task.assignments.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">任务分配:</h4>
                <div className="flex flex-wrap gap-2">
                  {task.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center bg-gray-50 px-2 py-1 rounded text-xs"
                    >
                      <span className="font-medium">{assignment.user?.name}</span>
                      <span className="text-gray-500 ml-1">({assignment.role})</span>
                      <span className={`ml-2 px-1 rounded ${
                        assignment.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : assignment.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {assignment.status === 'completed' ? '已完成' :
                         assignment.status === 'in_progress' ? '进行中' : '已分配'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => onTaskSelect && onTaskSelect(task.id, 'collaboration')}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  查看详情
                </Button>
                
                {(task.created_by === user.id || user.is_admin) && task.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => viewTraceability(task.id)}
                  >
                    <Search className="w-4 h-4 mr-1" />
                    查看溯源
                  </Button>
                )}
              </div>
              
              {(task.created_by === user.id || user.is_admin) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteTask(task.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无任务</p>
            {user?.is_admin && (
              <Button
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                创建第一个任务
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 创建任务模态框 */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={createTask}
        />
      )}
    </div>
  );
}

// 创建任务模态框组件
function CreateTaskModal({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file: null
  });
  const [userGroups, setUserGroups] = useState([]);
  const [selectedUserGroups, setSelectedUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserGroups();
  }, []);

  const loadUserGroups = async () => {
    try {
      const response = await fetch('/api/v1/user-groups/assignable');
      if (response.ok) {
        const data = await response.json();
        setUserGroups(data.data.user_groups);
      }
    } catch (error) {
      console.error('加载用户组失败:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('任务标题不能为空');
      return;
    }
    if (!formData.file) {
      alert('请选择要上传的文件');
      return;
    }
    if (selectedUserGroups.length === 0) {
      alert('请选择至少一个用户组');
      return;
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('file', formData.file);
      submitData.append('user_group_ids', JSON.stringify(selectedUserGroups));

      await onSubmit(submitData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">创建协作任务</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务标题 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入任务标题"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="请输入任务描述"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              上传文件 *
            </label>
            <input
              type="file"
              accept=".jsonl"
              onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">仅支持JSONL格式文件</p>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              分配给用户组 *
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {userGroups.map((group) => (
                <label key={group.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedUserGroups.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserGroups([...selectedUserGroups, group.id]);
                      } else {
                        setSelectedUserGroups(selectedUserGroups.filter(id => id !== group.id));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {group.name} ({group.user_count} 个用户)
                  </span>
                </label>
              ))}
            </div>
            {userGroups.length === 0 && (
              <p className="text-sm text-gray-500">暂无可分配的用户组</p>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建任务'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

