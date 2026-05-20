import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Bell, Flag, GitBranch, GitPullRequest, AlertCircle,
  CheckCheck, X, ArrowLeft, ArrowRight, ExternalLink, Loader2,
} from 'lucide-react';
import { notificationApi, NotificationItem } from '../services/api';
import { Card, Skeleton } from '../components';

const PAGE_SIZE = 15;

const typeIcons: Record<string, typeof Bell> = {
  bug_assigned: Flag,
  bug_status_changed: GitBranch,
  duplicate_found: GitPullRequest,
  sync_failed: AlertCircle,
};

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface DetailProps {
  notification: NotificationItem;
  onClose: () => void;
}

function DetailCard({ notification: n, onClose }: DetailProps) {
  const navigate = useNavigate();
  const TypeIcon = typeIcons[n.type] || Bell;

  const meta = n.metadata_;
  const items: { label: string; value: string }[] = [];

  if (n.type === 'bug_assigned') {
    items.push({ label: 'Action', value: 'Bug assigned' });
    items.push({ label: 'Bug', value: meta?.title || '-' });
    items.push({ label: 'Assigned to', value: meta?.assignee_email || '-' });
    items.push({ label: 'By', value: meta?.changed_by || 'system' });
  } else if (n.type === 'bug_status_changed') {
    items.push({ label: 'Action', value: 'Status changed' });
    items.push({ label: 'Bug', value: meta?.title || '-' });
    items.push({ label: 'From', value: meta?.old_status || '-' });
    items.push({ label: 'To', value: meta?.new_status || '-' });
    items.push({ label: 'By', value: meta?.changed_by || 'system' });
  } else if (n.type === 'bug_deleted') {
    items.push({ label: 'Action', value: 'Bug deleted' });
    items.push({ label: 'Bug', value: meta?.title || '-' });
    items.push({ label: 'By', value: meta?.deleted_by || 'an admin' });
  } else {
    items.push({ label: 'Action', value: n.title });
    if (meta?.title) items.push({ label: 'Bug', value: meta.title });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-card sticky top-24">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary-100 text-primary-700">
            <TypeIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{n.title}</h3>
            <p className="text-xs text-gray-500">{formatTimestamp(n.created_at)}</p>
          </div>
        </div>
        <button onClick={onClose} className="btn-icon text-gray-400 hover:text-gray-700" title="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {n.message && (
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{n.message}</p>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-24 shrink-0">{item.label}</span>
                <span className="text-gray-900 font-medium truncate">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {n.link && n.type !== 'bug_deleted' && (
          <button
            onClick={() => { navigate(n.link!); }}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-800 mt-2"
          >
            <ExternalLink className="w-4 h-4" />
            View Bug
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const selected = notifications.find(n => n.id === selectedId) || null;

  useEffect(() => {
    const sel = searchParams.get('selected');
    if (sel) {
      const id = parseInt(sel, 10);
      if (!isNaN(id)) {
        setSelectedId(id);
      }
      setSearchParams({}, { replace: true });
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list({
        limit: PAGE_SIZE,
        offset,
        unread_only: unreadOnly || undefined,
      });
      setNotifications(res.data.notifications);
      setTotal(res.data.total);
      setUnreadCount(res.data.unread_count);

      if (selectedId && !res.data.notifications.find(n => n.id === selectedId)) {
        setSelectedId(null);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [offset, unreadOnly, selectedId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleTabChange = (unread: boolean) => {
    setUnreadOnly(unread);
    setOffset(0);
    setSelectedId(null);
  };

  const handleSelect = async (n: NotificationItem) => {
    setSelectedId(n.id);
    if (!n.is_read) {
      try {
        await notificationApi.markRead(n.id);
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {}
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
    setMarkingAll(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread out of ${total} total`
              : `${total} total`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg border border-primary-200 transition-colors"
          >
            {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => handleTabChange(false)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            !unreadOnly
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => handleTabChange(true)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            unreadOnly
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Card>
            {loading ? (
              <div className="space-y-4 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} lines={2} />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No notifications</p>
                <p className="text-sm text-gray-400 mt-1">
                  {unreadOnly ? 'All caught up!' : 'You have no notifications yet'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((n) => {
                  const TypeIcon = typeIcons[n.type] || Bell;
                  const isSelected = n.id === selectedId;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleSelect(n)}
                      className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-gray-50 ${
                        isSelected ? 'bg-primary-50/60 ring-1 ring-primary-200' : ''
                      } ${!n.is_read ? 'bg-primary-50/30' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-full ${
                          n.is_read ? 'text-gray-400' : 'text-primary-600'
                        }`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm truncate ${n.is_read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />
                            )}
                          </div>
                          {n.message && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.message}</p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-1">{formatTimestamp(n.created_at)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOffset(prev => Math.max(0, prev - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  <button
                    onClick={() => setOffset(prev => prev + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= total}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 hidden lg:block">
          {selected ? (
            <DetailCard notification={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-card p-8 text-center">
              <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">Select a notification</p>
              <p className="text-sm text-gray-400 mt-1">Click on a notification to view details</p>
            </div>
          )}
        </div>
      </div>

      {selected && (() => {
        const n = selected;
        const TypeIcon = typeIcons[n.type] || Bell;
        const meta = n.metadata_;
        const mItems: { label: string; value: string }[] = [];

        if (n.type === 'bug_assigned') {
          mItems.push({ label: 'Action', value: 'Bug assigned' });
          mItems.push({ label: 'Bug', value: meta?.title || '-' });
          mItems.push({ label: 'Assigned to', value: meta?.assignee_email || '-' });
          mItems.push({ label: 'By', value: meta?.changed_by || 'system' });
        } else if (n.type === 'bug_status_changed') {
          mItems.push({ label: 'Action', value: 'Status changed' });
          mItems.push({ label: 'Bug', value: meta?.title || '-' });
          mItems.push({ label: 'From', value: meta?.old_status || '-' });
          mItems.push({ label: 'To', value: meta?.new_status || '-' });
          mItems.push({ label: 'By', value: meta?.changed_by || 'system' });
        } else if (n.type === 'bug_deleted') {
          mItems.push({ label: 'Action', value: 'Bug deleted' });
          mItems.push({ label: 'Bug', value: meta?.title || '-' });
          mItems.push({ label: 'By', value: meta?.deleted_by || 'an admin' });
        } else {
          mItems.push({ label: 'Action', value: n.title });
          if (meta?.title) mItems.push({ label: 'Bug', value: meta.title });
        }

        return (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedId(null)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl shadow-xl animate-slide-up">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary-100 text-primary-700">
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{n.title}</h3>
                      <p className="text-xs text-gray-500">{formatTimestamp(n.created_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedId(null)} className="btn-icon text-gray-400" title="Close">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {n.message && (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-4">{n.message}</p>
                )}
                {mItems.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {mItems.map((item) => (
                      <div key={item.label} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 w-24 shrink-0">{item.label}</span>
                        <span className="text-gray-900 font-medium truncate">{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {n.link && n.type !== 'bug_deleted' && (
                  <button
                    onClick={() => { navigate(n.link!); setSelectedId(null); }}
                    className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-800"
                  >
                    <ExternalLink className="w-4 h-4" /> View Bug
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
