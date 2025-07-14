import { useState } from 'react';
import { Eye, EyeOff, Users, LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { UserTreeSelect } from './UserTreeSelect';
import { useAuth } from '../hooks/useAuth.jsx';
import '../App.css';

export function LoginPage({ onGuestMode }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!selectedUser) {
      setError('请选择用户');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(selectedUser.username, password);
      if (!result.success) {
        setError(result.error.message || '登录失败');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && selectedUser && password && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 头部标题 */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">QA对校对协作平台</h1>
          <p className="text-gray-600">选择您的身份登录，或以访客模式体验文档校对功能</p>
        </div>

        {/* 登录卡片 */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">用户登录</CardTitle>
            <CardDescription className="text-center">
              请从下方树形结构中选择您的用户身份
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 用户选择 */}
            <div className="space-y-2">
              <Label htmlFor="user-select">选择用户</Label>
              <UserTreeSelect
                onSelect={setSelectedUser}
                selectedUser={selectedUser}
              />
              {selectedUser && (
                <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">
                      已选择: {selectedUser.name}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {selectedUser.type === 'admin' ? '管理员' : '用户'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="请输入密码"
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <Button
              onClick={handleLogin}
              disabled={!selectedUser || !password || loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  登录中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  登录
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 访客模式 */}
        <Card className="shadow-lg border-0 bg-white/60 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="text-center space-y-3">
              <h3 className="font-medium text-gray-900">访客模式</h3>
              <p className="text-sm text-gray-600">
                无需登录即可体验单文件QA对校对功能
              </p>
              <Button
                variant="outline"
                onClick={onGuestMode}
                className="w-full"
              >
                跳过登录（访客模式）
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 底部信息 */}
        <div className="text-center text-xs text-gray-500">
          <p>访客模式仅支持临时文件编辑，数据不会保存到服务器</p>
          <p className="mt-1">数据安全存储服务需要登录后使用</p>
        </div>
      </div>
    </div>
  );
}



