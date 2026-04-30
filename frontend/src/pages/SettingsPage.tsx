import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email,
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessage('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="input-field bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="input-field"
              placeholder="Enter your full name"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          {message && (
            <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Account Info</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>Role:</strong> {user?.is_admin ? 'Admin' : 'User'}</p>
          <p><strong>Status:</strong> {user?.is_active ? 'Active' : 'Inactive'}</p>
        </div>
      </div>
    </div>
  );
}