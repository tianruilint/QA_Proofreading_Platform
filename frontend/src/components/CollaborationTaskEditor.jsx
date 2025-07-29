import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, Save, Send, FileText, Clock, CheckCircle, 
  Users, Calendar, Edit3, AlertTriangle, Undo, Trash2, ChevronLeft, ChevronRight, Check
} from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

// 子组件：QA卡片
function EditorQACard({ qa, onEdit, onDelete, onMarkCorrect, isEditing, editData, setEditData, onSave, onCancel, saving, isReadOnly }) {
  const handleFormChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className={`relative hover:shadow-md transition-shadow duration-200 ${qa.is_reviewed ? 'border-green-300' : 'border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">
            QA对 #{qa.index_in_file + 1}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant={qa.has_draft ? "outline" : "secondary"}>
              {qa.has_draft ? "有草稿" : "原始"}
            </Badge>
            {isEditing ? (
              <>
                <Button size="sm" onClick={() => onSave(qa.id)} disabled={saving || isReadOnly}>
                  <Save className="w-3 h-3 mr-1" /> {saving ? '暂存中...' : '暂存'}
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel} disabled={saving || isReadOnly}>
                  <Undo className="w-3 h-3 mr-1" /> 取消
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => onMarkCorrect(qa.id, !qa.is_reviewed)} className="text-green-600 hover:text-green-700 hover:bg-green-50" disabled={isReadOnly}>
                  {qa.is_reviewed ? <Check className="w-4 h-4 mr-1" /> : null}
                  {qa.is_reviewed ? "已确认" : "正确"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEdit(qa)} disabled={isReadOnly}>
                  <Edit3 className="w-3 h-3 mr-1" /> 编辑
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDelete(qa.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50" disabled={isReadOnly}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`prompt-${qa.id}`}>问题</Label>
              <Textarea id={`prompt-${qa.id}`} value={editData.prompt} onChange={(e) => handleFormChange('prompt', e.target.value)} rows={3} />
            </div>
            <div>
              <Label htmlFor={`completion-${qa.id}`}>答案</Label>
              <Textarea id={`completion-${qa.id}`} value={editData.completion} onChange={(e) => handleFormChange('completion', e.target.value)} rows={4} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>问题</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border"><p className="whitespace-pre-wrap text-gray-900">{qa.prompt}</p></div>
            </div>
            <div>
              <Label>答案</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border"><p className="whitespace-pre-wrap text-gray-900">{qa.completion}</p></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CollaborationTaskEditor({ task, onBack }) {
  const { user } = useAuth();
  const [qaPairs, setQaPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [assignmentInfo, setAssignmentInfo] = useState(null);
  const [taskInfo, setTaskInfo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ prompt: '', completion: '' });
  
  const getLocalStorageKey = useCallback(() => `collab_editor_hidden_${user?.id}_${task?.id}`, [user, task]);
  
    useEffect(() => {
    const saved = localStorage.getItem(getLocalStorageKey());
    setHiddenItems(saved ? JSON.parse(saved) : []);
  }, [task.id, getLocalStorageKey]);
  
  const [hiddenItems, setHiddenItems] = useState(() => {
      if (!user || !task) return [];
      const saved = localStorage.getItem(getLocalStorageKey());
      return saved ? JSON.parse(saved) : [];
  });

  const [showAll, setShowAll] = useState(false);
  const itemsPerPage = 5;

  useEffect(() => {
    if (user && task) {
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(hiddenItems));
    }
  }, [hiddenItems, getLocalStorageKey, user, task]);

  const fetchEditorData = useCallback(async (page = 1) => {
    if (!task || !task.id) {
        toast.error("任务信息无效，正在返回列表...");
        setTimeout(onBack, 1500);
        return;
    }
    try {
      setLoading(true);
      const response = await apiClient.getCollaborationTaskEditorData(task.id, { page, per_page: itemsPerPage });
      if (response.success) {
        const pairs = response.data.qa_pairs || [];
        const pairsWithReviewFlag = pairs.map(p => ({
            ...p,
            is_reviewed: hiddenItems.includes(p.id)
        }));
        setQaPairs(pairsWithReviewFlag);
        setAssignmentInfo(response.data.assignment_info);
        setTaskInfo(response.data.task_info);
        setTotalPages(response.data.pagination?.pages || 1);
        setTotalItems(response.data.pagination?.total || 0);
        setCurrentPage(page);
      } else {
        toast.error(`获取QA对失败: ${response.error.message}`);
        if(response.error.code === 'NOT_ASSIGNED') setTimeout(onBack, 2000);
      }
    } catch (error) {
      toast.error(`获取QA对失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [task, onBack, hiddenItems, itemsPerPage]);

  useEffect(() => {
    fetchEditorData(currentPage);
  }, [fetchEditorData, currentPage]);

  const startEdit = (qaPair) => {
    if (assignmentInfo?.status === 'completed' || assignmentInfo?.status === 'overdue') {
      toast.warning(`任务已${assignmentInfo?.status === 'completed' ? '提交' : '逾期'}，无法编辑`);
      return;
    }
    setEditingId(qaPair.id);
    setEditForm({ prompt: qaPair.prompt, completion: qaPair.completion });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ prompt: '', completion: '' });
  };

  const saveEdit = async (qaPairId) => {
    if (!editForm.prompt.trim() || !editForm.completion.trim()) {
      toast.error('问题和答案不能为空');
      return;
    }
    setSaving(true);
    try {
      const response = await apiClient.saveDraft(task.id, {
        qa_pair_id: qaPairId,
        prompt: editForm.prompt.trim(),
        completion: editForm.completion.trim(),
      });
      if (response.success) {
        setQaPairs(prev => prev.map(qa => qa.id === qaPairId ? { ...qa, prompt: editForm.prompt, completion: editForm.completion, has_draft: true } : qa));
        cancelEdit();
        toast.success('暂存成功');
      } else {
        toast.error(`暂存失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`暂存失败: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (qaId) => {
      if (window.confirm("确定要删除这个QA对吗？此操作会立即生效。")) {
        try {
            const response = await apiClient.deleteCollaborationQAPair(task.id, qaId);
            if (response.success) {
                toast.success("QA对已标记为删除");
                setHiddenItems(prev => prev.filter(id => id !== qaId));
                fetchEditorData(currentPage);
            } else {
                toast.error(`删除失败: ${response.error.message}`);
            }
        } catch (error) {
            toast.error(`删除失败: ${error.message}`);
        }
      }
  };
  
  const handleMarkCorrect = (qaId, isReviewed) => {
    setHiddenItems(prev => isReviewed ? [...new Set([...prev, qaId])] : prev.filter(id => id !== qaId));
  };

  const submitTask = async () => {
    if (editingId) {
      toast.warning('请先保存或取消当前正在编辑的内容');
      return;
    }
    if (window.confirm('确定要提交任务吗？所有暂存的修改和删除都将生效，提交后无法再次修改。')) {
      setSubmitting(true);
      try {
        const response = await apiClient.submitCollaborationTaskAssignment(task.id);
        if (response.success) {
          toast.success('任务提交成功！');
          localStorage.removeItem(getLocalStorageKey());
          setTimeout(onBack, 1500);
        } else {
          toast.error(`提交失败: ${response.error.message}`);
        }
      } catch (error) {
        toast.error(`提交失败: ${error.message}`);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const getStatusDisplay = (status) => {
    const statusMap = {
      pending: { text: '未开始', color: 'text-gray-500', bg: 'bg-gray-100', icon: Clock },
      in_progress: { text: '进行中', color: 'text-blue-500', bg: 'bg-blue-100', icon: Edit3 },
      completed: { text: '已提交', color: 'text-green-500', bg: 'bg-green-100', icon: CheckCircle },
      overdue: { text: '已逾期', color: 'text-red-500', bg: 'bg-red-100', icon: AlertTriangle }
    };
    return statusMap[status] || statusMap.pending;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  const statusDisplay = getStatusDisplay(assignmentInfo?.status);
  const StatusIcon = statusDisplay.icon;
  // BUG 4 修复: 定义只读状态
  const isReadOnly = assignmentInfo?.status === 'completed' || assignmentInfo?.status === 'overdue';
  const visibleQAPairs = showAll ? qaPairs : qaPairs.filter(qa => !qa.is_reviewed);
  const pageStartIndex = (currentPage - 1) * itemsPerPage + 1;
  const pageEndIndex = pageStartIndex + qaPairs.length - 1;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4 mr-2" />返回任务列表</Button>
          <div className="flex items-center space-x-2"><span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusDisplay.bg} ${statusDisplay.color}`}><StatusIcon className="w-4 h-4 mr-1" />{statusDisplay.text}</span></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3"><FileText className="w-5 h-5 text-blue-500" /><div><p className="text-sm text-gray-600">任务名称</p><p className="font-medium text-gray-900">{task.title}</p></div></div>
          {assignmentInfo && <div className="flex items-center space-x-3"><Users className="w-5 h-5 text-green-500" /><div><p className="text-sm text-gray-600">分配范围</p><p className="font-medium text-gray-900">第 {assignmentInfo.start_index + 1}-{assignmentInfo.end_index + 1} 条（共 {assignmentInfo.qa_count} 条）</p></div></div>}
          {taskInfo?.deadline && <div className="flex items-center space-x-3"><Calendar className="w-5 h-5 text-orange-500" /><div><p className="text-sm text-gray-600">截止时间</p><p className="font-medium text-gray-900">{new Date(taskInfo.deadline).toLocaleString('zh-CN')}</p></div></div>}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">第 {currentPage} 页 / 共 {totalPages} 页 | 显示第 {pageStartIndex} - {pageEndIndex} 个QA对 (共 {totalItems} 条)</span>
          <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>首页</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" />上一页</Button>
              <span className="px-3 py-1 bg-white border rounded text-sm">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>下一页<ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>末页</Button>
     	    </div>
        </div>
      )}

      {hiddenItems.length > 0 && (
        <div className="flex justify-center"><Button variant="outline" onClick={() => setShowAll(prev => !prev)}>{showAll ? '隐藏已确认' : `显示全部 (${hiddenItems.length} 个已隐藏)`}</Button></div>
      )}

      <div className="space-y-4">
        {visibleQAPairs.length > 0 ? visibleQAPairs.map((qaPair) => (
          <EditorQACard
            key={qaPair.id}
            qa={qaPair}
            onEdit={startEdit}
            onDelete={handleDelete}
            onMarkCorrect={handleMarkCorrect}
            isEditing={editingId === qaPair.id}
            editData={editForm}
            setEditData={setEditForm}
            onSave={saveEdit}
            onCancel={cancelEdit}
            saving={saving}
            // BUG 4 修复: 传递只读状态
            isReadOnly={isReadOnly}
          />
        )) : <div className="text-center p-8 text-gray-500">所有条目均已确认。</div>}
      </div>

      {/* BUG 4 修复: 只有在非只读状态下才显示提交按钮 */}
      {!isReadOnly && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex items-center justify-end">
          <Button onClick={submitTask} disabled={submitting || editingId} size="lg">
            {submitting ? '提交中...' : <><Send className="w-4 h-4 mr-2" />提交任务</>}
          </Button>
        </div>
      )}
    </div>
  );
}

