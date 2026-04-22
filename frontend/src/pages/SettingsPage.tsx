import { useState, useEffect } from 'react';
import { integrationApi, Integration } from '../services/api';

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tool_type: 'azure_devops',
    name: '',
    auth_type: 'token',
    credentials: '',
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const response = await integrationApi.list();
      setIntegrations(response.data);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await integrationApi.create(formData);
      setShowForm(false);
      setFormData({
        tool_type: 'azure_devops',
        name: '',
        auth_type: 'token',
        credentials: '',
      });
      fetchIntegrations();
    } catch (error) {
      console.error('Error creating integration:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this integration?')) return;
    
    try {
      await integrationApi.delete(id);
      fetchIntegrations();
    } catch (error) {
      console.error('Error deleting integration:', error);
    }
  };

  const handleSync = async (id: number) => {
    try {
      await integrationApi.sync(id);
      alert('Sync triggered successfully');
      fetchIntegrations();
    } catch (error) {
      console.error('Error syncing integration:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integration Settings</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Add Integration
        </button>
      </div>

      {/* Integration Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">New Integration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tool Type
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="My Azure DevOps"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Authentication Type
              </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Token / PAT
                </label>
                <input
                  type="password"
                  value={formData.credentials}
                  onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                  className="input-field"
                  placeholder="Enter your API token"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCreate} className="btn-primary">
                Save Integration
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integration List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Connected Integrations</h2>
        {integrations.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No integrations configured. Click "Add Integration" to connect a tool.
          </p>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">
                      {integration.name || integration.tool_type.replace('_', ' ').toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Auth: {integration.auth_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      Status: {integration.is_active ? 'Active' : 'Inactive'}
                    </p>
                    {integration.last_sync_at && (
                      <p className="text-sm text-gray-500">
                        Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSync(integration.id)}
                      className="btn-secondary text-sm"
                    >
                      Sync
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
