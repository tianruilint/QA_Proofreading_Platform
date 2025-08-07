import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  ArrowLeft, Users, CheckCircle, Clock, Edit3, Save, User, Trash2, Undo, ChevronLeft, ChevronRight
} from 'lucide-react';

// 子组件：QA卡片
function SummaryQACard({ qaPair, onEdit, onDelete, onMarkCorrect, isEditing, editForm, setEditForm, onSave, onCancel, saving }) {
  const handleFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className={`relative hover:shadow-md transition-shadow duration-200 ${qaPair.is_reviewed ? 'border-green-300' : 'border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">
            QA对 #{qaPair.index_in_file != null ? qaPair.index_in_file + 1 : qaPair.id}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant={qaPair.edited_by ? "outline" : "secondary"}>
              {qaPair.edited_by ? "已编辑" : "原始"}
            </Badge>
            {isEditing ? (
              <>
                <Button size="sm" onClick={() => onSave(qaPair.id)} disabled={saving}>
                  <Save className="w-3 h-3 mr-1" /> {saving ? '保存中...' : '保存'}
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
                  <Undo className="w-3 h-3 mr-1" /> 取消
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => onMarkCorrect(qaPair.id, !qaPair.is_reviewed)} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                  {qaPair.is_reviewed ? "已确认" : "正确"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEdit(qaPair)}>
                  <Edit3 className="w-3 h-3 mr-1" /> 编辑
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
              <Label htmlFor={`prompt-${qaPair.id}`}>问题</Label>
              <Textarea id={`prompt-${qaPair.id}`} value={editForm.prompt} onChange={(e) => handleFormChange('prompt', e.target.value)} rows={3} />
            </div>
            <div>
              <Label htmlFor={`completion-${qaPair.id}`}>答案</Label>
              <Textarea id={`completion-${qaPair.id}`} value={editForm.completion} onChange={(e) => handleFormChange('completion', e.target.value)} rows={4} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>问题</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border"><p className="whitespace-pre-wrap text-gray-900">{qaPair.prompt}</p></div>
            </div>
            <div>
              <Label>答案</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border"><p className="whitespace-pre-wrap text-gray-900">{qaPair.completion}</p></div>
            </div>
          </div>
        )}
        {qaPair.edited_by && (
          <div className="pt-3 border-t"><div className="flex items-center gap-4 text-xs text-gray-500"><div className="flex items-center gap-1"><User className="w-3 h-3" /><span>编辑者: {qaPair.editor_name || '未知'}</span></div>{qaPair.edited_at && (<div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>编辑时间: {new Date(qaPair.edited_at).toLocaleString("zh-CN")}</span></div>)}</div></div>
        )}
      </CardContent>
    </Card>
  );
}

export function CollaborationTaskSummary({ task, onBack }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('progress');
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpToIndex, setJumpToIndex] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ prompt: '', completion: '' });
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const itemsPerPage = 5;

  const getLocalStorageKey = useCallback(() => `collab_hidden_${user?.id}_${task?.id}`, [user, task]);
  
  const handleJumpToIndex = () => {
    const totalItems = summaryData?.pagination.total;
    if (!totalItems) return;

    const index = parseInt(jumpToIndex, 10);

    if (isNaN(index) || index < 1 || index > totalItems) {
      toast.error(`请输入一个在 1 到 ${totalItems} 之间的有效序号。`);
      return;
    }

    // 计算目标页码 (QA序号是1-based)
    const targetPage = Math.ceil(index / itemsPerPage);

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    } else {
      toast.info(`QA对 #${index} 已经在当前页。`);
    }
    setJumpToIndex(''); // 跳转后清空输入框
  };
  
  const [hiddenItems, setHiddenItems] = useState([]);
  
  useEffect(() => {
    const saved = localStorage.getItem(getLocalStorageKey());
    setHiddenItems(saved ? JSON.parse(saved) : []);
  }, [task.id, getLocalStorageKey]);
  
  useEffect(() => {
    if (user && task) {
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(hiddenItems));
    }
  }, [hiddenItems, getLocalStorageKey, user, task]);


  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiClient.getCollaborationTaskSummaryData(task.id, { page, per_page: itemsPerPage });
      if (res.success) {
        setSummaryData(res.data); // 后端返回的数据结构正好是我们需要的
        setCurrentPage(page);
      } else {
        throw new Error(res.error?.message || '获取汇总数据失败');
      }

    } catch (error) {
      toast.error(`加载汇总数据失败: ${error.message}`);
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  }, [task.id, itemsPerPage]);

  useEffect(() => {
    if (task?.id) {
      fetchData(currentPage);
    }
  }, [task.id, currentPage, fetchData]);


  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= (summaryData?.pagination.pages || 1)) {
        setCurrentPage(newPage);
    }
  }

  const startEdit = (qaPair) => {
    setEditingId(qaPair.id);
    setEditForm({ prompt: qaPair.prompt, completion: qaPair.completion });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ prompt: '', completion: '' });
  };

  const saveEdit = async (qaPairId) => {
    setSaving(true);
    try {
        const response = await apiClient.updateSummaryItem(task.id, qaPairId, {
            edited_prompt: editForm.prompt,
            edited_completion: editForm.completion
        });
        
        if(response.success) {
            toast.success("QA对更新成功");
            const updatedItem = response.data;
            setSummaryData(prev => ({
                ...prev,
                summary_items: prev.summary_items.map(item => 
                    item.id === qaPairId ? { ...item, ...updatedItem } : item
                )
            }));
            cancelEdit();
        } else {
            throw new Error(response.error.message);
        }
    } catch (error) {
        toast.error(`更新失败: ${error.message}`);
    } finally {
        setSaving(false);
    }
  };

  const markCorrect = (qaId, isReviewed) => {
    setHiddenItems(prev => isReviewed ? [...new Set([...prev, qaId])] : prev.filter(id => id !== qaId));
  }

  const renderProgressView = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg"><div className="flex items-center text-blue-800"><Users className="w-6 h-6 mr-3" /><div><div className="text-3xl font-bold">{summaryData.progress_stats.total_assignments}</div><div className="text-sm">参与人数</div></div></div></div>
            <div className="bg-green-50 p-4 rounded-lg"><div className="flex items-center text-green-800"><CheckCircle className="w-6 h-6 mr-3" /><div><div className="text-3xl font-bold">{summaryData.progress_stats.completed_assignments}</div><div className="text-sm">已完成</div></div></div></div>
            <div className="bg-yellow-50 p-4 rounded-lg"><div className="flex items-center text-yellow-800"><Clock className="w-6 h-6 mr-3" /><div><div className="text-3xl font-bold">{summaryData.progress_stats.total_assignments - summaryData.progress_stats.completed_assignments}</div><div className="text-sm">进行中</div></div></div></div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">参与者详情</h3>
            <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 px-3 pb-2 border-b text-sm font-medium text-gray-500">
                    <div>参与者</div>
                    <div className="text-center">分配数量</div>
                    <div className="text-right">状态</div>
                </div>
                {summaryData.participants.map(p => (
                    <div key={p.user_id} className="grid grid-cols-3 gap-4 items-center p-3 hover:bg-gray-50 rounded-md">
                        <div className="flex items-center"><User className="w-4 h-4 mr-2 text-gray-600"/><span className="font-medium">{p.user_name}</span></div>
                        {/* BUG 5 修复: 显示删除数量 */}
                        <div className="text-center text-sm text-gray-600">
                          {p.qa_count} 条
                          {p.deleted_count > 0 && (
                            <span className="text-red-500 ml-1">(删除 {p.deleted_count} 条)</span>
                          )}
                        </div>
                        <div className="text-right"><span className={`px-2 py-1 text-xs rounded-full ${p.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{p.status === 'completed' ? '已提交' : '进行中'}</span></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderSummaryView = () => {
    const itemsWithReviewFlag = summaryData.summary_items.map(item => ({
        ...item,
        is_reviewed: hiddenItems.includes(item.id)
    }));
    const visibleQAPairs = showAll ? itemsWithReviewFlag : itemsWithReviewFlag.filter(qa => !qa.is_reviewed);
    const pageStartIndex = (currentPage - 1) * itemsPerPage + 1;
    const pageEndIndex = Math.min(currentPage * itemsPerPage, summaryData?.pagination.total || 0);
    
    return (
        <div className="space-y-4">
            {summaryData.pagination && summaryData.pagination.pages > 1 && (
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">第 {currentPage} 页，共 {summaryData.pagination.pages} 页 | 显示第 {pageStartIndex} - {pageEndIndex} 个QA对</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>首页</Button>
                        <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" />上一页</Button>
                        <span className="px-3 py-1 bg-white border rounded text-sm">{currentPage} / {summaryData.pagination.pages}</span>
                        <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === summaryData.pagination.pages}>下一页<ChevronRight className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => handlePageChange(summaryData.pagination.pages)} disabled={currentPage === summaryData.pagination.pages}>末页</Button>
                      <div className="flex items-center gap-1 ml-4">
                    	<Input 
                            type="number" 
                            placeholder="序号" 
                            className="w-20 h-9"
                            value={jumpToIndex}
                            onChange={(e) => setJumpToIndex(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleJumpToIndex(); }}
                        />
                        <Button size="sm" onClick={handleJumpToIndex}>跳转</Button>
                      </div>
                    </div>
                </div>
            )}
            {hiddenItems.length > 0 && (
                <div className="flex justify-center"><Button variant="outline" onClick={() => setShowAll(prev => !prev)}>{showAll ? '隐藏已确认' : `显示全部 (${hiddenItems.length} 个已隐藏)`}</Button></div>
            )}
            {visibleQAPairs.length > 0 ? visibleQAPairs.map((item) => (
                <SummaryQACard 
                    key={item.id}
                    qaPair={item}
                    onEdit={startEdit}
                    onMarkCorrect={markCorrect}
                    isEditing={editingId === item.id}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    saving={saving}
                />
            )) : <div className="text-center p-8 text-gray-500">所有条目均已确认。</div>}
        </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }
  
  if (!summaryData) {
    return <div className="text-center p-8">无法加载数据，请稍后再试。</div>
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回任务列表
            </Button>
            <h1 className="text-xl font-semibold">{task.title} - 汇总</h1>
        </div>
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button onClick={() => setActiveTab('progress')} className={`${activeTab === 'progress' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                    进度概览
                </button>
                <button onClick={() => setActiveTab('summary')} className={`${activeTab === 'summary' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                    数据汇总
                </button>
            </nav>
        </div>
        <div>
            {activeTab === 'progress' ? renderProgressView() : renderSummaryView()}
        </div>
    </div>
  );
}

