import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { SingleFileEditor } from './components/SingleFileEditor';
import { TaskList } from './components/TaskList';
import { UserGroupManagement } from './components/UserGroupManagement';
import { TraceabilityView } from './components/TraceabilityView';
import { Loader2 } from 'lucide-react';
import './App.css';

function AppContent() {
  const { user, isGuest, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('single-file');
  const [pageParams, setPageParams] = useState({});

  const handlePageChange = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'single-file':
        return <SingleFileEditor />;
      case 'collaboration':
        return <TaskList onPageChange={handlePageChange} />;
      case 'user-management':
        return user?.is_admin ? (
          <UserGroupManagement />
        ) : (
          <div className="container mx-auto p-6">
            <div className="text-center text-gray-500 py-8">
              <p>您没有权限访问此页面</p>
            </div>
          </div>
        );
      case 'traceability':
        return (
          <TraceabilityView 
            taskId={pageParams.taskId} 
            sessionId={pageParams.sessionId} 
          />
        );
      case 'task-detail':
        return (
          <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">任务详情</h1>
            <p className="text-muted-foreground">
              任务ID: {pageParams.taskId}, 类型: {pageParams.type}
            </p>
          </div>
        );
      default:
        return <SingleFileEditor />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={handlePageChange}>
      {renderPage()}
    </Layout>
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

