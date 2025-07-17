import { useState, useEffect } from 'react';
import { Upload, Download, Save, FileText, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { FileUpload } from './FileUpload';
import { QAEditor } from './QAEditor';
import { useAuth } from '../hooks/useAuth.jsx';
import { apiClient } from '../lib/api.js';
import { useGuestSession } from '../hooks/useGuestSession.jsx';
import { toast } from 'sonner';

// 1. 接收新的 onBackToUpload 属性
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
  const { records: guestRecords, currentRecordIndex: guestCurrentRecordIndex, hiddenItems: guestHiddenItems, showAll: guestShowAll, hasMarkedCorrect: guestHasMarkedCorrect, loadRecords: loadGuestRecords, updateRecord: updateGuestRecord, goToRecord: goToGuestRecord, markCorrect: guestMarkCorrect, toggleShowAll: guestToggleShowAll, clearSession: clearGuestSession } = useGuestSession();

  const isGuestMode = !isAuthenticated;

  const [qaPairsState, setQAPairsState] = useState([]);
  const [currentPageState, setCurrentPageState] = useState(1);
  const [hiddenItemsState, setHiddenItemsState] = useState([]);
  const [showAllState, setShowAllState] = useState(false);
  const [hasMarkedCorrectState, setHasMarkedCorrectState] = useState(false);

  const qaPairs = isGuestMode ? guestRecords : qaPairsState;
  const setQAPairs = isGuestMode ? loadGuestRecords : setQAPairsState;
  const currentPage = isGuestMode ? guestCurrentRecordIndex + 1 : currentPageState;
  const setCurrentPage = isGuestMode ? (page) => goToGuestRecord(page - 1) : setCurrentPageState;
  const hiddenItems = isGuestMode ? guestHiddenItems : hiddenItemsState;
  const showAll = isGuestMode ? guestShowAll : showAllState;
  const hasMarkedCorrect = isGuestMode ? guestHasMarkedCorrect : hasMarkedCorrectState;

  const totalPages = Math.ceil(qaPairs.length / itemsPerPage);
  const currentQAPairs = qaPairs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const parseJSONLFile = async (file) => {
    // ... (此函数保持不变)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split("\n").filter(line => line.trim());
          const pairs = lines.map((line, index) => {
            try {
              const obj = JSON.parse(line);
              return { id: `temp_${index}`, index_in_file: index, prompt: obj.prompt || obj.question || "", completion: obj.completion || obj.answer || "" };
            } catch (err) {
              throw new Error(`第 ${index + 1} 行JSON格式错误: ${err.message}`);
            }
          });
          resolve(pairs);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (selectedFile) => {
    // ... (此函数保持不变)
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setError("");
    let response;
    try {
      if (isGuestMode) {
        const pairs = await parseJSONLFile(selectedFile);
        loadGuestRecords(pairs);
      } else {
        response = await apiClient.uploadFile(selectedFile);
        if (response.success) {
          setUploadedFileId(response.data.file.id);
          const qaResponse = await apiClient.getFileQAPairs(response.data.file.id);
          if (qaResponse.success) {
            setQAPairsState(qaResponse.data.qa_pairs);
            if (qaResponse.data.qa_pairs.length === 0) {
              setError("文件上传成功，但未找到有效的QA对数据。");
            }
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
      setCurrentPage(1);
      setHiddenItemsState([]);
      setShowAllState(false);
      setHasMarkedCorrectState(false);
      if (!isGuestMode && onSessionSave && response && response.success) {
        onSessionSave();
      }
    } catch (error) {
      setError(error.message);
      setFile(null);
      setQAPairs([]);
    } finally {
      setLoading(false);
    }
  };

  // 2. 改造 useEffect 以处理“已确认”状态的持久化
  useEffect(() => {
    if (currentSession && !isGuestMode) {
      const loadSessionData = async () => {
        try {
          setLoading(true);
          setError("");
          setUploadedFileId(currentSession.fileId);
          const sessionFile = { name: currentSession.name, type: 'application/jsonl' };
          setFile(sessionFile);
          setSessionName(currentSession.name);
          setShowUploadArea(false);
          
          // 从 localStorage 加载此会话的隐藏项
          const savedHiddenItems = localStorage.getItem(`hiddenItems_${user.id}_${currentSession.fileId}`);
          const hiddenItems = savedHiddenItems ? JSON.parse(savedHiddenItems) : [];
          setHiddenItemsState(hiddenItems);
          
          setShowAllState(false);
          setHasMarkedCorrectState(hiddenItems.length > 0);
          setCurrentPageState(1);
          
          if (currentSession.fileId) {
            const qaResponse = await apiClient.getFileQAPairs(currentSession.fileId);
            if (qaResponse.success) {
              setQAPairsState(qaResponse.data.qa_pairs);
            } else {
              setError(`加载会话QA对失败: ${qaResponse.error.message}`);
            }
          } else {
            setQAPairsState([]);
          }
        } catch (error) {
          setError(`加载会话失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      loadSessionData();
    } else {
        // 如果没有当前会话，确保显示上传区域
        setShowUploadArea(true);
    }
  }, [currentSession, isGuestMode, user]);

  // 3. 新增 useEffect 以在“已确认”状态变化时保存到 localStorage
  useEffect(() => {
    if (user && uploadedFileId && !isGuestMode) {
      localStorage.setItem(`hiddenItems_${user.id}_${uploadedFileId}`, JSON.stringify(hiddenItemsState));
    }
  }, [hiddenItemsState, user, uploadedFileId, isGuestMode]);


  const handleQAUpdate = async (qaId, updateData) => {
    // ... (此函数保持不变)
    try {
      if (isGuestMode) {
        const index = qaPairs.findIndex(qa => qa.id === qaId);
        if (index !== -1) {
          updateGuestRecord(index, { ...qaPairs[index], ...updateData });
          setHasChanges(true);
        }
      } else {
        const updatePayload = { ...updateData, edited_by: user?.id, editor: { id: user?.id, display_name: user?.display_name } };
        await apiClient.updateQAPair(uploadedFileId, qaId, updatePayload);
        const response = await apiClient.getFileQAPairs(uploadedFileId);
        if (response.success) {
          setQAPairsState(response.data.qa_pairs);
        }
      }
    } catch (error) {
      toast.error(`更新失败: ${error.message}`);
    }
  };

  const handleQADelete = async (qaId) => {
    // ... (此函数保持不变)
    try {
      if (isGuestMode) {
        const updatedPairs = qaPairs.filter(qa => qa.id !== qaId);
        loadGuestRecords(updatedPairs);
        setHasChanges(true);
      } else {
        await apiClient.deleteQAPair(uploadedFileId, qaId);
        const response = await apiClient.getFileQAPairs(uploadedFileId);
        if (response.success) {
          setQAPairsState(response.data.qa_pairs);
        }
      }
    } catch (error) {
      toast.error(`删除失败: ${error.message}`);
    }
  };

  const handleMarkCorrect = async (qaId) => {
    // ... (此函数保持不变)
    try {
      if (isGuestMode) {
        guestMarkCorrect(qaId);
      } else {
        setHiddenItemsState(prev => [...prev, qaId]);
        setHasMarkedCorrectState(true);
      }
      setHasChanges(true);
    } catch (error) {
      toast.error(`操作失败: ${error.message}`);
    }
  };

  const handleToggleShowAll = () => {
    // ... (此函数保持不变)
    if (isGuestMode) {
      guestToggleShowAll();
    } else {
      setShowAllState(prev => !prev);
    }
  };
  
  const handleExport = async (format = 'jsonl') => {
    // ... (此函数保持不变)
    try {
      let blob;
      let filename;
      if (isGuestMode) {
        const dataToExport = guestRecords.map(qa => ({ prompt: qa.prompt, completion: qa.completion }));
        if (format === 'jsonl') {
          const jsonlContent = dataToExport.map(item => JSON.stringify(item)).join('\n');
          blob = new Blob([jsonlContent], { type: 'application/jsonl' });
          filename = `guest_session_${Date.now()}.jsonl`;
        } else if (format === 'excel') {
          const csvContent = "prompt,completion\n" + dataToExport.map(item => `"${item.prompt.replace(/"/g, '""')}","${item.completion.replace(/"/g, '""')}"`).join('\n');
          blob = new Blob([csvContent], { type: 'text/csv' });
          filename = `guest_session_${Date.now()}.csv`;
        }
      } else if (uploadedFileId) {
        blob = await apiClient.exportFile(uploadedFileId, format);
        filename = `${file.name.replace(/\.[^/.]+$/, "")}.${format}`;
      } else {
        throw new Error("没有可导出的文件");
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setHasChanges(false);
    } catch (error) {
      setError(error.message);
    }
  };

  // 4. 修改返回上传函数，调用父组件传递的函数
  const handleBackToUpload = () => {
    if (onBackToUpload) {
      onBackToUpload();
    }
    setShowUploadArea(true);
    setFile(null);
    setQAPairs([]);
    setUploadedFileId(null);
    clearGuestSession();
    setHasChanges(false);
    setSessionName("");
    setCurrentPage(1);
    setError("");
  };

  // ... (JSX 返回部分保持不变)
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
          <Button variant="outline" size="sm" onClick={() => handleExport('jsonl')} disabled={qaPairs.length === 0} className="flex-1 sm:flex-none"><Download className="w-4 h-4 mr-2" />导出JSONL</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={qaPairs.length === 0} className="flex-1 sm:flex-none"><Download className="w-4 h-4 mr-2" />导出Excel</Button>
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
        <QAEditor qaPairs={currentQAPairs} onUpdate={handleQAUpdate} onDelete={handleQADelete} onMarkCorrect={handleMarkCorrect} onToggleShowAll={handleToggleShowAll} hiddenItems={hiddenItems} showAll={showAll} hasMarkedCorrect={hasMarkedCorrect} showEditHistory={!isGuestMode} currentUser={user} />
      </div>
    </div>
  );
}

