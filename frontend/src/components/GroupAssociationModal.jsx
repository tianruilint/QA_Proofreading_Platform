import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import { apiClient } from '../lib/api.js';

export function GroupAssociationModal({ isOpen, onClose, adminGroup, onAssociationUpdated }) {
  const [userGroups, setUserGroups] = useState([]);
  const [selectedUserGroups, setSelectedUserGroups] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && adminGroup) {
      fetchUserGroups();
      // 设置已关联的用户组
      setSelectedUserGroups(adminGroup.user_groups?.map(group => group.id) || []);
    }
  }, [isOpen, adminGroup]);

  const fetchUserGroups = async () => {
    try {
      const response = await apiClient.getUserGroups({ simple: true });
      if (response.success) {
        setUserGroups(response.data.user_groups || []);
      } else {
        setError(response.error?.message || '加载用户组失败');
      }
    } catch (err) {
      setError(err.message || '加载用户组失败');
    }
  };

  const handleUserGroupToggle = (userGroupId) => {
    setSelectedUserGroups(prev => {
      if (prev.includes(userGroupId)) {
        return prev.filter(id => id !== userGroupId);
      } else {
        return [...prev, userGroupId];
      }
    });
  };

  const handleSubmit = async () => {
    if (!adminGroup) return;

    try {
      setLoading(true);
      setError('');

      // 更新关联关系
      const response = await apiClient.linkUserGroups(adminGroup.id, {
        user_group_ids: selectedUserGroups
      });

      if (response.success) {
        onAssociationUpdated();
        onClose();
      } else {
        setError(response.error?.message || '更新关联关系失败');
      }
    } catch (err) {
      setError(err.message || '更新关联关系失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSelectedUserGroups([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>管理组关联</DialogTitle>
          <DialogDescription>
            为管理员组 "{adminGroup?.name}" 配置可管理的用户组
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">可管理的用户组</Label>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {userGroups.map(userGroup => (
                <div key={userGroup.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`user-group-${userGroup.id}`}
                    checked={selectedUserGroups.includes(userGroup.id)}
                    onCheckedChange={() => handleUserGroupToggle(userGroup.id)}
                  />
                  <Label 
                    htmlFor={`user-group-${userGroup.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {userGroup.name}
                    {userGroup.description && (
                      <span className="text-gray-500 ml-2">({userGroup.description})</span>
                    )}
                  </Label>
                </div>
              ))}
              {userGroups.length === 0 && (
                <div className="text-gray-500 text-sm">暂无用户组</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

