import { useState, useEffect } from 'react';
import { adminApi, AdminUser, AdminDashboardStats, AdminSyncStatus, integrationApi, projectApi, Project } from '../services/api';
import Card from '../components/Card';
import toast from 'react-hot-toast';

type Tab = 'dashboard' | 'users' | 'integrations' | 'projects' | 'sync';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<AdminSyncStatus | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tool_type: 'azure_devops',
    name: '',
    auth_type: 'token',
    credentials: '',
  });
  const [syncing, setSyncing] = useState(false);
  const [syncInterval, setSyncInterval] = useState(15);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await adminApi.getDashboardStats();
        setStats(res.data);
      } else if (activeTab === 'users') {
        const res = await adminApi.listUsers();
        setUsers(res.data);
      } else if (activeTab === 'sync') {
        const res = await adminApi.getSyncStatus();
        setSyncStatus(res.data);
        setSyncInterval(res.data.interval_minutes || 15);
        setAutoSyncEnabled(res.data.interval_minutes > 0);
      } else if (activeTab === 'integrations') {
        const res = await adminApi.listIntegrations();
        setIntegrations(res.data);
      } else if (activeTab === 'projects') {
        const res = await projectApi.list();
        setProjects(res.data);
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
    const newEnabled = !autoSyncEnabled;
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
      await integrationApi.create(formData);
      setShowForm(false);
      setFormData({ tool_type: 'azure_devops', name: '', auth_type: 'token', credentials: '' });
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
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminApi.testIntegrationCredentials({
        tool_type: formData.tool_type,
        credentials: formData.credentials,
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
      {(['dashboard', 'users', 'integrations', 'projects', 'sync'] as Tab[]).map((tab) => (
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

  const renderSync = () => (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold mb-4">Sync Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="section-label">Auto Sync</label>
            <button
              onClick={handleToggleAutoSync}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${autoSyncEnabled ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-800'}`}
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
            <label className="section-label">Status</label>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-3 h-3 rounded-full ${syncStatus?.is_running ? 'bg-success' : 'bg-gray-400'}`}></span>
              <span className="text-sm text-text-primary">{syncStatus?.is_running ? 'Running' : 'Stopped'}</span>
            </div>
          </div>
          <div>
            <label className="section-label">Manual Sync</label>
            <button onClick={handleSyncNow} disabled={syncing} className="btn-secondary mt-2">
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );

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
                onClick={() => { setAssigningUsers(project.id); setSelectedUserIds(project.assigned_users?.map(u => u.user_id) || []); }}
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
              <button onClick={() => { setShowForm(false); setFormData({ tool_type: 'azure_devops', name: '', auth_type: 'token', credentials: '' }); setTestResult(null); }} className="btn-secondary">Cancel</button>
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
        </>
      )}
    </div>
  );
}
