import { useState } from 'react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Avatar, AvatarFallback } from './ui/avatar';
import { 
  Menu, 
  LogOut, 
  User, 
  FileText, 
  Users, 
  CheckCircle,
  Clock,
  Settings,
  Search
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { TaskList } from './TaskList';

export function Layout({ children, currentPage, onPageChange }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isGuest, logout, exitGuestMode } = useAuth();

  const handleLogout = () => {
    if (isGuest) {
      exitGuestMode();
    } else {
      logout();
    }
  };

  const navigation = [
    {
      id: 'single-file',
      name: '单文件校对',
      icon: FileText,
      description: '上传JSONL文件进行校对'
    },
    ...(user ? [
      {
        id: 'collaboration',
        name: '协作任务',
        icon: Users,
        description: '创建或参与多人协作任务'
      }
    ] : []),
    ...(user?.is_admin ? [
      {
        id: 'user-management',
        name: '用户组管理',
        icon: Settings,
        description: '管理用户组和权限'
      }
    ] : [])
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* 用户信息 */}
      <div className="p-4 border-b">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback>
              {isGuest ? 'G' : user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {isGuest ? '访客用户' : user?.name || '未知用户'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isGuest ? '访客模式' : (user?.is_admin ? '管理员' : '普通用户')}
              {user?.user_group && ` - ${user.user_group.name}`}
            </p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <div className="flex-1 p-4">
        <nav className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={currentPage === item.id ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => {
                  onPageChange(item.id);
                  setSidebarOpen(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.name}
              </Button>
            );
          })}
        </nav>

        {/* 任务列表 */}
        {user && (
          <div className="mt-6">
            <TaskList onTaskSelect={(taskId, type) => {
              onPageChange('task-detail', { taskId, type });
              setSidebarOpen(false);
            }} />
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="p-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isGuest ? '退出访客模式' : '退出登录'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          {/* 移动端菜单按钮 */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <NavContent />
            </SheetContent>
          </Sheet>

          {/* Logo和标题 */}
          <div className="flex items-center space-x-2 ml-4 md:ml-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold">QA对校对协作平台</h1>
          </div>

          <div className="flex-1" />

          {/* 桌面端用户信息 */}
          <div className="hidden md:flex items-center space-x-4 mr-4">
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {isGuest ? 'G' : user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {isGuest ? '访客用户' : user?.name || '未知用户'}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 桌面端侧边栏 */}
        <aside className="hidden md:flex w-80 flex-col border-r bg-muted/10">
          <NavContent />
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 overflow-auto min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}

