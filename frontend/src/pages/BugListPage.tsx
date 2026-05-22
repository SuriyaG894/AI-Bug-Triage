import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bugApi, Bug, projectApi, Project } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, DataTable, Column, ConfirmDialog } from '../components';
import { Plus, Filter, FolderGit2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BugListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    severity: '',
    type: '',
    status: '',
    search: '',
  });
  const [searchQuery, setSearchQuery] = useState(filters.search);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteBug, setDeleteBug] = useState<Bug | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    projectApi.myProjects().then(res => {
      setProjects(res.data);
    }).catch(() => {}).finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => {
        if (prev.search === searchQuery) return prev;
        return { ...prev, search: searchQuery };
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!projectsLoading) {
      fetchBugs();
    }
  }, [filters, selectedProjectId, projectsLoading]);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const response = await bugApi.list({
        ...filters,
        project_id: selectedProjectId ?? undefined,
      });
      setBugs(response.data.bugs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching bugs:', error);
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
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

  const hasNoAssignments = !user?.is_admin && projects.length === 0;

  const columns: Column<Bug>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      sticky: 'left',
      render: (bug) => <span className="text-gray-500 font-mono text-xs">#{bug.id}</span>,
    },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (bug) => (
        <Link to={`/bugs/${bug.id}`} className="text-primary-600 hover:text-primary-700 font-medium hover:underline whitespace-normal break-words max-w-xs inline-block">
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
      sticky: 'right',
      render: (bug) => {
        const canAct = user?.is_admin || bug.created_by === user?.email;
        return canAct ? (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Link
              to={`/bugs/${bug.id}/edit`}
              className="text-primary-600 hover:text-primary-800 text-sm font-medium"
            >
              Edit
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteBug(bug);
              }}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Delete
            </button>
          </div>
        ) : null;
      },
    },
  ];

  if (isInitialLoading) {
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

      {/* Project Selector - prominent when user has projects */}
      {!user?.is_admin && projects.length > 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <FolderGit2 className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <label className="text-sm font-medium text-gray-700 flex-shrink-0">Project:</label>
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              className="input-field flex-1 max-w-xs"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* No Assignments Warning */}
      {hasNoAssignments && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">No Project Assignments</h3>
              <p className="text-sm text-amber-700 mt-1">
                You haven't been assigned to any projects yet. Contact your admin to get access.
              </p>
            </div>
          </div>
        </Card>
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                placeholder="Search bugs..."
              />
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
      <Card className="relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500 font-medium animate-pulse">Fetching bugs...</span>
            </div>
          </div>
        )}
        {hasNoAssignments ? (
          <div className="py-16 text-center">
            <FolderGit2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No bugs to display</p>
            <p className="text-sm text-gray-400 mt-1">You need project assignments to view or create bugs.</p>
          </div>
        ) : (
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
        )}
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
