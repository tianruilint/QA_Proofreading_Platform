import { useState } from 'react';
import { 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  User,
  Shield,
  Crown
} from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAuth } from '../hooks/useAuth.jsx';

export function MainLayout({ children, currentPage, onPageChange }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const navigation = [
    {
      name: '单文件校对',
      id: 'single-file',
      icon: FileText,
      description: '上传JSONL文件进行QA对校对'
    },
    {
      name: '协作任务',
      id: 'tasks',
      icon: Users,
      description: '管理和参与协作校对任务',
      roles: ['admin', 'user']
    },
    {
      name: '用户管理',
      id: 'user-management',
      icon: Users,
      description: '管理用户和组织架构',
      roles: ['super_admin', 'admin']
    },
    {
      name: '系统设置',
      id: 'settings',
      icon: Settings,
      description: '系统配置和个人设置',
      roles: ['super_admin']
    }
  ];

  const filteredNavigation = navigation.filter(item => 
    !item.roles || item.roles.includes(user?.role)
  );

  const getRoleIcon = (role) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleName = (role) => {
    switch (role) {
      case 'super_admin':
        return '超级管理员';
      case 'admin':
        return '管理员';
      default:
        return '用户';
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* 侧边栏头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-bold text-gray-900">QA协作平台</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 p-4 space-y-2">
            {filteredNavigation.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              </button>
            ))}
          </nav>

          {/* 用户信息 */}
          <div className="p-4 border-t border-gray-200">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {user?.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">{user?.display_name}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {getRoleIcon(user?.role)}
                        {getRoleName(user?.role)}
                      </div>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => onPageChange('profile')}>
                  <User className="w-4 h-4 mr-2" />
                  个人资料
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPageChange('change-password')}>
                  <Settings className="w-4 h-4 mr-2" />
                  修改密码
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="lg:ml-64">
        {/* 顶部导航栏 */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {filteredNavigation.find(item => item.id === currentPage)?.name || '首页'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {user?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user?.display_name}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    {getRoleIcon(user?.role)}
                    {getRoleName(user?.role)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

