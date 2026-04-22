import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bugApi, Bug } from '../services/api';

export default function BugListPage() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    severity: '',
    type: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    fetchBugs();
  }, [filters]);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const response = await bugApi.list(filters);
      setBugs(response.data.bugs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching bugs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this bug?')) return;
    
    try {
      await bugApi.delete(id);
      fetchBugs();
    } catch (error) {
      console.error('Error deleting bug:', error);
    }
  };

  const getSeverityClass = (severity: string) => {
    const classes: Record<string, string> = {
      critical: 'severity-critical',
      high: 'severity-high',
      medium: 'severity-medium',
      low: 'severity-low',
    };
    return classes[severity] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Bugs</h1>
        <Link to="/bugs/new" className="btn-primary">
          Report New Bug
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field"
              placeholder="Search bugs..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="input-field"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="input-field"
            >
              <option value="">All</option>
              <option value="ui">UI</option>
              <option value="backend">Backend</option>
              <option value="api">API</option>
              <option value="data">Data</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input-field"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bug List */}
      <div className="card">
        <p className="text-sm text-gray-500 mb-4">
          Showing {bugs.length} of {total} bugs
        </p>

        {bugs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No bugs found. <Link to="/bugs/new" className="text-primary-600 hover:underline">Report a new bug</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bugs.map((bug) => (
              <div
                key={bug.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Link
                      to={`/bugs/${bug.id}`}
                      className="text-lg font-medium text-gray-900 hover:text-primary-600"
                    >
                      {bug.title}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">
                      {bug.description.substring(0, 150)}
                      {bug.description.length > 150 ? '...' : ''}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className={`severity-badge ${getSeverityClass(bug.severity)}`}>
                        {bug.severity}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                        {bug.type}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                        {bug.status}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                        {bug.source}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(bug.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
