import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  Calendar,
  Edit3,
  Eye,
  Info,
  Wifi,
  WifiOff
} from 'lucide-react';

export function CollaborationTaskEditor({ task, onBack }) {
  const { user } = useAuth();
  const [qaPairs, setQaPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ prompt: '', completion: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [idleWarningShown, setIdleWarningShown] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const itemsPerPage = 5;
  const AUTO_SAVE_INTERVAL = 30000; // 30秒自动暂存
  const ACTIVITY_UPDATE_INTERVAL = 60000; // 1分钟更新活动
  const IDLE_CHECK_INTERVAL = 300000; // 5分钟检查空闲状态

  // 监听网络状态
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 开始工作会话
  const startSession = useCallback(async () => {
    try {
      const response = await apiClient.startTaskSession(task.id);
      if (response.success) {
        setSessionInfo(response.data);
      }
    } catch (error) {
      console.error('开始会话失败:', error);
    }
  }, [task.id]);

  // 更新会话活动
  const updateActivity = useCallback(async () => {
    if (!isOnline) return;
    
    try {
      const response = await apiClient.updateSessionActivity(task.id);
      if (response.success) {
        setSessionInfo(response.data);
      }
    } catch (error) {
      console.error('更新活动失败:', error);
    }
  }, [task.id, isOnline]);

  // 检查空闲状态
  const checkIdleStatus = useCallback(async () => {
    if (!isOnline) return;
    
    try {
      const response = await apiClient.checkIdleStatus(task.id);
      if (response.success && response.data.should_remind && !idleWarningShown) {
        setIdleWarningShown(true);
        toast.warning(
          `您已经 ${Math.round(response.data.idle_time)} 分钟没有活动了，建议暂存当前进度`,
          {
            duration: 10000,
            action: {
              label: '立即暂存',
              onClick: () => {
                if (editingId && hasUnsavedChanges) {
                  saveEdit(editingId, true);
                }
              }
            }
          }
        );
      }
    } catch (error) {
      console.error('检查空闲状态失败:', error);
    }
  }, [task.id, isOnline, idleWarningShown, editingId, hasUnsavedChanges]);

  // 结束工作会话
  const endSession = useCallback(async () => {
    try {
      await apiClient.endTaskSession(task.id);
    } catch (error) {
      console.error('结束会话失败:', error);
    }
  }, [task.id]);

  // 组件挂载时开始会话
  useEffect(() => {
    startSession();
    
    // 定期更新活动
    const activityInterval = setInterval(updateActivity, ACTIVITY_UPDATE_INTERVAL);
    
    // 定期检查空闲状态
    const idleInterval = setInterval(checkIdleStatus, IDLE_CHECK_INTERVAL);
    
    // 组件卸载时结束会话
    return () => {
      clearInterval(activityInterval);
      clearInterval(idleInterval);
      endSession();
    };
  }, [startSession, updateActivity, checkIdleStatus, endSession]);

  // 获取协作任务的QA对
  const fetchQAPairs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const response = await apiClient.getCollaborationTaskQAPairs(task.id, {
        page,
        per_page: itemsPerPage
      });
      
      if (response.success) {
        setQaPairs(response.data.qa_pairs || []);
        setAssignmentInfo(response.data.assignment_info);
        setTotalPages(response.data.pagination?.pages || 1);
        setCurrentPage(page);
        
        // 加载草稿数据
        await loadDrafts(response.data.qa_pairs || []);
      } else {
        toast.error(`获取QA对失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`获取QA对失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  // 加载草稿数据
  const loadDrafts = async (qaPairsList) => {
    try {
      const response = await apiClient.getDrafts(task.id);
      if (response.success && response.data.drafts) {
        const draftsMap = {};
        response.data.drafts.forEach(draft => {
          draftsMap[draft.qa_pair_id] = draft;
        });
        
        // 将草稿数据合并到QA对中
        const updatedQaPairs = qaPairsList.map(qa => {
          const draft = draftsMap[qa.id];
          if (draft) {
            return {
              ...qa,
              draft_prompt: draft.draft_prompt,
              draft_completion: draft.draft_completion,
              has_draft: true,
              last_draft_saved: draft.last_saved_at
            };
          }
          return qa;
        });
        
        setQaPairs(updatedQaPairs);
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
    }
  };

  useEffect(() => {
    fetchQAPairs(1);
  }, [fetchQAPairs]);

  // 开始编辑
  const startEdit = (qaPair) => {
    if (assignmentInfo?.status === 'completed') {
      toast.warning('任务已提交，无法编辑');
      return;
    }
    
    setEditingId(qaPair.id);
    setEditForm({
      prompt: qaPair.draft_prompt || qaPair.prompt,
      completion: qaPair.draft_completion || qaPair.completion
    });
    setHasUnsavedChanges(false);
    setIdleWarningShown(false); // 重置空闲警告
    updateActivity(); // 更新活动
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ prompt: '', completion: '' });
    setHasUnsavedChanges(false);
  };

  // 保存编辑（暂存）
  const saveEdit = async (qaPairId, isAutoSave = false) => {
    if (!editForm.prompt.trim() || !editForm.completion.trim()) {
      if (!isAutoSave) {
        toast.error('问题和答案不能为空');
      }
      return;
    }

    if (!isOnline) {
      toast.error('网络连接断开，无法暂存');
      return;
    }

    try {
      setSaving(true);
      
      // 先保存草稿
      const draftResponse = await apiClient.saveDraft(task.id, {
        qa_pair_id: qaPairId,
        prompt: editForm.prompt.trim(),
        completion: editForm.completion.trim(),
        is_auto_saved: isAutoSave
      });

      if (draftResponse.success) {
        // 然后更新QA对
        const response = await apiClient.updateQAPair(task.file_id, qaPairId, {
          prompt: editForm.prompt.trim(),
          completion: editForm.completion.trim()
        });

        if (response.success) {
          setQaPairs(prev => 
            prev.map(qa => 
              qa.id === qaPairId 
                ? { 
                    ...qa, 
                    prompt: editForm.prompt.trim(), 
                    completion: editForm.completion.trim(),
                    draft_prompt: editForm.prompt.trim(),
                    draft_completion: editForm.completion.trim(),
                    has_draft: true,
                    last_draft_saved: new Date().toISOString()
                  }
                : qa
            )
          );
          
          if (!isAutoSave) {
            setEditingId(null);
            setEditForm({ prompt: '', completion: '' });
          }
          
          setHasUnsavedChanges(false);
          setLastSaveTime(new Date());
          updateActivity(); // 更新活动
          
          toast.success(isAutoSave ? '自动暂存成功' : '暂存成功');
        } else {
          toast.error(`暂存失败: ${response.error.message}`);
        }
      } else {
        toast.error(`暂存失败: ${draftResponse.error.message}`);
      }
    } catch (error) {
      toast.error(`暂存失败: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

   // 提交任务
  const submitTask = async () => {
    if (editingId && hasUnsavedChanges) {
      toast.warning('请先暂存当前编辑的内容');
      return;
    }

    // 确认提交
    const confirmed = window.confirm(
      '确定要提交任务吗？\n\n提交后将无法再次修改，请确保所有内容都已完成。'
    );
    
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const response = await apiClient.submitCollaborationTaskAssignment(task.id);

      if (response.success) {
        toast.success('任务提交成功！');
        
        // 更新分配信息状态
        setAssignmentInfo(prev => ({
          ...prev,
          status: 'completed',
          completed_at: new Date().toISOString()
        }));
        
        // 取消当前编辑
        if (editingId) {
          cancelEdit();
        }
        
        // 结束工作会话
        endSession();
        
        // 可选：返回任务列表或显示完成页面
        setTimeout(() => {
          onBack();
        }, 2000);
      } else {
        toast.error(`提交失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`提交失败: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 自动暂存
  useEffect(() => {
    if (hasUnsavedChanges && editingId && autoSaveEnabled && isOnline) {
      const timer = setTimeout(() => {
        saveEdit(editingId, true);
      }, AUTO_SAVE_INTERVAL);

      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, editingId, autoSaveEnabled, isOnline]);

  // 监听表单变化
  const handleFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
    updateActivity(); // 更新活动
  };

  // 获取任务状态显示
  const getStatusDisplay = (status) => {
    const statusMap = {
      pending: { text: '未开始', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
      in_progress: { text: '进行中', color: 'text-blue-500', bg: 'bg-blue-100', icon: Edit3 },
      completed: { text: '已提交', color: 'text-green-500', bg: 'bg-green-100', icon: CheckCircle }
    };
    return statusMap[status] || statusMap.pending;
  };

  // 渲染QA对项
  const renderQAPairItem = (qaPair, index) => {
    const isEditing = editingId === qaPair.id;
    const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
    const isReadOnly = assignmentInfo?.status === 'completed';

    return (
      <div key={qaPair.id} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">
              第 {globalIndex} 个QA对
            </span>
            {qaPair.edited_by && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                已编辑
              </span>
            )}
            {qaPair.has_draft && (
              <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                有草稿
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {assignmentInfo?.status === 'completed' ? (
              <button
                onClick={() => startEdit(qaPair)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="查看内容（已提交，无法编辑）"
              >
                <Eye className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => startEdit(qaPair)}
                className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                title="编辑"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* 问题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              问题 (Prompt)
            </label>
            {isEditing ? (
              <textarea
                value={editForm.prompt}
                onChange={(e) => handleFormChange('prompt', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="3"
                placeholder="输入问题内容"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                <p className="text-gray-900 whitespace-pre-wrap">{qaPair.prompt}</p>
              </div>
            )}
          </div>

          {/* 答案 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              答案 (Completion)
            </label>
            {isEditing ? (
              <textarea
                value={editForm.completion}
                onChange={(e) => handleFormChange('completion', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="4"
                placeholder="输入答案内容"
              />
            ) : (
              <div className="p-3 bg-gray-50 rounded-md border">
                <p className="text-gray-900 whitespace-pre-wrap">{qaPair.completion}</p>
              </div>
            )}
          </div>

          {/* 编辑操作按钮 */}
          {isEditing && (
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => saveEdit(qaPair.id)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    暂存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    暂存
                  </>
                )}
              </button>
            </div>
          )}
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

  const statusDisplay = getStatusDisplay(assignmentInfo?.status);
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回任务列表
          </button>
          
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusDisplay.bg} ${statusDisplay.color}`}>
              <StatusIcon className="w-4 h-4 mr-1" />
              {statusDisplay.text}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">任务名称</p>
              <p className="font-medium text-gray-900">{task.title}</p>
            </div>
          </div>
          
          {assignmentInfo && (
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">分配范围</p>
                <p className="font-medium text-gray-900">
                  第 {assignmentInfo.start_index + 1}-{assignmentInfo.end_index + 1} 条
                  （共 {assignmentInfo.qa_count} 条）
                </p>
              </div>
            </div>
          )}
          
          {task.deadline && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">截止时间</p>
                <p className="font-medium text-gray-900">
                  {new Date(task.deadline).toLocaleDateString('zh-CN')}
                </p>
              </div>
            </div>
          )}
          
          {lastSaveTime && (
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">最后暂存</p>
                <p className="font-medium text-gray-900">
                  {lastSaveTime.toLocaleTimeString('zh-CN')}
                </p>
              </div>
            </div>
          )}
          
          {/* 网络状态 */}
          <div className="flex items-center space-x-3">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <div>
              <p className="text-sm text-gray-600">网络状态</p>
              <p className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? '已连接' : '已断开'}
              </p>
            </div>
          </div>
        </div>

        {/* 自动暂存设置 */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">启用自动暂存（30秒）</span>
            </label>
            
            {sessionInfo && (
              <div className="text-sm text-gray-500">
                工作时长: {Math.round(sessionInfo.session_duration)} 分钟
              </div>
            )}
          </div>
          
          {!isOnline && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
              网络断开，暂存功能不可用
            </div>
          )}
        </div>

        {task.description && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">任务说明</p>
                <p className="text-sm text-blue-700">{task.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QA对列表 */}
      <div className="space-y-4">
        {qaPairs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无QA对</h3>
            <p className="text-gray-600">当前页面没有QA对数据</p>
          </div>
        ) : (
          qaPairs.map((qaPair, index) => renderQAPairItem(qaPair, index))
        )}
      </div>

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-6 py-3">
          <div className="text-sm text-gray-700">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchQAPairs(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => fetchQAPairs(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 底部操作栏 */}
      {assignmentInfo?.status !== 'completed' && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {hasUnsavedChanges && (
              <div className="flex items-center text-orange-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="text-sm">有未保存的更改</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={submitTask}
              disabled={submitting || hasUnsavedChanges}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  提交中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  提交任务
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

