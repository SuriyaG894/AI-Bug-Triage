import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, Flag, GitBranch, GitPullRequest, AlertCircle, ExternalLink } from 'lucide-react';
import { notificationApi, NotificationItem } from '../services/api';

const typeIcons: Record<string, typeof Bell> = {
  bug_assigned: Flag,
  bug_status_changed: GitBranch,
  duplicate_found: GitPullRequest,
  sync_failed: AlertCircle,
};

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.list({ limit: 10 }),
        notificationApi.unreadCount(),
      ]);
      setNotifications(listRes.data.notifications);
      setUnreadCount(countRes.data.count);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    if (!open) fetchData();
    setOpen(!open);
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
    setLoading(false);
  };

  const handleClick = (n: NotificationItem) => {
    setOpen(false);
    navigate(`/notifications?selected=${n.id}`);
    if (!n.is_read) {
      notificationApi.markRead(n.id).then(() => {
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }).catch(() => {});
    }
  };

  const Icon = (type: string) => typeIcons[type] || Bell;

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle} className="btn-icon relative" title="Notifications">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-card border border-gray-200 animate-fade-in z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const TypeIcon = Icon(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !n.is_read ? 'bg-primary-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1 rounded-full ${
                        n.is_read ? 'text-gray-400' : 'text-primary-600'
                      }`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${n.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <button
              onClick={() => { navigate('/notifications'); setOpen(false); }}
              className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 border-t border-gray-100 rounded-b-xl transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View all notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}
