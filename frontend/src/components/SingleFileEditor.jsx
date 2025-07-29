import { useState, useEffect, useCallback } from 'react';
import { Upload, Download, FileText, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { FileUpload } from './FileUpload';
import { QAEditor } from './QAEditor';
import { useAuth } from '../hooks/useAuth.jsx';
import { apiClient } from '../lib/api.js';
import { useGuestSession } from '../hooks/useGuestSession.jsx';
import { toast } from 'sonner';

export function SingleFileEditor({ onSessionSave, currentSession, onBackToUpload }) {
  const [file, setFile] = useState(null);
  const [itemsPerPage] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFileId, setUploadedFileId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(true);
  const [sessionName, setSessionName] = useState('');
  const { user, isAuthenticated } = useAuth();
  if (user && user.role === 'super_admin') {
    return null;
  }
  const { 
    records: guestRecords, 
    loadRecords: loadGuestRecords, 
    updateRecord: updateGuestRecord, 
    goToRecord: goToGuestRecord, 
    markCorrect: guestMarkCorrect, 
    toggleShowAll: guestToggleShowAll, 
    clearSession: clearGuestSession,
    deleteRecord: deleteGuestRecord,
    hiddenItems: guestHiddenItems,
    showAll: guestShowAll,
  } = useGuestSession();

  const isGuestMode = !isAuthenticated;

  const [qaPairsState, setQAPairsState] = useState([]);
  const [currentPageState, setCurrentPageState] = useState(1);
  const [hiddenItemsState, setHiddenItemsState] = useState([]);
  const [showAllState, setShowAllState] = useState(false);
  
  const getLocalStorageKey = useCallback(() => {
    if (isGuestMode || !user?.id || !uploadedFileId) return null;
    return `single_file_hidden_${user.id}_${uploadedFileId}`;
  }, [isGuestMode, user, uploadedFileId]);
  
  useEffect(() => {
    const key = getLocalStorageKey();
    if (key) {
      localStorage.setItem(key, JSON.stringify(hiddenItemsState));
    }
  }, [hiddenItemsState, getLocalStorageKey]);

  // --- State Management Logic ---
  const qaPairs = isGuestMode ? guestRecords : qaPairsState;
  const currentPage = isGuestMode ? (Math.floor(guestRecords.findIndex(r => r.id === guestRecords[0]?.id) / itemsPerPage) || 0) + 1 : currentPageState;
  const hiddenItems = isGuestMode ? guestHiddenItems : hiddenItemsState;
  const showAll = isGuestMode ? guestShowAll : showAllState;
  
  const totalPages = Math.ceil(qaPairs.length / itemsPerPage);
  const currentQAPairs = qaPairs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    if (isGuestMode) {
      const recordIndex = (page - 1) * itemsPerPage;
      if (qaPairs[recordIndex]) {
        goToGuestRecord(recordIndex);
      }
    } else {
      setCurrentPageState(page);
    }
  };
  
  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setError("");
    try {
      if (isGuestMode) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target.result;
            const lines = text.split("\n").filter(line => line.trim());
            const pairs = lines.map((line, index) => {
              const parsedLine = JSON.parse(line);
              return {
                id: `guest_${Date.now()}_${index}`,
                prompt: parsedLine.prompt || parsedLine.question || "",
                completion: parsedLine.completion || parsedLine.answer || "",
                index_in_file: index, 
              };
            });
            loadGuestRecords(pairs);
          } catch (err) {
            setError(`文件解析失败: ${err.message}`);
          }
        };
        reader.readAsText(selectedFile);
      } else {
        const response = await apiClient.uploadFile(selectedFile);
        if (response.success) {
          setUploadedFileId(response.data.file.id);
          const qaResponse = await apiClient.getFileQAPairs(response.data.file.id);
          if (qaResponse.success) {
            setQAPairsState(qaResponse.data.qa_pairs);
          } else {
            setError(`获取QA对失败: ${qaResponse.error.message}`);
          }
        } else {
          setError(`文件上传失败: ${response.error.message}`);
        }
      }
      setSessionName(selectedFile.name);
      setShowUploadArea(false);
      setHasChanges(false);
      setCurrentPageState(1);
      setHiddenItemsState([]);
      setShowAllState(false);
      if (!isGuestMode && onSessionSave) {
        onSessionSave();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentSession && !isGuestMode) {
      const loadSessionData = async () => {
        setLoading(true);
        setError("");
        try {
          setUploadedFileId(currentSession.id);
          setSessionName(currentSession.original_filename);
          setFile({ name: currentSession.original_filename });
          setShowUploadArea(false);
          
          const key = `single_file_hidden_${user.id}_${currentSession.id}`;
          const savedHiddenItems = localStorage.getItem(key);
          setHiddenItemsState(savedHiddenItems ? JSON.parse(savedHiddenItems) : []);
          const qaResponse = await apiClient.getFileQAPairs(currentSession.id);
          if (qaResponse.success) {
            setQAPairsState(qaResponse.data.qa_pairs);
          } else {
            setError(`加载会话QA对失败: ${qaResponse.error.message}`);
          }
        } catch (err) {
          setError(`加载会话失败: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      loadSessionData();
    } else {
      setShowUploadArea(true);
    }
  }, [currentSession, isGuestMode]);

  const handleQAUpdate = async (qaId, updateData) => {
    try {
      if (isGuestMode) {
        updateGuestRecord(qaId, updateData);
      } else {
        await apiClient.updateQAPair(uploadedFileId, qaId, updateData);
        const response = await apiClient.getFileQAPairs(uploadedFileId);
        if (response.success) {
          setQAPairsState(response.data.qa_pairs);
        }
      }
      setHasChanges(true);
    } catch (err) {
      toast.error(`更新失败: ${err.message}`);
    }
  };

  const handleQADelete = async (qaId) => {
    try {
      if (isGuestMode) {
        deleteGuestRecord(qaId);
      } else {
        await apiClient.deleteQAPair(uploadedFileId, qaId);
        setQAPairsState(prev => prev.filter(qa => qa.id !== qaId));
        setHiddenItemsState(prev => prev.filter(id => id !== qaId));
      }
      toast.success("QA对已删除");
      setHasChanges(true);
    } catch (err) {
      toast.error(`删除失败: ${err.message}`);
    }
  };

  const handleMarkCorrect = (qaId) => {
    if (isGuestMode) {
      guestMarkCorrect(qaId);
    } else {
      setHiddenItemsState(prev => {
        if (prev.includes(qaId)) {
          return prev.filter(id => id !== qaId);
        } else {
          return [...prev, qaId];
        }
      });
    }
    setHasChanges(true);
  };

  const handleToggleShowAll = () => {
    if (isGuestMode) {
      guestToggleShowAll();
    } else {
      setShowAllState(prev => !prev);
    }
  };
  
  const handleExport = async (format = 'jsonl') => {
    try {
      setLoading(true);
      setError('');
      let blob;
      let filename;

      if (isGuestMode) {
        const dataToExport = guestRecords.map(qa => ({ prompt: qa.prompt, completion: qa.completion }));
        if (format === 'excel') {
            const XLSX = await import('xlsx');
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "QA Pairs");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            blob = new Blob([excelBuffer], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
            filename = `guest_session_${Date.now()}.xlsx`;
        } else {
            const jsonlContent = dataToExport.map(item => JSON.stringify(item)).join('\n');
            blob = new Blob([jsonlContent], { type: 'application/jsonl;charset=utf-8,' });
            filename = `guest_session_${Date.now()}.jsonl`;
        }
      } else if (uploadedFileId) {
        blob = await apiClient.exportFile(uploadedFileId, format);
        const tempName = file.name || sessionName || 'download';
        filename = `${tempName.replace(/\.[^/.]+$/, "")}_edited.${format === 'excel' ? 'xlsx' : 'jsonl'}`;
      } else {
        throw new Error("没有可导出的文件");
      }
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (err) {
      setError(`导出失败: ${err.message}`);
      toast.error(`导出失败: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const handleBackToUpload = () => {
    if (onBackToUpload) {
      onBackToUpload();
    }
    setShowUploadArea(true);
    setFile(null);
    setQAPairsState([]);
    setUploadedFileId(null);
    clearGuestSession();
    setHasChanges(false);
    setSessionName("");
    setCurrentPageState(1);
    setError("");
  };

  if (showUploadArea) {
    return (
      <div className="h-full flex flex-col">
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">单文件QA对校对</h1>
          <p className="text-gray-600">
            {isGuestMode 
              ? '访客模式：上传JSONL文件进行临时编辑，数据不会保存到服务器'
              : '上传JSONL文件进行QA对编辑和校对，支持数据持久化存储'
            }
          </p>
        </div>
        {isGuestMode && (<Alert className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>您当前处于访客模式，编辑的数据仅在当前会话中有效。如需永久保存，请登录后使用。</AlertDescription></Alert>)}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />文件上传</CardTitle>
            <CardDescription>选择JSONL格式的文件开始编辑。文件中每行应包含一个JSON对象，包含prompt和completion字段。</CardDescription>
          </CardHeader>
          <CardContent><FileUpload onFileSelect={handleFileSelect}/></CardContent>
        </Card>
        {loading && (<Card className="mt-4"><CardContent className="p-8 text-center"><div className="flex items-center justify-center gap-3"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div><span className="text-gray-600">{isGuestMode ? '解析文件中...' : '上传文件中...'}</span></div></CardContent></Card>)}
        {error && (<Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>)}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <Button variant="ghost" size="sm" onClick={handleBackToUpload} className="text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4 mr-2" />返回上传</Button>
          <div className="flex items-center gap-2 flex-wrap"><FileText className="w-5 h-5 text-blue-600" /><h2 className="text-lg font-semibold text-gray-900 break-all">{sessionName}</h2><span className="text-sm text-gray-500">({qaPairs.length} 个QA对)</span></div>
          {hasChanges && (<span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded whitespace-nowrap">有未保存的更改</span>)}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => handleExport('jsonl')} disabled={qaPairs.length === 0 || loading} className="flex-1 sm:flex-none"><Download className="w-4 h-4 mr-2" />{loading ? '导出中...' : '导出JSONL'}</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={qaPairs.length === 0 || loading} className="flex-1 sm:flex-none"><Download className="w-4 h-4 mr-2" />{loading ? '导出中...' : '导出Excel'}</Button>
        </div>
      </div>
      {error && (<Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>)}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600 text-center sm:text-left">第 {currentPage} 页，共 {totalPages} 页 | 显示第 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, qaPairs.length)} 个QA对</span>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="hidden sm:inline-flex">首页</Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">上一页</span></Button>
            <span className="px-3 py-1 bg-white border rounded text-sm">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><span className="hidden sm:inline">下一页</span><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="hidden sm:inline-flex">末页</Button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto space-y-4">
        <QAEditor 
          qaPairs={currentQAPairs} 
          onUpdate={handleQAUpdate} 
          onDelete={handleQADelete} 
          onMarkCorrect={handleMarkCorrect} 
          onToggleShowAll={handleToggleShowAll} 
          hiddenItems={hiddenItems} 
          showAll={showAll} 
          hasMarkedCorrect={hiddenItems.length > 0} 
          showEditHistory={!isGuestMode} 
          currentUser={user} 
        />
      </div>
    </div>
  );
}

