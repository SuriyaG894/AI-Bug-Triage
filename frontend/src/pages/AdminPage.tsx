import { useState, useEffect } from 'react';
import { adminApi, AdminUser, AdminDashboardStats, AdminSyncStatus, Integration } from '../services/api';

type Tab = 'dashboard' | 'users' | 'integrations' | 'sync';

const syncApi = {
  getStatus: () => fetch('/api/sync/status').then(r => r.json()),
  updateConfig: (interval: number, enabled: boolean) => fetch('/api/admin/sync/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interval_minutes: interval, auto_sync_enabled: enabled })
  }).then(r => r.json()),
  trigger: () => fetch('/api/admin/sync/trigger', { method: 'POST' }).then(r => r.json()),
  start: () => fetch('/api/admin/sync/start', { method: 'POST' }).then(r => r.json()),
  stop: () => fetch('/api/admin/sync/stop', { method: 'POST' }).then(r => r.json()),
};

const integrationApi = {
  list: () => fetch('/api/admin/integrations').then(r => r.json()),
  create: (data: { tool_type: string; name?: string; auth_type: string; credentials?: string }) => 
    fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  update: (id: number, data: Record<string, unknown>) => 
    fetch(`/api/integrations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  delete: (id: number) => fetch(`/api/integrations/${id}`, { method: 'DELETE' }).then(r => r.json()),
  sync: (id: number) => fetch(`/api/integrations/${id}/sync`, { method: 'POST' }).then(r => r.json()),
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<AdminSyncStatus | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
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
        const res = await syncApi.getStatus();
        setSyncStatus(res);
        setSyncInterval(res.interval_minutes || 15);
        setAutoSyncEnabled(res.interval_minutes > 0);
      } else if (activeTab === 'integrations') {
        const res = await integrationApi.list();
        setIntegrations(res.data || res);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteUser = async (userId: number, isAdmin: boolean) => {
    try {
      await adminApi.updateUserRole(userId, isAdmin);
      fetchData();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleToggleUserStatus = async (userId: number, isActive: boolean) => {
    try {
      await adminApi.updateUserStatus(userId, isActive);
      fetchData();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await syncApi.trigger();
      alert(`Sync complete: ${res.synced || 0} synced, ${res.updated || 0} updated`);
      fetchData();
    } catch (error) {
      console.error('Error triggering sync:', error);
      alert('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleIntervalChange = async (minutes: number) => {
    try {
      await syncApi.updateConfig(minutes, minutes > 0);
      setSyncInterval(minutes);
      setAutoSyncEnabled(minutes > 0);
      alert(`Sync interval updated to ${minutes} minutes`);
    } catch (error) {
      console.error('Error updating sync config:', error);
    }
  };

  const handleToggleAutoSync = async () => {
    const newEnabled = !autoSyncEnabled;
    try {
      if (newEnabled) {
        await syncApi.start();
      } else {
        await syncApi.stop();
      }
      setAutoSyncEnabled(newEnabled);
      fetchData();
    } catch (error) {
      console.error('Error toggling auto sync:', error);
    }
  };

  const handleIntegrationCreate = async () => {
    try {
      await integrationApi.create(formData);
      setShowForm(false);
      setFormData({ tool_type: 'azure_devops', name: '', auth_type: 'token', credentials: '' });
      fetchData();
    } catch (error) {
      console.error('Error creating integration:', error);
    }
  };

  const handleIntegrationDelete = async (id: number) => {
    if (!window.confirm('Delete this integration?')) return;
    try {
      await integrationApi.delete(id);
      fetchData();
    } catch (error) {
      console.error('Error deleting integration:', error);
    }
  };

  const renderTabs = () => (
    <div className="flex border-b border-gray-200 mb-6">
      {(['dashboard', 'users', 'integrations', 'sync'] as Tab[]).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`px-4 py-2 text-sm font-medium capitalize ${
            activeTab === tab
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  const renderDashboard = () => {
    if (!stats) return <div>Loading...</div>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_users}</p>
          <p className="text-sm text-gray-500 mt-1">{stats.active_users} active</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500">Total Bugs</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total_bugs}</p>
          <p className="text-sm text-gray-500 mt-1">{stats.open_bugs} open, {stats.closed_bugs} closed</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-500">Synced Bugs</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.synced_bugs}</p>
          <p className="text-sm text-gray-500 mt-1">From Azure DevOps</p>
        </div>
      </div>
    );
  };

  const renderUsers = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">User Management</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{user.full_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${user.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.is_admin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => handlePromoteUser(user.id, !user.is_admin)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {user.is_admin ? 'Demote' : 'Promote'}
                  </button>
                  <button
                    onClick={() => handleToggleUserStatus(user.id, !user.is_active)}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSync = () => (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Sync Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Auto Sync</label>
            <button
              onClick={handleToggleAutoSync}
              className={`px-3 py-2 rounded text-sm ${autoSyncEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
            >
              {autoSyncEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sync Interval</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-3 h-3 rounded-full ${syncStatus?.is_running ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              <span className="text-sm">{syncStatus?.is_running ? 'Running' : 'Stopped'}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manual Sync</label>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="btn-secondary"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIntegrations = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Integration Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Integration
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-md font-semibold mb-4">New Integration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tool Type</label>
              <select
                value={formData.tool_type}
                onChange={(e) => setFormData({ ...formData, tool_type: e.target.value })}
                className="input-field"
              >
                <option value="azure_devops">Azure DevOps</option>
                <option value="jira">JIRA</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="My Azure DevOps"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auth Type</label>
              <select
                value={formData.auth_type}
                onChange={(e) => setFormData({ ...formData, auth_type: e.target.value })}
                className="input-field"
              >
                <option value="token">API Token / PAT</option>
                <option value="oauth">OAuth 2.0</option>
              </select>
            </div>
            {formData.auth_type === 'token' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                <input
                  type="password"
                  value={formData.credentials}
                  onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                  className="input-field"
                  placeholder="Enter API token"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleIntegrationCreate} className="btn-primary">Save</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {integrations.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No integrations configured</p>
        ) : (
          integrations.map((integration: Record<string, unknown>) => (
            <div key={integration.id} className="card">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{(integration.name as string) || (integration.tool_type as string)?.replace('_', ' ').toUpperCase()}</h3>
                  <p className="text-sm text-gray-500">Type: {integration.tool_type as string}</p>
                  <p className="text-sm text-gray-500">Auth: {integration.auth_type}</p>
                  <p className="text-sm text-gray-500">
                    Status: {integration.is_active ? 'Active' : 'Inactive'} | 
                    Connected: {integration.is_connected ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleIntegrationDelete(integration.id as number)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500">Manage users, integrations, and sync settings</p>
      </div>
      {renderTabs()}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'sync' && renderSync()}
          {activeTab === 'integrations' && renderIntegrations()}
        </>
      )}
    </div>
  );
}