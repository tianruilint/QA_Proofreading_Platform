import { useState, useEffect } from 'react';
import { Upload, Download, Save, FileText, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { FileUpload } from './FileUpload';
import { QAEditor } from './QAEditor';
import { useAuth } from '../hooks/useAuth.jsx';
import { apiClient } from '../lib/api.js';

export function SingleFileEditor() {
  const [file, setFile] = useState(null);
  const [qaPairs, setQAPairs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFileId, setUploadedFileId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // 访客模式状态
  const [guestSession, setGuestSession] = useState(null);
  const [isGuestMode, setIsGuestMode] = useState(!isAuthenticated);

  useEffect(() => {
    setIsGuestMode(!isAuthenticated);
  }, [isAuthenticated]);

  const parseJSONLFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          const pairs = lines.map((line, index) => {
            try {
              const obj = JSON.parse(line);
              return {
                id: `temp_${index}`,
                index_in_file: index,
                prompt: obj.question || obj.prompt || '',
                completion: obj.answer || obj.completion || ''
              };
            } catch (err) {
              throw new Error(`第 ${index + 1} 行JSON格式错误: ${err.message}`);
            }
          });
          resolve(pairs);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      setQAPairs([]);
      setUploadedFileId(null);
      setGuestSession(null);
      setHasChanges(false);
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    setError('');

    try {
      if (isGuestMode) {
        // 访客模式：本地解析文件
        const pairs = await parseJSONLFile(selectedFile);
        setQAPairs(pairs);
        
        // 创建访客会话
        const sessionData = pairs.map(pair => ({
          prompt: pair.prompt,
          completion: pair.completion
        }));
        
        const response = await apiClient.createGuestFileSession(selectedFile.name, sessionData);
        if (response.success) {
          setGuestSession(response.data);
        }
      } else {
        // 登录模式：上传到服务器
        const response = await apiClient.uploadFile(selectedFile);
        if (response.success) {
          setUploadedFileId(response.data.file.id);
          // 获取QA对数据
          const qaResponse = await apiClient.getFileQAPairs(response.data.file.id);
          if (qaResponse.success) {
            setQAPairs(qaResponse.data.qa_pairs);
          }
        }
      }
      setHasChanges(false);
    } catch (error) {
      setError(error.message);
      setFile(null);
      setQAPairs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQAUpdate = async (qaId, updateData) => {
    try {
      if (isGuestMode) {
        // 访客模式：本地更新
        const updatedPairs = qaPairs.map(qa => 
          qa.id === qaId ? { ...qa, ...updateData } : qa
        );
        setQAPairs(updatedPairs);
        setHasChanges(true);
        
        // 更新访客会话
        if (guestSession) {
          const sessionData = updatedPairs.map(pair => ({
            prompt: pair.prompt,
            completion: pair.completion
          }));
          await apiClient.updateGuestSession(guestSession.session_id, sessionData);
        }
      } else {
        // 登录模式：服务器更新
        await apiClient.updateQAPair(uploadedFileId, qaId, updateData);
        // 重新获取数据
        const response = await apiClient.getFileQAPairs(uploadedFileId);
        if (response.success) {
          setQAPairs(response.data.qa_pairs);
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleQADelete = async (qaId) => {
    try {
      if (isGuestMode) {
        // 访客模式：本地删除
        const updatedPairs = qaPairs.filter(qa => qa.id !== qaId);
        setQAPairs(updatedPairs);
        setHasChanges(true);
        
        // 更新访客会话
        if (guestSession) {
          const sessionData = updatedPairs.map(pair => ({
            prompt: pair.prompt,
            completion: pair.completion
          }));
          await apiClient.updateGuestSession(guestSession.session_id, sessionData);
        }
      } else {
        // 登录模式：服务器删除
        await apiClient.deleteQAPair(uploadedFileId, qaId);
        // 重新获取数据
        const response = await apiClient.getFileQAPairs(uploadedFileId);
        if (response.success) {
          setQAPairs(response.data.qa_pairs);
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleExport = async (format = 'jsonl') => {
    try {
      let blob;
      let filename;

      if (isGuestMode && guestSession) {
        blob = await apiClient.exportGuestSession(guestSession.session_id, format);
        filename = `${guestSession.filename.replace(/\.[^/.]+$/, '')}_edited.${format}`;
      } else if (uploadedFileId) {
        blob = await apiClient.exportFile(uploadedFileId, format);
        filename = `${file.name.replace(/\.[^/.]+$/, '')}_edited.${format}`;
      } else {
        throw new Error('没有可导出的文件');
      }

      // 下载文件
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">单文件QA对校对</h1>
        <p className="text-gray-600">
          {isGuestMode 
            ? '访客模式：上传JSONL文件进行临时编辑，数据不会保存到服务器'
            : '上传JSONL文件进行QA对编辑和校对，支持数据持久化存储'
          }
        </p>
      </div>

      {/* 模式提示 */}
      {isGuestMode && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            您当前处于访客模式，编辑的数据仅在当前会话中有效。如需永久保存，请登录后使用。
          </AlertDescription>
        </Alert>
      )}

      {/* 文件上传区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            文件上传
          </CardTitle>
          <CardDescription>
            选择JSONL格式的文件开始编辑。文件中每行应包含一个JSON对象，包含question和answer字段。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload onFileSelect={handleFileSelect} />
        </CardContent>
      </Card>

      {/* 加载状态 */}
      {loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">
                {isGuestMode ? '解析文件中...' : '上传文件中...'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* QA对编辑器 */}
      {qaPairs.length > 0 && (
        <>
          {/* 操作栏 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">
                      {file?.name} ({qaPairs.length} 个QA对)
                    </span>
                  </div>
                  {hasChanges && (
                    <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded">
                      有未保存的更改
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleExport('jsonl')}
                    disabled={qaPairs.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出JSONL
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('excel')}
                    disabled={qaPairs.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QA对列表 */}
          <QAEditor
            qaPairs={qaPairs}
            onUpdate={handleQAUpdate}
            onDelete={handleQADelete}
            showEditHistory={!isGuestMode}
            currentUser={user}
          />
        </>
      )}
    </div>
  );
}

