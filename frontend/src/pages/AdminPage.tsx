import { useState, useEffect } from 'react';
import { adminApi, AdminUser, AdminDashboardStats, AdminSyncStatus, auditApi, AuditLogEntry, integrationApi, projectApi, Project } from '../services/api';
import Card from '../components/Card';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

type Tab = 'dashboard' | 'users' | 'integrations' | 'projects' | 'sync' | 'audit';

const formatRelativeTime = (isoString: string | null): string => {
  if (!isoString) return 'Never';
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ${diffMins % 60}m ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
};

const formatCountdown = (isoString: string | null): string => {
  if (!isoString) return 'N/A';
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = then.getTime() - now.getTime();
  if (diffMs <= 0) return 'Due now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `in ${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  return `in ${diffHrs}h ${diffMins % 60}m`;
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<AdminSyncStatus | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [timeoutHours, setTimeoutHours] = useState(2);
  const [timeoutMinutes, setTimeoutMinutes] = useState(0);
  const [isSavingTimeout, setIsSavingTimeout] = useState(false);
  const [activeLimitLabel, setActiveLimitLabel] = useState('2h 0m');
  const [formData, setFormData] = useState({
    tool_type: 'azure_devops',
    name: '',
    auth_type: 'token',
    credentials: '',
    org: '',
    project: '',
  });
  const [syncing, setSyncing] = useState(false);
  const [syncInterval, setSyncInterval] = useState(15);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize] = useState(20);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditExpandedId, setAuditExpandedId] = useState<number | null>(null);
  const [auditFilterEmail, setAuditFilterEmail] = useState<string>('');
  const [auditFilterAction, setAuditFilterAction] = useState<string>('');
  const [auditFilterDays, setAuditFilterDays] = useState<number>(7);

  const fetchAuditLogs = async (pageOverride?: number) => {
    setAuditLoading(true);
    try {
      const params: any = {
        days: auditFilterDays,
        page: pageOverride ?? auditPage,
        page_size: auditPageSize,
      };
      if (auditFilterEmail) params.user_email = auditFilterEmail;
      if (auditFilterAction) params.action = auditFilterAction;
      const resp = await auditApi.adminListLogs(params);
      setAuditLogs(resp.data.logs);
      setAuditTotal(resp.data.total);
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'audit') {
      setAuditPage(1);
      fetchAuditLogs(1);
    }
  }, [activeTab, auditFilterDays, auditFilterAction, auditFilterEmail]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [auditPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const [statsRes, timeoutRes] = await Promise.all([
          adminApi.getDashboardStats(),
          adminApi.getSessionTimeout()
        ]);
        setStats(statsRes.data);
        const { hours, minutes } = timeoutRes.data;
        setTimeoutHours(hours);
        setTimeoutMinutes(minutes);
        setActiveLimitLabel(`${hours}h ${minutes}m`);
      } else if (activeTab === 'users') {
        const res = await adminApi.listUsers();
        setUsers(res.data);
      } else if (activeTab === 'sync') {
        const res = await adminApi.getSyncStatus();
        setSyncStatus(res.data);
        setSyncInterval(res.data.interval_minutes || 15);
        setAutoSyncEnabled(res.data.auto_sync_enabled);
      } else if (activeTab === 'integrations') {
        const res = await adminApi.listIntegrations();
        setIntegrations(res.data);
      } else if (activeTab === 'projects') {
        const res = await projectApi.list();
        setProjects(res.data);
        const usersRes = await adminApi.listUsers();
        setUsers(usersRes.data);
      }
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      toast.error(error.response?.data?.detail || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteUser = async (userId: number, isAdmin: boolean) => {
    try {
      await adminApi.updateUserRole(userId, isAdmin);
      toast.success(`User ${isAdmin ? 'promoted to' : 'demoted from'} admin`);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update user role');
    }
  };

  const handleToggleUserStatus = async (userId: number, isActive: boolean) => {
    try {
      await adminApi.updateUserStatus(userId, isActive);
      toast.success(`User ${isActive ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update user status');
    }
  };

  const handleSaveTimeout = async () => {
    const totalMinutes = timeoutHours * 60 + timeoutMinutes;
    if (totalMinutes < 1) {
      toast.error('Session timeout must be at least 1 minute.');
      return;
    }
    setIsSavingTimeout(true);
    try {
      await adminApi.updateSessionTimeout(timeoutHours, timeoutMinutes);
      setActiveLimitLabel(`${timeoutHours}h ${timeoutMinutes}m`);
      toast.success('Session timeout updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update session timeout');
    } finally {
      setIsSavingTimeout(false);
    }
  };

  const handleResetTimeout = async () => {
    if (!window.confirm('Reset session timeout to default (2 hours)?')) return;
    setIsSavingTimeout(true);
    try {
      await adminApi.resetSessionTimeout();
      setTimeoutHours(2);
      setTimeoutMinutes(0);
      setActiveLimitLabel('2h 0m');
      toast.success('Session timeout reset to default');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to reset session timeout');
    } finally {
      setIsSavingTimeout(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await adminApi.triggerSync();
      toast.success(`Sync complete: ${res.data.synced || 0} synced, ${res.data.updated || 0} updated`);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleIntervalChange = async (minutes: number) => {
    try {
      await adminApi.updateSyncConfig(minutes, minutes > 0);
      setSyncInterval(minutes);
      setAutoSyncEnabled(minutes > 0);
      toast.success(`Sync interval updated to ${minutes} minutes`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update sync config');
    }
  };

  const handleToggleAutoSync = async () => {
    const currentEnabled = syncStatus?.auto_sync_enabled ?? autoSyncEnabled;
    const newEnabled = !currentEnabled;
    try {
      if (newEnabled) {
        await adminApi.startSync();
      } else {
        await adminApi.stopSync();
      }
      setAutoSyncEnabled(newEnabled);
      toast.success(newEnabled ? 'Auto sync enabled' : 'Auto sync disabled');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to toggle auto sync');
    }
  };

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectFormData, setProjectFormData] = useState({ name: '', description: '', ado_project_id: '', ado_project_name: '' });
  const [assigningUsers, setAssigningUsers] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const handleIntegrationCreate = async () => {
    try {
      await integrationApi.create({
        ...formData,
        config: { org: formData.org, project: formData.project },
      });
      setShowForm(false);
      setFormData({ tool_type: 'azure_devops', name: '', auth_type: 'token', credentials: '', org: '', project: '' });
      toast.success('Integration created');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create integration');
    }
  };

  const handleIntegrationDelete = async (id: number) => {
    if (!window.confirm('Delete this integration?')) return;
    try {
      await integrationApi.delete(id);
      toast.success('Integration deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete integration');
    }
  };

  const handleTestConnection = async () => {
    if (!formData.credentials) {
      toast.error('Enter an API token to test');
      return;
    }
    if (formData.tool_type === 'azure_devops' && !formData.org) {
      toast.error('Enter the Azure DevOps organisation to test');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminApi.testIntegrationCredentials({
        tool_type: formData.tool_type,
        credentials: formData.credentials,
        org: formData.org || undefined,
      });
      setTestResult({ success: true, message: res.data.message || 'Connection successful' });
      toast.success('Connection successful');
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Connection failed';
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleCreateProject = async () => {
    try {
      if (editingProject) {
        await projectApi.update(editingProject.id, {
          name: projectFormData.name,
          description: projectFormData.description,
          is_active: true,
        });
        toast.success('Project updated');
      } else {
        await projectApi.create({
          name: projectFormData.name,
          description: projectFormData.description,
          ado_project_id: projectFormData.ado_project_id || undefined,
          ado_project_name: projectFormData.ado_project_name || undefined,
        });
        toast.success('Project created');
      }
      setShowProjectForm(false);
      setEditingProject(null);
      setProjectFormData({ name: '', description: '', ado_project_id: '', ado_project_name: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save project');
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await projectApi.delete(id);
      toast.success('Project deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectFormData({
      name: project.name,
      description: project.description || '',
      ado_project_id: project.ado_project_id || '',
      ado_project_name: project.ado_project_name || '',
    });
    setShowProjectForm(true);
  };

  const handleAssignUsers = async (projectId: number) => {
    try {
      await projectApi.assignUsers(projectId, selectedUserIds);
      toast.success('Users assigned');
      setAssigningUsers(null);
      setSelectedUserIds([]);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to assign users');
    }
  };

  const handleSyncProjectsFromADO = async () => {
    try {
      const res = await projectApi.syncFromADO();
      toast.success(res.data.message || 'Projects synced from ADO');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to sync projects');
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const renderTabs = () => (
    <div className="flex border-b border-border mb-6">
      {(['dashboard', 'users', 'integrations', 'projects', 'sync', 'audit'] as Tab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
            activeTab === tab
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  const renderDashboard = () => {
    if (!stats) return <p className="text-text-muted">Loading...</p>;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-text-muted">Total Users</h3>
            <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_users}</p>
            <p className="text-sm text-text-muted mt-1">{stats.active_users} active</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-text-muted">Total Bugs</h3>
            <p className="text-3xl font-bold text-text-primary mt-2">{stats.total_bugs}</p>
            <p className="text-sm text-text-muted mt-1">{stats.open_bugs} open, {stats.closed_bugs} closed</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium text-text-muted">Synced Bugs</h3>
            <p className="text-3xl font-bold text-text-primary mt-2">{stats.synced_bugs}</p>
            <p className="text-sm text-text-muted mt-1">From Azure DevOps</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Session Timeout Settings</h2>
              <p className="text-sm text-text-secondary">Configure the system-wide inactivity timeout limit for user sessions.</p>
            </div>
          </div>

          <div className="max-w-xl space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="section-label">Hours</label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={timeoutHours}
                  onChange={(e) => setTimeoutHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input-field mt-1"
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="section-label">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={timeoutMinutes}
                  onChange={(e) => setTimeoutMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input-field mt-1"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-muted bg-surface-secondary p-3 rounded-lg">
              <span className="font-semibold text-text-secondary">Current Active Limit:</span>
              <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-xs font-semibold">
                {activeLimitLabel}
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveTimeout}
                disabled={isSavingTimeout}
                className="btn-primary"
              >
                {isSavingTimeout ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={handleResetTimeout}
                disabled={isSavingTimeout}
                className="btn-secondary font-medium"
              >
                Reset to Default (2h)
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderUsers = () => (
    <Card>
      <h2 className="text-lg font-semibold mb-4">User Management</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-surface-secondary transition-colors">
                <td className="px-4 py-3 text-sm text-text-primary">{user.email}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{user.full_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${user.is_admin ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.is_admin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${user.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => handlePromoteUser(user.id, !user.is_admin)}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                  >
                    {user.is_admin ? 'Demote' : 'Promote'}
                  </button>
                  <button
                    onClick={() => handleToggleUserStatus(user.id, !user.is_active)}
                    className="text-xs text-text-secondary hover:text-text-primary font-medium"
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const refreshSyncStatus = async () => {
    try {
      const res = await adminApi.getSyncStatus();
      setSyncStatus(res.data);
      setSyncInterval(res.data.interval_minutes || 15);
      setAutoSyncEnabled(res.data.auto_sync_enabled);
    } catch (err: any) {
      toast.error('Failed to refresh sync status');
    }
  };

  const handleClearSyncHistory = async () => {
    try {
      await adminApi.clearSync();
      toast.success('Sync history cleared');
      refreshSyncStatus();
    } catch (err: any) {
      toast.error('Failed to clear sync history');
    }
  };

  const renderSync = () => {
    const result = syncStatus?.last_sync_result as { synced?: number; updated?: number; errors?: number } | null;

    return (
      <div className="space-y-4">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Sync Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="section-label">Auto Sync</label>
              <button
                onClick={handleToggleAutoSync}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                  autoSyncEnabled ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {autoSyncEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <div>
              <label className="section-label">Sync Interval</label>
              <select
                value={syncInterval}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="input-field"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
                <option value={0}>Manual only</option>
              </select>
            </div>
            <div>
              <label className="section-label">Scheduler Status</label>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${syncStatus?.is_running ? 'bg-success animate-pulse' : 'bg-gray-400'}`}></span>
                <span className="text-sm text-text-primary">{syncStatus?.is_running ? 'Running' : 'Stopped'}</span>
              </div>
            </div>
            <div>
              <label className="section-label">Manual Sync</label>
              <button onClick={handleSyncNow} disabled={syncing} className="btn-secondary mt-2 w-full">
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Sync Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="text-xs text-text-muted uppercase tracking-wide">Last Sync</p>
              <p className="text-lg font-semibold text-text-primary mt-1">{formatRelativeTime(syncStatus?.last_sync_at ?? null)}</p>
            </div>
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="text-xs text-text-muted uppercase tracking-wide">Next Sync</p>
              <p className="text-lg font-semibold text-text-primary mt-1">{formatCountdown(syncStatus?.next_sync_at ?? null)}</p>
            </div>
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="text-xs text-text-muted uppercase tracking-wide">Total Synced</p>
              <p className="text-lg font-semibold text-text-primary mt-1">{syncStatus?.total_synced || 0}</p>
            </div>
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="text-xs text-text-muted uppercase tracking-wide">Interval</p>
              <p className="text-lg font-semibold text-text-primary mt-1">{syncStatus?.interval_minutes ? `${syncStatus.interval_minutes}m` : 'Manual'}</p>
            </div>
          </div>

          {result && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-text-secondary mb-2">Last Sync Results</p>
              <div className="flex gap-4 text-sm">
                <span className="text-success font-medium">{result.synced || 0} new</span>
                <span className="text-info font-medium">{result.updated || 0} updated</span>
                <span className={result.errors ? 'text-error font-medium' : 'text-text-muted'}>{result.errors || 0} errors</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            <button onClick={refreshSyncStatus} className="btn-secondary text-sm">
              Refresh Status
            </button>
            <button onClick={handleClearSyncHistory} className="btn-secondary text-sm text-error hover:text-error/80">
              Clear History
            </button>
          </div>
        </Card>
      </div>
    );
  };

  const renderProjects = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Project Management</h2>
        <div className="flex gap-2">
          <button onClick={handleSyncProjectsFromADO} className="btn-secondary">
            Sync from ADO
          </button>
          <button onClick={() => { setShowProjectForm(true); setEditingProject(null); setProjectFormData({ name: '', description: '', ado_project_id: '', ado_project_name: '' }); }} className="btn-primary">
            Add Project
          </button>
        </div>
      </div>

      {showProjectForm && (
        <Card>
          <h3 className="text-md font-semibold mb-4">{editingProject ? 'Edit Project' : 'New Project'}</h3>
          <div className="space-y-4">
            <div>
              <label className="section-label">Project Name *</label>
              <input
                type="text"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                className="input-field"
                placeholder="My Project"
              />
            </div>
            <div>
              <label className="section-label">Description</label>
              <textarea
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="section-label">ADO Project ID (optional)</label>
              <input
                type="text"
                value={projectFormData.ado_project_id}
                onChange={(e) => setProjectFormData({ ...projectFormData, ado_project_id: e.target.value })}
                className="input-field"
                placeholder="Auto-filled when syncing from ADO"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleCreateProject} disabled={!projectFormData.name} className="btn-primary">
                {editingProject ? 'Update' : 'Create'}
              </button>
              <button onClick={() => { setShowProjectForm(false); setEditingProject(null); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Card>
      )}

      {projects.length === 0 && !showProjectForm && (
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-text-secondary mb-3">No projects configured yet. Sync from Azure DevOps or add manually.</p>
              <p className="text-xs text-text-muted">Projects allow you to scope bugs to specific ADO projects and restrict user access.</p>
            </div>
          </div>
        </Card>
      )}

      {projects.map((project) => (
        <Card key={project.id}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-text-primary">{project.name}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${project.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  {project.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {project.description && <p className="text-sm text-text-secondary">{project.description}</p>}
              {project.ado_project_name && <p className="text-sm text-text-secondary">ADO: {project.ado_project_name}</p>}
              <div className="mt-2">
                <p className="text-sm text-text-secondary">
                  Assigned Users: {project.assigned_users?.length || 0}
                  {project.assigned_users && project.assigned_users.length > 0 && (
                    <span className="text-text-muted ml-2">({project.assigned_users.map(u => u.email).join(', ')})</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <button
                onClick={async () => {
                  if (users.length === 0) {
                    try {
                      console.log('[AdminPage] Fetching users for assignment...');
                      const res = await adminApi.listUsers();
                      console.log('[AdminPage] Users response:', res.data);
                      setUsers(res.data);
                    } catch (err: any) {
                      console.error('[AdminPage] Failed to load users:', err);
                      toast.error(err?.response?.data?.detail || 'Failed to load users');
                    }
                  }
                  setAssigningUsers(project.id);
                  setSelectedUserIds(project.assigned_users?.map(u => u.user_id) || []);
                }}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Assign Users
              </button>
              <button
                onClick={() => handleEditProject(project)}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteProject(project.id)}
                className="text-sm text-error hover:text-error/80 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </Card>
      ))}

      {assigningUsers !== null && (
        <Card>
          <h3 className="text-md font-semibold mb-4">Assign Users to Project</h3>
          {users.length === 0 ? (
            <p className="text-sm text-text-muted py-4">Loading users...</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {users.map(user => (
                <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-surface-secondary rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                    className="rounded"
                  />
                  <span className="text-sm text-text-primary">{user.email}</span>
                  {user.full_name && <span className="text-sm text-text-secondary">({user.full_name})</span>}
                  {user.is_admin && <span className="text-xs px-1.5 py-0.5 rounded bg-primary-100 text-primary-800">Admin</span>}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-4 pt-2 border-t border-border">
            <button onClick={() => handleAssignUsers(assigningUsers)} className="btn-primary">
              Save Assignments
            </button>
            <button onClick={() => { setAssigningUsers(null); setSelectedUserIds([]); }} className="btn-secondary">Cancel</button>
          </div>
        </Card>
      )}
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Integration Management</h2>
        <button onClick={() => { setShowForm(true); setTestResult(null); }} className="btn-primary">
          Add Integration
        </button>
      </div>

      {showForm && (
        <Card>
          <h3 className="text-md font-semibold mb-4">New Integration</h3>
          <div className="space-y-4">
            <div>
              <label className="section-label">Tool Type</label>
              <select
                value={formData.tool_type}
                onChange={(e) => { setFormData({ ...formData, tool_type: e.target.value }); setTestResult(null); }}
                className="input-field"
              >
                <option value="azure_devops">Azure DevOps</option>
                <option value="jira">JIRA</option>
              </select>
            </div>
            <div>
              <label className="section-label">Name (optional)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="My Azure DevOps"
              />
            </div>
            <div>
              <label className="section-label">Auth Type</label>
              <select
                value={formData.auth_type}
                onChange={(e) => setFormData({ ...formData, auth_type: e.target.value })}
                className="input-field"
              >
                <option value="token">API Token / PAT</option>
              </select>
            </div>
            {formData.tool_type === 'azure_devops' && (
              <>
                <div>
                  <label className="section-label">Organisation *</label>
                  <input
                    type="text"
                    value={formData.org}
                    onChange={(e) => setFormData({ ...formData, org: e.target.value })}
                    className="input-field"
                    placeholder="e.g. suriyaganesh894"
                  />
                </div>
                <div>
                  <label className="section-label">Default Project (optional)</label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    className="input-field"
                    placeholder="e.g. AiBugTriage"
                  />
                </div>
              </>
            )}
            {formData.auth_type === 'token' && (
              <div>
                <label className="section-label">API Token</label>
                <input
                  type="password"
                  value={formData.credentials}
                  onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                  className="input-field"
                  placeholder="Enter API token"
                />
              </div>
            )}

            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                {testResult.message}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={handleTestConnection} disabled={testing || !formData.credentials} className="btn-secondary">
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button onClick={handleIntegrationCreate} disabled={!formData.credentials} className="btn-primary">Save</button>
              <button onClick={() => { setShowForm(false); setFormData({ tool_type: 'azure_devops', name: '', auth_type: 'token', credentials: '', org: '', project: '' }); setTestResult(null); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Card>
      )}

      {integrations.length === 0 && !showForm && (
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-text-primary">Azure DevOps</h3>
                <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-gray-100 text-gray-600">Not Configured</span>
              </div>
              <p className="text-sm text-text-secondary mb-3">Connect to Azure DevOps to sync work items and push bugs.</p>
              <p className="text-xs text-text-muted">Click "Add Integration" above to configure your Azure DevOps Personal Access Token (PAT).</p>
            </div>
          </div>
        </Card>
      )}

      {integrations.map((integration) => (
        <Card key={integration.id}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-text-primary">{integration.name || integration.tool_type.replace('_', ' ').toUpperCase()}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${integration.is_connected ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                  {integration.is_connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <p className="text-sm text-text-secondary">Type: {integration.tool_type.replace('_', ' ').toUpperCase()}</p>
              <p className="text-sm text-text-secondary">Auth: {integration.auth_type}</p>
              {(integration.org || integration.project) && (
                <p className="text-sm text-text-secondary">
                  Org: <span className="font-medium">{integration.org || '-'}</span> | Project: <span className="font-medium">{integration.project || '-'}</span>
                </p>
              )}
              <p className="text-sm text-text-secondary">
                Status: {integration.is_active ? 'Active' : 'Inactive'} | 
                Last Sync: {integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : 'Never'}
              </p>
            </div>
            <button
              onClick={() => handleIntegrationDelete(integration.id)}
              className="text-error hover:text-error/80 text-sm font-medium ml-4 flex-shrink-0"
            >
              Delete
            </button>
          </div>
        </Card>
      ))}
    </div>
  );

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
    'admin.update_session_timeout': 'Updated Session Timeout',
    'admin.reset_session_timeout': 'Reset Session Timeout',
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
    'admin.update_session_timeout': 'bg-orange-100 text-orange-800',
    'admin.reset_session_timeout': 'bg-orange-100 text-orange-800',
  };

  function getActionLabel(action: string): string {
    return actionLabels[action] || action;
  }

  function getActionClass(action: string): string {
    return actionColors[action] || 'bg-gray-100 text-gray-600';
  }

  function formatAuditDate(dateStr: string): string {
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

  const renderAuditLogs = () => (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold mb-4">Audit Logs</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">User Email</label>
            <input
              type="text"
              placeholder="Filter by email"
              value={auditFilterEmail}
              onChange={e => setAuditFilterEmail(e.target.value)}
              className="input-field text-sm w-48"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Action</label>
            <select
              value={auditFilterAction}
              onChange={e => setAuditFilterAction(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All actions</option>
              {Object.keys(actionLabels).map(a => (
                <option key={a} value={a}>{actionLabels[a]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Days</label>
            <select
              value={auditFilterDays}
              onChange={e => setAuditFilterDays(Number(e.target.value))}
              className="input-field text-sm"
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => { setAuditFilterEmail(''); setAuditFilterAction(''); setAuditFilterDays(7); setAuditPage(1); }} className="btn-secondary text-sm">Reset</button>
          </div>
        </div>

        {auditLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="text-center py-8 text-text-muted">No audit logs found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Details</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-text-primary">{log.user_email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getActionClass(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.details ? (
                          <button
                            onClick={() => setAuditExpandedId(auditExpandedId === log.id ? null : log.id)}
                            className="flex items-center gap-1 text-sm text-text-secondary hover:text-primary-600"
                          >
                            {auditExpandedId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {auditExpandedId === log.id ? 'Hide details' : 'View details'}
                          </button>
                        ) : (
                          <span className="text-sm text-text-muted">-</span>
                        )}
                        {auditExpandedId === log.id && log.details && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-text-secondary">
                            {formatDetails(log.details)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                        {formatAuditDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {Math.ceil(auditTotal / auditPageSize) > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-text-secondary">
                  Page {auditPage} of {Math.ceil(auditTotal / auditPageSize)} ({auditTotal} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                    disabled={auditPage <= 1}
                    className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setAuditPage(Math.min(Math.ceil(auditTotal / auditPageSize), auditPage + 1))}
                    disabled={auditPage >= Math.ceil(auditTotal / auditPageSize)}
                    className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin Panel</h1>
        <p className="text-sm text-text-secondary">Manage users, integrations, and sync settings</p>
      </div>
      {renderTabs()}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'sync' && renderSync()}
          {activeTab === 'integrations' && renderIntegrations()}
          {activeTab === 'projects' && renderProjects()}
          {activeTab === 'audit' && renderAuditLogs()}
        </>
      )}
    </div>
  );
}
