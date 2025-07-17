import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Save,
  Trash2,
  Loader2,
  FileText
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';

export function SingleFileEditor() {
  const [file, setFile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [qaPairs, setQaPairs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  
  const { isGuest } = useAuth();

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.jsonl')) {
      setError('请选择JSONL格式的文件');
      return;
    }

    setFile(selectedFile);
    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.uploadSingleFile(selectedFile);
      if (response.success) {
        setSessionId(response.data.session_id);
        setSuccess(`文件上传成功！共包含 ${response.data.total_qa_pairs} 个QA对`);
        loadQAPairs(response.data.session_id, 1);
      } else {
        setError('文件上传失败');
      }
    } catch (error) {
      setError('文件上传失败: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const loadQAPairs = async (sessionId, page = currentPage, search = searchTerm) => {
    setLoading(true);
    try {
      const response = await apiClient.getSingleFileQAPairs(sessionId, page, pageSize, search);
      if (response.success) {
        setQaPairs(response.data.qa_pairs);
        setCurrentPage(response.data.pagination.page);
        setTotalPages(response.data.pagination.total_pages);
        setTotalCount(response.data.pagination.total);
      } else {
        setError('加载QA对失败');
      }
    } catch (error) {
      setError('加载QA对失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    if (sessionId) {
      setCurrentPage(1);
      loadQAPairs(sessionId, 1, searchTerm);
    }
  }, [sessionId, searchTerm]);

  const handlePageChange = (newPage) => {
    if (sessionId && newPage >= 1 && newPage <= totalPages) {
      loadQAPairs(sessionId, newPage);
    }
  };

  const startEditing = (qaPair) => {
    setEditingId(qaPair.id);
    setEditingData({
      prompt: qaPair.prompt,
      completion: qaPair.completion,
      is_deleted: qaPair.is_deleted
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({});
  };

  const saveEdit = async (qaId) => {
    try {
      const response = await apiClient.updateSingleFileQAPair(sessionId, qaId, editingData);
      if (response.success) {
        setQaPairs(qaPairs.map(qa => 
          qa.id === qaId ? response.data.qa_pair : qa
        ));
        setEditingId(null);
        setEditingData({});
        setSuccess('保存成功');
      } else {
        setError('保存失败');
      }
    } catch (error) {
      setError('保存失败: ' + error.message);
    }
  };

  const toggleDelete = async (qaId, currentDeleteStatus) => {
    try {
      const response = await apiClient.updateSingleFileQAPair(sessionId, qaId, {
        is_deleted: !currentDeleteStatus
      });
      if (response.success) {
        setQaPairs(qaPairs.map(qa => 
          qa.id === qaId ? response.data.qa_pair : qa
        ));
        setSuccess(currentDeleteStatus ? '已恢复' : '已删除');
      } else {
        setError('操作失败');
      }
    } catch (error) {
      setError('操作失败: ' + error.message);
    }
  };

  const exportFile = async (format) => {
    if (!sessionId) return;

    try {
      const response = format === 'jsonl' 
        ? await apiClient.exportSingleFileJsonl(sessionId)
        : await apiClient.exportSingleFileExcel(sessionId);
      
      if (response.success) {
        const downloadUrl = apiClient.getDownloadUrl(response.data.filename);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setSuccess(`导出成功！共 ${response.data.total_qa_pairs} 个有效QA对`);
      } else {
        setError('导出失败');
      }
    } catch (error) {
      setError('导出失败: ' + error.message);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  return (
    <div className="container mx-auto p-6 space-y-6 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">单文件QA对校对</h1>
          <p className="text-muted-foreground mt-1">
            上传JSONL文件进行可视化编辑和校对
            {isGuest && (
              <span className="ml-2 text-orange-600">（访客模式 - 数据不会保存到服务器）</span>
            )}
          </p>
        </div>
      </div>

      {/* 文件上传区域 */}
      {!sessionId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>上传JSONL文件</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center min-h-[320px] flex items-center justify-center">
              <div className="space-y-6">
                <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
                <div className="space-y-4">
                  <p className="text-2xl font-medium">选择或拖拽JSONL文件</p>
                  <p className="text-lg text-muted-foreground">
                    文件格式：每行一个JSON对象，包含"prompt"和"completion"字段
                  </p>
                  <input
                    type="file"
                    accept=".jsonl"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button asChild disabled={uploading} size="lg" className="mt-6">
                      <span>
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-5 w-5" />
                            选择文件
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误和成功提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* QA对编辑区域 */}
      {sessionId && (
        <>
          {/* 工具栏 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索QA对内容..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={() => exportFile('jsonl')} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    导出JSONL
                  </Button>
                  <Button onClick={() => exportFile('excel')} variant="outline">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    导出Excel
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  共 {totalCount} 个QA对，第 {currentPage} / {totalPages} 页
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QA对列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {qaPairs.map((qaPair, index) => (
                <Card key={qaPair.id} className={qaPair.is_deleted ? 'opacity-50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          #{qaPair.original_index + 1}
                        </Badge>
                        {qaPair.is_deleted && (
                          <Badge variant="destructive">已删除</Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {editingId === qaPair.id ? (
                          <>
                            <Button size="sm" onClick={() => saveEdit(qaPair.id)}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEditing}>
                              取消
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEditing(qaPair)}>
                              编辑
                            </Button>
                            <Button 
                              size="sm" 
                              variant={qaPair.is_deleted ? "default" : "destructive"}
                              onClick={() => toggleDelete(qaPair.id, qaPair.is_deleted)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {qaPair.is_deleted ? '恢复' : '删除'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">问题 (Prompt)</label>
                      {editingId === qaPair.id ? (
                        <Textarea
                          value={editingData.prompt}
                          onChange={(e) => setEditingData({...editingData, prompt: e.target.value})}
                          rows={3}
                        />
                      ) : (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="whitespace-pre-wrap">{qaPair.prompt}</p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">答案 (Completion)</label>
                      {editingId === qaPair.id ? (
                        <Textarea
                          value={editingData.completion}
                          onChange={(e) => setEditingData({...editingData, completion: e.target.value})}
                          rows={3}
                        />
                      ) : (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="whitespace-pre-wrap">{qaPair.completion}</p>
                        </div>
                      )}
                    </div>
                    
                    {qaPair.last_edited_at && (
                      <div className="text-xs text-muted-foreground">
                        最后编辑: {new Date(qaPair.last_edited_at).toLocaleString('zh-CN')}
                        {qaPair.editor_name && ` by ${qaPair.editor_name}`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

