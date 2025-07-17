import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

export function AddUserModal({ isOpen, onClose, onUserAdded, editingUser = null, isEditing = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('user');
  const [adminGroups, setAdminGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedAdminGroup, setSelectedAdminGroup] = useState('');
  const [selectedUserGroup, setSelectedUserGroup] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();

  // 根据当前用户角色获取可选择的角色选项
  const getAvailableRoles = () => {
    if (currentUser?.role === 'super_admin') {
      return [
        { value: 'user', label: '用户' },
        { value: 'admin', label: '管理员' },
        { value: 'super_admin', label: '超级管理员' }
      ];
    } else if (currentUser?.role === 'admin') {
      return [
        { value: 'user', label: '用户' }
      ];
    }
    return [{ value: 'user', label: '用户' }];
  };

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      if (isEditing && editingUser) {
        // 编辑模式：填充现有用户数据
        setUsername(editingUser.username || "");
        setPassword(''); // 编辑时不显示密码
        setDisplayName(editingUser.display_name || '');
        setRole(editingUser.role || 'user');
        setSelectedAdminGroup(editingUser.admin_group_id || '');
        setSelectedUserGroup(editingUser.user_group_id || '');
      } else {
        // 新增模式：重置表单
        setUsername('');
        setPassword('');
        setDisplayName('');
        setRole('user');
        setSelectedAdminGroup('');
        setSelectedUserGroup('');
      }
      setError('');
    }
  }, [isOpen, isEditing, editingUser]);

  const fetchGroups = async () => {
    try {
      const adminResponse = await apiClient.getAdminGroups({ simple: true });
      if (adminResponse.success) {
        setAdminGroups(adminResponse.data.admin_groups || []);
      } else {
        setError(adminResponse.error?.message || '加载管理员组失败');
      }

      const userResponse = await apiClient.getUserGroups({ simple: true });
      if (userResponse.success) {
        setUserGroups(userResponse.data.user_groups || []);
      } else {
        setError(userResponse.error?.message || '加载用户组失败');
      }
    } catch (err) {
      setError(err.message || '加载组信息失败');
    }
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const payload = {
        username,
        display_name: displayName,
        role,
        admin_group_id: selectedAdminGroup || null,
        user_group_id: selectedUserGroup || null,
      };

      // 只有在新增模式或者密码不为空时才包含密码
      if (!isEditing || password) {
        payload.password = password;
      }

      let response;
      if (isEditing && editingUser) {
        response = await apiClient.updateUser(editingUser.id, payload);
      } else {
        response = await apiClient.createUser(payload);
      }

      if (response.success) {
        onUserAdded();
        onClose();
      } else {
        setError(response.error?.message || (isEditing ? '更新用户失败' : '添加用户失败'));
      }
    } catch (err) {
      setError(err.message || (isEditing ? '更新用户失败' : '添加用户失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑用户' : '添加新用户'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改用户信息。' : '填写用户信息以创建新账户。'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">用户名</Label>
            <Input id="username" value={editingUser?.username || username} onChange={(e) => setUsername(e.target.value)} className="col-span-3" readOnly={isEditing} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">密码</Label>
            <div className="col-span-3">
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder={isEditing ? "留空则不修改密码" : ""}
              />
              {isEditing && (
                <p className="text-xs text-gray-500 mt-1">留空则不修改当前密码</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="display_name" className="text-right">显示名称</Label>
            <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">角色</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableRoles().map(roleOption => (
                  <SelectItem key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === 'admin' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="admin_group" className="text-right">管理员组</Label>
              <Select value={selectedAdminGroup} onValueChange={setSelectedAdminGroup}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择管理员组" />
                </SelectTrigger>
                <SelectContent>
                  {adminGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {role === 'user' && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="user_group" className="text-right">用户组</Label>
              <Select value={selectedUserGroup} onValueChange={setSelectedUserGroup}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择用户组" />
                </SelectTrigger>
                <SelectContent>
                  {userGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (isEditing ? '更新中...' : '添加中...') : (isEditing ? '更新用户' : '添加用户')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


