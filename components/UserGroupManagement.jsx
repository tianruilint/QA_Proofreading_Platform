import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Settings, Trash2, Link, Plus } from 'lucide-react';

export function UserGroupManagement() {
  const [userGroups, setUserGroups] = useState([]);
  const [adminGroups, setAdminGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('userGroups');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [selectedAdminGroup, setSelectedAdminGroup] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [userGroupsRes, adminGroupsRes, usersRes] = await Promise.all([
        fetch('/api/v1/user-groups'),
        fetch('/api/v1/admin-groups'),
        fetch('/api/v1/users')
      ]);

      if (userGroupsRes.ok) {
        const data = await userGroupsRes.json();
        setUserGroups(data.data.user_groups);
      }

      if (adminGroupsRes.ok) {
        const data = await adminGroupsRes.json();
        setAdminGroups(data.data.admin_groups);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data.users);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (type, formData) => {
    try {
      const endpoint = type === 'user' ? '/api/v1/user-groups' : '/api/v1/admin-groups';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadData();
        setShowCreateModal(false);
      } else {
        const error = await response.json();
        alert(error.error.message);
      }
    } catch (error) {
      console.error('创建组失败:', error);
      alert('创建组失败');
    }
  };

  const bindUserGroup = async (adminGroupId, userGroupId) => {
    try {
      const response = await fetch(`/api/v1/admin-groups/${adminGroupId}/bind-user-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_group_id: userGroupId }),
      });

      if (response.ok) {
        await loadData();
        setShowBindModal(false);
        setSelectedAdminGroup(null);
      } else {
        const error = await response.json();
        alert(error.error.message);
      }
    } catch (error) {
      console.error('绑定失败:', error);
      alert('绑定失败');
    }
  };

  const assignUserToGroup = async (userId, groupType, groupId) => {
    try {
      const payload = {};
      if (groupType === 'user') {
        payload.user_group_id = groupId;
      } else {
        payload.admin_group_id = groupId;
      }

      const response = await fetch(`/api/v1/users/${userId}/assign-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadData();
      } else {
        const error = await response.json();
        alert(error.error.message);
      }
    } catch (error) {
      console.error('分配用户失败:', error);
      alert('分配用户失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">用户组管理</h1>
        <p className="text-gray-600">管理用户组、管理员组及其绑定关系</p>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('userGroups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'userGroups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            用户组
          </button>
          <button
            onClick={() => setActiveTab('adminGroups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'adminGroups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            管理员组
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            用户分配
          </button>
        </nav>
      </div>

      {/* 用户组标签页 */}
      {activeTab === 'userGroups' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">用户组列表</h2>
            <button
              onClick={() => setShowCreateModal('user')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              创建用户组
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userGroups.map((group) => (
              <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{group.name}</h3>
                <p className="text-gray-600 text-sm mb-3">{group.description}</p>
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{group.user_count} 个用户</span>
                  <span>{new Date(group.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 管理员组标签页 */}
      {activeTab === 'adminGroups' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">管理员组列表</h2>
            <div className="space-x-2">
              <button
                onClick={() => setShowCreateModal('admin')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建管理员组
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {adminGroups.map((group) => (
              <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                    <p className="text-gray-600 text-sm">{group.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAdminGroup(group);
                      setShowBindModal(true);
                    }}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center"
                  >
                    <Link className="w-3 h-3 mr-1" />
                    绑定用户组
                  </button>
                </div>
                
                <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                  <span>{group.admin_count} 个管理员</span>
                  <span>{new Date(group.created_at).toLocaleDateString()}</span>
                </div>
                
                {group.bound_user_groups.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">已绑定的用户组:</h4>
                    <div className="flex flex-wrap gap-2">
                      {group.bound_user_groups.map((userGroup) => (
                        <span
                          key={userGroup.id}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                        >
                          {userGroup.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 用户分配标签页 */}
      {activeTab === 'users' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">用户分配</h2>
          
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户组
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    管理员组
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_admin 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.is_admin ? '管理员' : '普通用户'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.user_group_id || ''}
                        onChange={(e) => assignUserToGroup(user.id, 'user', e.target.value || null)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">未分配</option>
                        {userGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.is_admin ? (
                        <select
                          value={user.admin_group_id || ''}
                          onChange={(e) => assignUserToGroup(user.id, 'admin', e.target.value || null)}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="">未分配</option>
                          {adminGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400 text-sm">仅限管理员</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 创建组模态框 */}
      {showCreateModal && (
        <CreateGroupModal
          type={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createGroup}
        />
      )}

      {/* 绑定用户组模态框 */}
      {showBindModal && selectedAdminGroup && (
        <BindUserGroupModal
          adminGroup={selectedAdminGroup}
          userGroups={userGroups}
          onClose={() => {
            setShowBindModal(false);
            setSelectedAdminGroup(null);
          }}
          onSubmit={bindUserGroup}
        />
      )}
    </div>
  );
}

// 创建组模态框组件
function CreateGroupModal({ type, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('组名称不能为空');
      return;
    }
    onSubmit(type, formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          创建{type === 'user' ? '用户组' : '管理员组'}
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              组名称 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入组名称"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="请输入组描述"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 绑定用户组模态框组件
function BindUserGroupModal({ adminGroup, userGroups, onClose, onSubmit }) {
  const [selectedUserGroupId, setSelectedUserGroupId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedUserGroupId) {
      alert('请选择要绑定的用户组');
      return;
    }
    onSubmit(adminGroup.id, selectedUserGroupId);
  };

  // 过滤掉已经绑定的用户组
  const availableUserGroups = userGroups.filter(
    userGroup => !adminGroup.bound_user_groups.some(bound => bound.id === userGroup.id)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          为 "{adminGroup.name}" 绑定用户组
        </h3>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择用户组 *
            </label>
            <select
              value={selectedUserGroupId}
              onChange={(e) => setSelectedUserGroupId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择用户组</option>
              {availableUserGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.user_count} 个用户)
                </option>
              ))}
            </select>
            
            {availableUserGroups.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                所有用户组都已绑定到此管理员组
              </p>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!selectedUserGroupId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              绑定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

