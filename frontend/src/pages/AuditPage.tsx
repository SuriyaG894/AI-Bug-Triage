import { useState, useEffect } from 'react';
import { auditApi, AuditLogEntry } from '../services/api';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

const actionLabels: Record<string, string> = {
  'bug.create': 'Created Bug',
  'bug.update': 'Updated Bug',
  'bug.delete': 'Deleted Bug',
  'bug.push': 'Pushed Bug to External',
  'auth.login': 'Logged In',
  'auth.register': 'Registered',
  'auth.change_password': 'Changed Password',
  'auth.update_profile': 'Updated Profile',
  'admin.update_user_role': 'Changed User Role',
  'admin.update_user_status': 'Changed User Status',
  'admin.create_project': 'Created Project',
  'admin.update_project': 'Updated Project',
  'admin.delete_project': 'Deleted Project',
};

const actionColors: Record<string, string> = {
  'bug.create': 'bg-green-100 text-green-800',
  'bug.update': 'bg-blue-100 text-blue-800',
  'bug.delete': 'bg-red-100 text-red-800',
  'bug.push': 'bg-purple-100 text-purple-800',
  'auth.login': 'bg-gray-100 text-gray-800',
  'auth.register': 'bg-gray-100 text-gray-800',
  'auth.change_password': 'bg-yellow-100 text-yellow-800',
  'auth.update_profile': 'bg-blue-100 text-blue-800',
  'admin.update_user_role': 'bg-orange-100 text-orange-800',
  'admin.update_user_status': 'bg-orange-100 text-orange-800',
  'admin.create_project': 'bg-teal-100 text-teal-800',
  'admin.update_project': 'bg-teal-100 text-teal-800',
  'admin.delete_project': 'bg-red-100 text-red-800',
};

function getActionLabel(action: string): string {
  return actionLabels[action] || action;
}

function getActionClass(action: string): string {
  return actionColors[action] || 'bg-gray-100 text-gray-600';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDetails(details: Record<string, any> | null): string {
  if (!details) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (Array.isArray(value)) {
      parts.push(`${label}: ${value.join(', ')}`);
    } else if (typeof value === 'object' && value !== null) {
      parts.push(`${label}: ${JSON.stringify(value)}`);
    } else {
      parts.push(`${label}: ${value}`);
    }
  }
  return parts.join(' | ');
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const resp = await auditApi.myLogs({ days: 7, page, page_size: pageSize });
      setLogs(resp.data.logs);
      setTotal(resp.data.total);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-primary-600" />
        <h1 className="page-title">My Activity</h1>
      </div>
      <p className="text-text-secondary mb-6">Showing your actions from the last 7 days.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-text-muted">No activity found.</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Details</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getActionClass(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.details ? (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="flex items-center gap-1 text-sm text-text-secondary hover:text-primary-600"
                        >
                          {expandedId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {expandedId === log.id ? 'Hide details' : 'View details'}
                        </button>
                      ) : (
                        <span className="text-sm text-text-muted">-</span>
                      )}
                      {expandedId === log.id && log.details && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-text-secondary">
                          {formatDetails(log.details)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-text-secondary">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
