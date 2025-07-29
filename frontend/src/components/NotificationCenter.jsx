import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle,
  FileText,
  Users,
  Calendar,
  X
} from 'lucide-react';

export function NotificationCenter({ isOpen, onClose }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'task_assignment', 'task_completion'

  // 获取通知列表
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const params = {};
      if (filter === 'unread') {
        params.unread_only = 'true';
      }
      
      const response = await apiClient.getNotifications(params);
      if (response.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unread_count || 0);
      } else {
        toast.error(`获取通知失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`获取通知失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  // 获取未读通知数量
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getUnreadNotificationCount();
      if (response.success) {
        setUnreadCount(response.data.unread_count || 0);
      }
    } catch (error) {
      console.error('获取未读通知数量失败:', error);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    // 定期获取未读通知数量
    const interval = setInterval(fetchUnreadCount, 30000); // 每30秒检查一次
    fetchUnreadCount();
    
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // 标记通知为已读
  const markAsRead = async (notificationId) => {
    try {
      const response = await apiClient.markNotificationAsRead(notificationId);
      if (response.success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, is_read: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        toast.error(`标记通知失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`标记通知失败: ${error.message}`);
    }
  };

  // 标记所有通知为已读
  const markAllAsRead = async () => {
    try {
      const response = await apiClient.markAllNotificationsAsRead();
      if (response.success) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, is_read: true }))
        );
        setUnreadCount(0);
        toast.success('所有通知已标记为已读');
      } else {
        toast.error(`标记通知失败: ${response.error.message}`);
      }
    } catch (error) {
      toast.error(`标记通知失败: ${error.message}`);
    }
  };

  // 获取通知类型图标
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_assignment':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'task_completion':
        return <CheckCheck className="w-5 h-5 text-green-500" />;
      case 'task_reminder':
        return <Clock className="w-5 h-5 text-orange-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  // 获取通知类型标签
  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'task_assignment':
        return '任务分配';
      case 'task_completion':
        return '任务完成';
      case 'task_reminder':
        return '任务提醒';
      default:
        return '系统通知';
    }
  };

  // 渲染通知项
  const renderNotificationItem = (notification) => {
    return (
      <div
        key={notification.id}
        className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
          !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
        }`}
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-1">
            {getNotificationIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {notification.title}
              </h4>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {getNotificationTypeLabel(notification.type)}
                </span>
                {!notification.is_read && (
                  <button
                    onClick={() => markAsRead(notification.id)}
                    className="text-blue-500 hover:text-blue-700 transition-colors"
                    title="标记为已读"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              {notification.content}
            </p>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {new Date(notification.created_at).toLocaleString('zh-CN')}
              </span>
              {notification.related_task_title && (
                <span className="flex items-center">
                  <FileText className="w-3 h-3 mr-1" />
                  {notification.related_task_title}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-16 z-[99]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col z-[100]">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <BellRing className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">通知中心</h2>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 过滤器 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filter === 'all' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filter === 'unread' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              未读
            </button>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="mt-2 text-sm text-blue-500 hover:text-blue-700 transition-colors"
            >
              全部标记为已读
            </button>
          )}
        </div>

        {/* 通知列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无通知</h3>
              <p className="text-gray-600">
                {filter === 'unread' ? '没有未读通知' : '您还没有收到任何通知'}
              </p>
            </div>
          ) : (
            <div>
              {notifications.map(renderNotificationItem)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 通知铃铛组件
export function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // 获取未读通知数量
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getUnreadNotificationCount();
      if (response.success) {
        setUnreadCount(response.data.unread_count || 0);
      }
    } catch (error) {
      console.error('获取未读通知数量失败:', error);
    }
  }, [user]);

  useEffect(() => {
    // 定期获取未读通知数量
    const interval = setInterval(fetchUnreadCount, 30000); // 每30秒检查一次
    fetchUnreadCount();
    
    const handleRefresh = () => fetchUnreadCount();
    window.addEventListener('refresh-notifications', handleRefresh);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh-notifications', handleRefresh);
    };
  }, [fetchUnreadCount]);

  return (
    <>
      <button
        onClick={() => setShowNotifications(true)}
        className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
        title="通知"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      <NotificationCenter 
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}

