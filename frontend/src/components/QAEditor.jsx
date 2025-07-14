import { useState, useEffect } from 'react';
import { Save, Undo, Edit3, Eye, Trash2, User, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Label } from './ui/label';

export function QAEditor({ 
  qaPairs, 
  onUpdate, 
  onDelete, 
  readOnly = false, 
  showEditHistory = false,
  currentUser = null 
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editData, setEditData] = useState({ prompt: '', completion: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (index, qa) => {
    setEditingIndex(index);
    setEditData({
      prompt: qa.prompt || '',
      completion: qa.completion || ''
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditData({ prompt: '', completion: '' });
    setError('');
  };

  const saveEdit = async (index, qa) => {
    if (!editData.prompt.trim() || !editData.completion.trim()) {
      setError('问题和答案不能为空');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onUpdate(qa.id, {
        prompt: editData.prompt.trim(),
        completion: editData.completion.trim()
      });
      setEditingIndex(null);
      setEditData({ prompt: '', completion: '' });
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (qa) => {
    if (window.confirm('确定要删除这个QA对吗？')) {
      try {
        await onDelete(qa.id);
      } catch (error) {
        setError(error.message);
      }
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getEditStatusBadge = (qa) => {
    if (!qa.edited_by) {
      return <Badge variant="secondary">原始</Badge>;
    }
    return <Badge variant="outline">已编辑</Badge>;
  };

  if (!qaPairs || qaPairs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">暂无QA对数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {qaPairs.map((qa, index) => (
        <Card key={qa.id || index} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                QA对 #{qa.index_in_file !== undefined ? qa.index_in_file + 1 : index + 1}
              </CardTitle>
              <div className="flex items-center gap-2">
                {getEditStatusBadge(qa)}
                {!readOnly && (
                  <div className="flex gap-1">
                    {editingIndex === index ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => saveEdit(index, qa)}
                          disabled={saving}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          <Undo className="w-3 h-3 mr-1" />
                          取消
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(index, qa)}
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(qa)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {editingIndex === index ? (
              // 编辑模式
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`prompt-${index}`}>问题</Label>
                  <textarea
                    id={`prompt-${index}`}
                    value={editData.prompt}
                    onChange={(e) => setEditData(prev => ({ ...prev, prompt: e.target.value }))}
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="请输入问题..."
                  />
                </div>
                <div>
                  <Label htmlFor={`completion-${index}`}>答案</Label>
                  <textarea
                    id={`completion-${index}`}
                    value={editData.completion}
                    onChange={(e) => setEditData(prev => ({ ...prev, completion: e.target.value }))}
                    className="w-full mt-1 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="请输入答案..."
                  />
                </div>
              </div>
            ) : (
              // 查看模式
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">问题</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border">
                    <p className="whitespace-pre-wrap text-gray-900">{qa.prompt}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">答案</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border">
                    <p className="whitespace-pre-wrap text-gray-900">{qa.completion}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 编辑历史信息 */}
            {showEditHistory && qa.edited_by && (
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>编辑者: {qa.editor?.display_name || '未知'}</span>
                  </div>
                  {qa.edited_at && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>编辑时间: {formatDateTime(qa.edited_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

