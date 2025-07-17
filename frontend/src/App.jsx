import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { LoginPage } from './components/LoginPage';
import { MainLayout } from './components/MainLayout';
import { SingleFileEditor } from './components/SingleFileEditor';
import { ChangePassword } from './components/ChangePassword';
import { UserManagement } from './components/UserManagement';
import { GroupManagement } from './components/GroupManagement';
import './App.css';

function GuestPage() {
  console.log("Rendering GuestPage");
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">QA对校对协作平台 - 访客模式</h1>
            <a href="/" className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
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
  // 根据用户角色设置默认页面
  const getDefaultPage = () => {
    if (user?.role === 'super_admin') {
      return 'user-management';
    }
    return 'single-file';
  };
  
  const [currentPage, setCurrentPage] = useState(getDefaultPage());
  const [sessionHistory, setSessionHistory] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  // 从localStorage加载会话历史
  useEffect(() => {
    if (user) {
      const savedHistory = localStorage.getItem(`sessionHistory_${user.id}`);
      if (savedHistory) {
        try {
          setSessionHistory(JSON.parse(savedHistory));
        } catch (error) {
          console.error('Failed to load session history:', error);
        }
      }
    }
  }, [user]);

  // 保存会话历史到localStorage
  const saveSessionHistory = (history) => {
    if (user) {
      localStorage.setItem(`sessionHistory_${user.id}`, JSON.stringify(history));
    }
  };

  // 当用户信息加载完成后，更新默认页面
  useEffect(() => {
    if (user && currentPage === 'single-file' && user.role === 'super_admin') {
      setCurrentPage('user-management');
    }
  }, [user]);

  const handleGuestMode = () => {
    window.location.href = "/guest";
  };

  const addSessionToHistory = (sessionName, fileId = null) => {
    const newSession = {
      name: sessionName,
      date: new Date().toLocaleString("zh-CN"),
      id: Date.now(),
      fileId: fileId, // 存储文件ID
      type: "single-file" // 明确指定为单文件校对类型
    };
    const newHistory = [newSession, ...sessionHistory.slice(0, 9)]; // 保留最近10个会话
    setSessionHistory(newHistory);
    saveSessionHistory(newHistory); // 保存到localStorage
    setCurrentSession(newSession);
  };

  const handleSessionSelect = (session) => {
    setCurrentSession(session);
    // 如果当前不在单文件校对页面，切换到该页面
    if (currentPage !== 'single-file') {
      setCurrentPage('single-file');
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'single-file':
        return <SingleFileEditor onSessionSave={addSessionToHistory} currentSession={currentSession} />;
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
      case 'settings':
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">系统设置</h2>
            <p className="text-gray-600">功能开发中...</p>
          </div>
        );
      case 'profile':
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">个人资料</h2>
            <p className="text-gray-600">功能开发中...</p>
          </div>
        );
      case 'change-password':
        return <ChangePassword />;
      default:
        return <SingleFileEditor onSessionSave={addSessionToHistory} currentSession={currentSession} />;
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
            onPageChange={setCurrentPage} 
            sessionHistory={sessionHistory.filter(session => {
              // 根据当前页面过滤会话历史
              if (currentPage === 'single-file') {
                return session.type === 'single-file';
              }
              if (currentPage === 'tasks') {
                return session.type === 'tasks';
              }
              return false;
            })}
            onSessionSelect={handleSessionSelect}
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
      </AuthProvider>
    </Router>
  );
}

export default App;

