import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { LoginPage } from './components/LoginPage';
import { MainLayout } from './components/MainLayout';
import { SingleFileEditor } from './components/SingleFileEditor';
import './App.css';

function AppContent() {
  const { user, loading, isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState('single-file');
  const [isGuestMode, setIsGuestMode] = useState(false);

  const handleGuestMode = () => {
    setIsGuestMode(true);
    setCurrentPage('single-file');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'single-file':
        return <SingleFileEditor />;
      case 'tasks':
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">协作任务</h2>
            <p className="text-gray-600">功能开发中...</p>
          </div>
        );
      case 'user-management':
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">用户管理</h2>
            <p className="text-gray-600">功能开发中...</p>
          </div>
        );
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
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">修改密码</h2>
            <p className="text-gray-600">功能开发中...</p>
          </div>
        );
      default:
        return <SingleFileEditor />;
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

  // 如果未登录且不是访客模式，显示登录页面
  if (!isAuthenticated && !isGuestMode) {
    return <LoginPage onGuestMode={handleGuestMode} />;
  }

  // 如果是访客模式，只显示单文件编辑器
  if (isGuestMode && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">QA对校对协作平台 - 访客模式</h1>
              <button
                onClick={() => setIsGuestMode(false)}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                返回登录
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-4 lg:p-6">
          <SingleFileEditor />
        </main>
      </div>
    );
  }

  // 已登录用户显示完整界面
  return (
    <MainLayout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </MainLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

