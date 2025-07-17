import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Shield, 
  User, 
  Settings,
  Link
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Alert, AlertDescription } from './ui/alert';
import { GroupAssociationModal } from './GroupAssociationModal';
import { AddGroupModal } from './AddGroupModal';
import { apiClient } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

export function GroupManagement() {
  const [adminGroups, setAdminGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssociationModal, setShowAssociationModal] = useState(false);
  const [selectedAdminGroup, setSelectedAdminGroup] = useState(null);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [addGroupType, setAddGroupType] = useState('admin'); // 'admin' or 'user'
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      
      // 加载管理员组
      const adminResponse = await apiClient.getAdminGroups();
      if (adminResponse.success) {
        setAdminGroups(adminResponse.data.items || []);
      }

      // 加载用户组
      const userResponse = await apiClient.getUserGroups();
      if (userResponse.success) {
        setUserGroups(userResponse.data.items || []);
      }
    } catch (error) {
      setError(error.message || '加载组列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleManageAssociation = (adminGroup) => {
    setSelectedAdminGroup(adminGroup);
    setShowAssociationModal(true);
  };

  const handleAssociationUpdated = () => {
    loadGroups();
  };

  const handleAddGroup = (type) => {
    setAddGroupType(type);
    setShowAddGroupModal(true);
  };

  const handleGroupAdded = () => {
    loadGroups();
  };

  const filteredAdminGroups = adminGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUserGroups = userGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">组管理</h1>
          <p className="text-gray-600">管理管理员组和用户组及其关联关系</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="搜索组..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 管理员组 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                管理员组
              </div>
              {currentUser?.role === 'super_admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddGroup('admin')}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  新增管理员组
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              管理员组及其可管理的用户组
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredAdminGroups.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  暂无管理员组
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>组名</TableHead>
                      <TableHead>成员数</TableHead>
                      <TableHead>可管理用户组</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdminGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{group.name}</div>
                            {group.description && (
                              <div className="text-sm text-gray-500">{group.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {group.members_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {group.user_groups_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {currentUser?.role === 'super_admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManageAssociation(group)}
                            >
                              <Link className="w-4 h-4 mr-1" />
                              管理关联
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 用户组 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                用户组
              </div>
              {currentUser?.role === 'super_admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddGroup('user')}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  新增用户组
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              用户组及其成员信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredUserGroups.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  暂无用户组
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>组名</TableHead>
                      <TableHead>成员数</TableHead>
                      <TableHead>关联管理员组</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUserGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{group.name}</div>
                            {group.description && (
                              <div className="text-sm text-gray-500">{group.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {group.members_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {group.admin_groups_count || 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 组关联管理模态框 */}
      <GroupAssociationModal
        isOpen={showAssociationModal}
        onClose={() => setShowAssociationModal(false)}
        adminGroup={selectedAdminGroup}
        onAssociationUpdated={handleAssociationUpdated}
      />

      {/* 新增组模态框 */}
      <AddGroupModal
        isOpen={showAddGroupModal}
        onClose={() => setShowAddGroupModal(false)}
        groupType={addGroupType}
        onGroupAdded={handleGroupAdded}
      />
    </div>
  );
}

