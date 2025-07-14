import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Users, UserCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { apiClient } from '../lib/api';

export function LoginPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  const { login, enterGuestMode } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await apiClient.getUsers();
      if (response.success) {
        setUsers(response.data.users);
      } else {
        setError('获取用户列表失败');
      }
    } catch (error) {
      setError('获取用户列表失败: ' + error.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleLogin = async () => {
    if (!selectedUserId) {
      setError('请选择用户');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(selectedUserId);
    if (!result.success) {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleGuestMode = () => {
    enterGuestMode();
  };

  if (loadingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">QA对校对协作平台</CardTitle>
          <CardDescription>
            选择您的身份登录，或以访客模式体验单文件校对功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">选择用户</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择您的姓名" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center space-x-2">
                      <UserCheck className="h-4 w-4" />
                      <span>{user.name}</span>
                      {user.is_admin && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          管理员
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleLogin} 
            disabled={loading || !selectedUserId}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={handleGuestMode}
            className="w-full"
          >
            跳过登录（访客模式）
          </Button>

          <div className="text-xs text-muted-foreground text-center">
            <p>访客模式仅支持单文件校对功能</p>
            <p>数据不会保存到服务器</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

