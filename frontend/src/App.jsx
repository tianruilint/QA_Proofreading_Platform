import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { LoginPage } from './components/LoginPage';
import { MainLayout } from './components/MainLayout';
import { SingleFileEditor } from './components/SingleFileEditor';
import { ChangePassword } from './components/ChangePassword';
import { UserManagement } from './components/UserManagement';
import { GroupManagement } from './components/GroupManagement';
import { apiClient } from './lib/api.js';
import { Toaster, toast } from 'sonner';

import './App.css';

function GuestPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">QA对校对协作平台 - 访客模式</h1>
            <a href="/" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              返回登录
            </a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 lg:p-6">
        <SingleFileEditor isGuestMode={true} />
      </main>
    </div>
  );
}

function AppContent() {
  const { user, loading, isAuthenticated } = useAuth();
  
  const getDefaultPage = useCallback(() => {
    if (user?.role === 'super_admin') {
      return 'user-management';
    }
    return 'single-file';
  }, [user]);

  const [currentPage, setCurrentPage] = useState(getDefaultPage());
  const [sessionHistory, setSessionHistory] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  const fetchSessionHistory = useCallback(async () => {
    if (user) {
      try {
        const response = await apiClient.getSessionHistory();
        if (response.success) {
          const formattedHistory = response.data.map(file => ({
            id: file.id,
            name: file.original_filename,
            date: new Date(file.created_at).toLocaleString('zh-CN'),
            fileId: file.id,
            type: 'single-file'
          }));
          setSessionHistory(formattedHistory);
        } else {
          toast.error("加载会话历史失败");
        }
      } catch (error) {
        toast.error(`加载会话历史失败: ${error.message}`);
      }
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessionHistory();
    }
  }, [isAuthenticated, fetchSessionHistory]);
  
  useEffect(() => {
    if (user) {
      setCurrentPage(getDefaultPage());
    }
  }, [user, getDefaultPage]);

  const handleGuestMode = () => {
    window.location.href = "/guest";
  };

  const handleSessionSave = async () => {
    await fetchSessionHistory(); 
  };
  
  const handleSessionSelect = (session) => {
    // 确保我们总是传递一个新的对象引用，以触发useEffect
    setCurrentSession({ ...session });
    if (currentPage !== 'single-file') {
      setCurrentPage('single-file');
    }
  };

  // 1. 新增一个函数，用于返回上传页面时清空当前会话
  const handleBackToUpload = () => {
    setCurrentSession(null);
  };

  // 2. 改造页面切换函数，切换页面时也清空当前会话
  const handlePageChange = (page) => {
    if (currentPage !== page) {
      setCurrentSession(null);
      setCurrentPage(page);
    }
  };

  const handleRenameSession = async (fileId, newName) => {
    try {
        const response = await apiClient.renameFile(fileId, newName);
        if (response.success) {
            toast.success("会话重命名成功");
            setSessionHistory(prev => 
                prev.map(session => 
                    session.fileId === fileId ? { ...session, name: newName } : session
                )
            );
            if (currentSession?.fileId === fileId) {
                setCurrentSession(prev => ({ ...prev, name: newName }));
            }
        } else {
            toast.error(`重命名失败: ${response.error.message}`);
        }
    } catch (error) {
        toast.error(`重命名失败: ${error.message}`);
    }
  };

  const handleDeleteSession = async (fileId) => {
    try {
        const response = await apiClient.deleteFile(fileId);
        if (response.success) {
            toast.success("会话删除成功");
            setSessionHistory(prev => prev.filter(session => session.fileId !== fileId));
            if (currentSession?.fileId === fileId) {
                setCurrentSession(null);
            }
        } else {
            toast.error(`删除失败: ${response.error.message}`);
        }
    } catch (error) {
        toast.error(`删除失败: ${error.message}`);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'single-file':
        // 3. 将新的清空函数传递给 SingleFileEditor
        return <SingleFileEditor onSessionSave={handleSessionSave} currentSession={currentSession} onBackToUpload={handleBackToUpload} />;
      case 'tasks':
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">协作任务</h2>
            <p className="text-gray-600">功能开发中...</p>
          </div>
        );
      case 'user-management':
        return <UserManagement />;
      case 'group-management':
        return <GroupManagement />;
      case 'change-password':
        return <ChangePassword />;
      default:
        return <SingleFileEditor onSessionSave={handleSessionSave} currentSession={currentSession} onBackToUpload={handleBackToUpload} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/guest" element={<GuestPage />} />
      <Route path="/*" element={
        isAuthenticated ? (
          <MainLayout 
            currentPage={currentPage} 
            // 4. 使用新的页面切换函数
            onPageChange={handlePageChange} 
            sessionHistory={sessionHistory}
            onSessionSelect={handleSessionSelect}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
          >
            {renderPage()}
          </MainLayout>
        ) : (
          <LoginPage onGuestMode={handleGuestMode} />
        )
      } />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </Router>
  );
}

export default App;

