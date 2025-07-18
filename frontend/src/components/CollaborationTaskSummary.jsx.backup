import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FileText,
  Edit3,
  Save,
  Eye,
  Download,
  BarChart3,
  TrendingUp,
  User,
  Calendar,
  Activity,
  Shield,
  XCircle,
  RotateCcw,
  Check
} from 'lucide-react';

export function CollaborationTaskSummary({ task, onBack }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('progress');
  const [progressData, setProgressData] = useState(null);
  const [summaryData, setSummaryData] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ prompt: '', completion: '' });
  const [saving, setSaving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingAssignment, setRejectingAssignment] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const itemsPerPage = 20;

  // 获取进度数据
  const fetchProgress = async () => {
    try {
      const response = await apiClient.getCollaborationTaskProgress(task.id);
      if (response.success) {
        setProgressData(response.data.progress_stats);
        setParticipants(response.data.participants);
      } else {
        toast.error(`获取进度失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`获取进度失败: ${error.message}`);
    }
  };

  // 获取汇总数据
  const fetchSummary = async (page = 1) => {
    try {
      const response = await apiClient.getCollaborationTaskSummary(task.id, {
        page,
        per_page: itemsPerPage
      });
      if (response.success) {
        setSummaryData(response.data.summary_items || []);
        setTotalPages(response.data.pagination?.pages || 1);
        setCurrentPage(page);
      } else {
        toast.error(`获取汇总失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`获取汇总失败: ${error.message}`);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchProgress(),
        activeTab === 'summary' ? fetchSummary(1) : Promise.resolve()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [task.id, activeTab]);

  // 开始编辑汇总项
  const startEdit = (summaryItem) => {
    setEditingId(summaryItem.id);
    setEditForm({
      prompt: summaryItem.edited_prompt,
      completion: summaryItem.edited_completion
    });
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ prompt: '', completion: '' });
  };

  // 保存编辑
  const saveEdit = async (summaryItemId, qaPairId) => {
    if (!editForm.prompt.trim() || !editForm.completion.trim()) {
      toast.error('问题和答案不能为空');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.updateSummaryItem(task.id, qaPairId, {
        edited_prompt: editForm.prompt.trim(),
        edited_completion: editForm.completion.trim()
      });

      if (response.success) {
        setSummaryData(prev => 
          prev.map(item => 
            item.id === summaryItemId 
              ? { 
                  ...item, 
                  edited_prompt: editForm.prompt.trim(), 
                  edited_completion: editForm.completion.trim(),
                  is_modified: true
                }
              : item
          )
        );
        setEditingId(null);
        setEditForm({ prompt: '', completion: '' });
        toast.success('保存成功');
      } else {
        toast.error(`保存失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`保存失败: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 导出任务结果
  const exportTask = async () => {
    try {
      const response = await apiClient.exportFinalResult(task.id);
      if (response.success) {
        // 处理文件下载
        const blob = new Blob([response.data.content], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = response.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('导出成功');
      } else {
        toast.error(`导出失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`导出失败: ${error.message}`);
    }
  };

  // 打回分配任务
  const handleRejectAssignment = async () => {
    if (!rejectingAssignment || !rejectReason.trim()) {
      toast.error('请填写打回原因');
      return;
    }

    try {
      const response = await apiClient.rejectAssignment(task.id, {
        assignment_id: rejectingAssignment.assignment_id,
        reject_reason: rejectReason.trim()
      });

      if (response.success) {
        toast.success('任务打回成功');
        setShowRejectModal(false);
        setRejectingAssignment(null);
        setRejectReason('');
        // 刷新数据
        await fetchProgress();
      } else {
        toast.error(`打回失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`打回失败: ${error.message}`);
    }
  };

  // 最终确认任务
  const handleFinalConfirm = async () => {
    try {
      const response = await apiClient.finalConfirmTask(task.id);

      if (response.success) {
        toast.success('任务最终确认成功');
        setShowFinalConfirmModal(false);
        // 刷新数据
        await fetchProgress();
        // 可以选择返回任务列表
        setTimeout(() => {
          onBack();
        }, 2000);
      } else {
        toast.error(`最终确认失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`最终确认失败: ${error.message}`);
    }
  };

  // 重新开放任务
  const handleReopenTask = async () => {
    if (!reopenReason.trim()) {
      toast.error('请填写重新开放原因');
      return;
    }

    try {
      const response = await apiClient.reopenTask(task.id, {
        reopen_reason: reopenReason.trim()
      });

      if (response.success) {
        toast.success('任务重新开放成功');
        setShowReopenModal(false);
        setReopenReason('');
        // 刷新数据
        await fetchProgress();
      } else {
        toast.error(`重新开放失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`重新开放失败: ${error.message}`);
    }
  };

  // 获取状态显示
  const getStatusDisplay = (status) => {
    const statusConfig = {
      pending: { text: '待开始', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
      in_progress: { text: '进行中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Activity },
      completed: { text: '已完成', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle }
    };
    
    return statusConfig[status] || statusConfig.pending;
  };

  // 渲染进度标签页
  const renderProgressTab = () => (
    <div className="space-y-6">
      {/* 总体进度统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">参与人员</p>
              <p className="text-2xl font-semibold text-gray-900">
                {progressData?.completed_assignments || 0} / {progressData?.total_assignments || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">完成率</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(progressData?.completion_rate || 0)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">QA对总数</p>
              <p className="text-2xl font-semibold text-gray-900">
                {progressData?.total_qa_pairs || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Edit3 className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">修改率</p>
              <p className="text-2xl font-semibold text-gray-900">
                {Math.round(progressData?.modification_rate || 0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">整体进度</h3>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressData?.completion_rate || 0}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {progressData?.completed_assignments || 0} 人已完成，
          {(progressData?.total_assignments || 0) - (progressData?.completed_assignments || 0)} 人进行中
        </p>
      </div>

      {/* 参与人员列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">参与人员</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {participants.map((participant) => {
            const statusDisplay = getStatusDisplay(participant.status);
            const StatusIcon = statusDisplay.icon;
            
            return (
              <div key={participant.user_id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {participant.user_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        第 {participant.start_index} - {participant.end_index} 条
                        （共 {participant.qa_count} 条）
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      {participant.started_at && (
                        <p className="text-xs text-gray-500">
                          开始: {new Date(participant.started_at).toLocaleString('zh-CN')}
                        </p>
                      )}
                      {participant.completed_at && (
                        <p className="text-xs text-gray-500">
                          完成: {new Date(participant.completed_at).toLocaleString('zh-CN')}
                        </p>
                      )}
                    </div>
                    
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusDisplay.text}
                    </span>
                    
                    {/* 管理员操作 */}
                    {participant.status === 'completed' && task.status !== 'finalized' && (
                      <button
                        onClick={() => {
                          setRejectingAssignment(participant);
                          setShowRejectModal(true);
                        }}
                        className="ml-2 p-1 text-red-400 hover:text-red-600 transition-colors"
                        title="打回任务"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );


  // 渲染汇总标签页
  const renderSummaryTab = () => (
    <div className="space-y-6">
      {/* 汇总列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">QA对汇总</h3>
            <button
              onClick={exportTask}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              导出结果
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {summaryData.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无汇总数据</h3>
              <p className="text-gray-600">等待参与者提交任务后显示汇总结果</p>
            </div>
          ) : (
            summaryData.map((item) => {
              const isEditing = editingId === item.id;
              
              return (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-500">
                        第 {item.qa_pair_index} 个QA对
                      </span>
                      {item.is_modified && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          已修改
                        </span>
                      )}
                      {item.editor_name && (
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          编辑者: {item.editor_name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {!isEditing ? (
                        <button
                          onClick={() => startEdit(item)}
                          className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => saveEdit(item.id, item.qa_pair_id)}
                            disabled={saving}
                            className="p-2 text-green-400 hover:text-green-600 transition-colors disabled:opacity-50"
                            title="保存"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="取消"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          问题
                        </label>
                        <textarea
                          value={editForm.prompt}
                          onChange={(e) => setEditForm(prev => ({ ...prev, prompt: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          答案
                        </label>
                        <textarea
                          value={editForm.completion}
                          onChange={(e) => setEditForm(prev => ({ ...prev, completion: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={4}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">问题</p>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                          {item.edited_prompt}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">答案</p>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                          {item.edited_completion}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-6 py-3">
          <div className="text-sm text-gray-700">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchSummary(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => fetchSummary(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{task.name}</h1>
              <p className="text-sm text-gray-600 mt-1">协作任务汇总与管理</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* 最终处理按钮 */}
            {task.status === 'completed' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFinalConfirmModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  最终确认
                </button>
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重新开放
                </button>
              </div>
            )}
            
            {task.status === 'finalized' && (
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <Shield className="w-4 h-4 mr-1" />
                  已确认
                </span>
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重新开放
                </button>
              </div>
            )}
            
            <div className="text-right">
              <p className="text-sm text-gray-600">任务状态</p>
              <p className="font-medium text-gray-900">
                {task.status === 'completed' ? '已完成' : 
                 task.status === 'finalized' ? '已确认' : '进行中'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">创建时间</p>
              <p className="font-medium text-gray-900">
                {new Date(task.created_at).toLocaleDateString('zh-CN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('progress')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'progress'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            进度管理
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            汇总结果
          </button>
        </nav>
      </div>

      {/* 标签页内容 */}
      {activeTab === 'progress' && renderProgressTab()}
      {activeTab === 'summary' && renderSummaryTab()}
    </div>
  );
}


      {/* 打回任务模态框 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">打回任务</h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingAssignment(null);
                    setRejectReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  确定要打回 <span className="font-medium">{rejectingAssignment?.user_name}</span> 的任务吗？
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  打回原因
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                  placeholder="请说明打回的具体原因..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingAssignment(null);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleRejectAssignment}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  确认打回
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 最终确认模态框 */}
      {showFinalConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">最终确认</h3>
                <button
                  onClick={() => setShowFinalConfirmModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <div className="flex items-center mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
                  <p className="text-sm text-gray-600">
                    确定要最终确认此任务吗？
                  </p>
                </div>
                <p className="text-sm text-gray-500 ml-7">
                  最终确认后，任务将被锁定，无法再进行修改。请确保所有内容都已检查完毕。
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowFinalConfirmModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleFinalConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重新开放模态框 */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">重新开放任务</h3>
                <button
                  onClick={() => {
                    setShowReopenModal(false);
                    setReopenReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  确定要重新开放此任务吗？重新开放后，所有参与者都可以继续编辑。
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  重新开放原因
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="请说明重新开放的原因..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowReopenModal(false);
                    setReopenReason('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleReopenTask}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  确认重新开放
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

