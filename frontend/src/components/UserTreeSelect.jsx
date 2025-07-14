import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2, XCircle } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { apiClient } from '../lib/api';

export function UserTreeSelect({ onSelect, selectedUser }) {
  const [open, setOpen] = useState(false);
  const [usersTree, setUsersTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsersTree = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.getUsersTree();
        setUsersTree(data.data || []);
      } catch (err) {
        console.error("Failed to fetch users tree:", err);
        setError("加载用户列表失败");
      } finally {
        setLoading(false);
      }
    };

    fetchUsersTree();
  }, []);

  const handleSelect = (user) => {
    onSelect(user);
    setOpen(false);
  };

  // 扁平化用户树数据，提取所有可选择的用户
  const flattenUsers = (nodes) => {
    const users = [];
    
    nodes.forEach(node => {
      if (node.isLeaf) {
        // 这是一个用户节点
        users.push({
          id: node.id,
          display_name: node.label,
          username: node.value,
          role: node.id.includes('admin') ? 'admin' : 'user'
        });
      } else if (node.children) {
        // 这是一个组节点，递归处理子节点
        users.push(...flattenUsers(node.children));
      }
    });
    
    return users;
  };

  const allUsers = flattenUsers(usersTree);

  const renderUsersByGroup = () => {
    const groups = [];
    
    usersTree.forEach(node => {
      if (node.isLeaf) {
        // 顶级用户（如超级管理员）
        if (!groups.find(g => g.name === '系统管理员')) {
          groups.push({
            name: '系统管理员',
            users: []
          });
        }
        const systemGroup = groups.find(g => g.name === '系统管理员');
        systemGroup.users.push({
          id: node.id,
          display_name: node.label,
          username: node.value,
          role: 'super_admin'
        });
      } else if (node.children) {
        // 组节点
        const groupUsers = node.children.map(child => ({
          id: child.id,
          display_name: child.label,
          username: child.value,
          role: node.id.includes('admin') ? 'admin' : 'user'
        }));
        
        groups.push({
          name: node.label,
          users: groupUsers
        });
      }
    });
    
    return groups.map(group => (
      <CommandGroup key={group.name} heading={group.name}>
        {group.users.map((user) => (
          <CommandItem
            key={user.id}
            value={`${user.username}-${user.display_name}`}
            onSelect={() => handleSelect({ 
              id: user.id, 
              name: user.display_name, 
              username: user.username, 
              type: user.role 
            })}
          >
            <Check
              className={cn(
                "mr-2 h-4 w-4",
                selectedUser && selectedUser.username === user.username ? "opacity-100" : "opacity-0"
              )}
            />
            {user.display_name} ({user.username})
          </CommandItem>
        ))}
      </CommandGroup>
    ));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading || !!error}
        >
          {selectedUser ? selectedUser.name : "选择用户..."}
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
          ) : error ? (
            <XCircle className="ml-2 h-4 w-4 shrink-0 text-red-500" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="搜索用户..." />
          {loading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">加载中...</span>
            </div>
          )}
          {error && (
            <CommandEmpty className="p-4 text-center text-red-500">
              {error}。 <Button variant="link" onClick={() => window.location.reload()}>重试</Button>
            </CommandEmpty>
          )}
          {!loading && !error && usersTree.length === 0 && (
            <CommandEmpty className="p-4 text-center text-gray-500">
              没有找到用户。
            </CommandEmpty>
          )}
          {!loading && !error && usersTree.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {renderUsersByGroup()}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

