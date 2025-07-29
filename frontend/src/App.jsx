import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { LoginPage } from './components/LoginPage';
import { MainLayout } from './components/MainLayout';
import { SingleFileEditor } from './components/SingleFileEditor';
import { ChangePassword } from './components/ChangePassword';
import { UserManagement } from './components/UserManagement';
import { GroupManagement } from './components/GroupManagement';
import { CollaborationTasks } from './components/CollaborationTasks';
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
            <a href="/" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
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
    if (user?.role === 'super_admin') return 'user-management';
    return 'single-file';
  }, [user]);

  const [currentPage, setCurrentPage] = useState(getDefaultPage());
  const [sessionHistory, setSessionHistory] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  const fetchSessionHistory = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.getSessionHistory();
      if (response.success) {
        const formattedHistory = response.data.map(file => ({
          ...file,
          name: file.original_filename,
          date: new Date(file.created_at).toLocaleString('zh-CN'),
          fileId: file.id,
        }));
        setSessionHistory(formattedHistory);
      } else {
        toast.error("加载会话历史失败");
      }
    } catch (error) {
      toast.error(`加载会话历史失败: ${error.message}`);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) fetchSessionHistory();
  }, [isAuthenticated, fetchSessionHistory]);
  
  useEffect(() => {
    if (user) setCurrentPage(getDefaultPage());
  }, [user, getDefaultPage]);

  const handleSessionSave = () => fetchSessionHistory();
  
  const handleSessionSelect = (session) => {
    setCurrentSession({ ...session });
    if (currentPage !== 'single-file') {
      setCurrentPage('single-file');
    }
  };

  const handleBackToUpload = () => setCurrentSession(null);
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
        await fetchSessionHistory();
        if (currentSession?.fileId === fileId) {
          setCurrentSession(prev => ({ ...prev, name: newName, original_filename: newName }));
        }
      } else {
        toast.error(`重命名失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`重命名失败: ${error.message}`);
    }
  };

  // --- 关键修复：接收第二个参数 wasActive ---
  const handleDeleteSession = async (fileId, wasActive) => {
    try {
      const response = await apiClient.deleteFile(fileId);
      if (response.success) {
        toast.success("会话删除成功");
        setSessionHistory(prev => prev.filter(session => session.fileId !== fileId));
        // 如果删除的是当前正在查看的会话，则清空视图
        if (wasActive) {
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
        return <SingleFileEditor onSessionSave={handleSessionSave} currentSession={currentSession} onBackToUpload={handleBackToUpload} />;
      case 'tasks':
        return <CollaborationTasks />;
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
            onPageChange={handlePageChange} 
            sessionHistory={sessionHistory}
            onSessionSelect={handleSessionSelect}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            // --- 关键修复：传递当前会话ID ---
            activeSessionId={currentSession?.fileId}
          >
            {renderPage()}
          </MainLayout>
        ) : (
          <LoginPage onGuestMode={() => window.location.href = "/guest"} />
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

