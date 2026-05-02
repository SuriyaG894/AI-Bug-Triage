import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bugApi, Bug, projectApi, Project } from '../services/api';
import { Badge, Card, DataTable, Column, ConfirmDialog } from '../components';
import { Plus, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BugListPage() {
  const navigate = useNavigate();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    severity: '',
    type: '',
    status: '',
    search: '',
    project_id: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [deleteBug, setDeleteBug] = useState<Bug | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    projectApi.myProjects().then(res => setProjects(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchBugs();
  }, [filters]);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const params: any = { ...filters };
      if (filters.project_id) {
        params.project_id = Number(filters.project_id);
      }
      delete params.project_id;
      const response = await bugApi.list({
        ...params,
        project_id: filters.project_id ? Number(filters.project_id) : undefined,
      });
      setBugs(response.data.bugs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching bugs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteBug) return;
    try {
      await bugApi.delete(deleteBug.id);
      toast.success('Bug deleted');
      setDeleteBug(null);
      fetchBugs();
    } catch (error) {
      toast.error('Failed to delete bug');
    }
  };

  const columns: Column<Bug>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (bug) => <span className="text-gray-500 font-mono text-xs">#{bug.id}</span>,
    },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (bug) => (
        <Link to={`/bugs/${bug.id}`} className="text-primary-600 hover:text-primary-700 font-medium hover:underline">
          {bug.title}
        </Link>
      ),
    },
    {
      key: 'project_id',
      header: 'Project',
      sortable: true,
      render: (bug) => {
        const proj = projects.find(p => p.id === bug.project_id);
        return proj ? <span className="text-sm text-text-secondary">{proj.name}</span> : <span className="text-sm text-text-muted">-</span>;
      },
    },
    {
      key: 'severity',
      header: 'Severity',
      sortable: true,
      render: (bug) => (
        <Badge
          label={bug.severity}
          variant="severity"
          color={bug.severity as 'critical' | 'high' | 'medium' | 'low'}
        />
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (bug) => <span className="capitalize">{bug.type}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (bug) => (
        <Badge
          label={bug.status.replace('_', ' ')}
          variant="status"
          color={bug.status as 'open' | 'in_progress' | 'resolved' | 'closed'}
        />
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (bug) => (
        <Badge
          label={bug.source}
          variant="source"
          color={bug.source === 'internal' ? 'internal' : 'external'}
        />
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (bug) => new Date(bug.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (bug) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteBug(bug);
          }}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Delete
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="h-10 bg-gray-200 rounded w-36 animate-pulse" />
        </div>
        <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bugs</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total bugs</p>
        </div>
        <Link to="/bugs/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Report New Bug
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
        
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-field"
                placeholder="Search bugs..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={filters.project_id}
                onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                className="input-field"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
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
        )}
      </Card>

      {/* Bug Table */}
      <Card>
        <DataTable
          data={bugs}
          columns={columns}
          rowKey={(bug) => bug.id}
          pageSize={10}
          searchable={false}
          exportable
          onRowClick={(bug) => navigate(`/bugs/${bug.id}`)}
          emptyMessage="No bugs found. Click 'Report New Bug' to create one."
        />
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteBug}
        onClose={() => setDeleteBug(null)}
        onConfirm={handleDelete}
        title="Delete Bug"
        message={`Are you sure you want to delete "${deleteBug?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}