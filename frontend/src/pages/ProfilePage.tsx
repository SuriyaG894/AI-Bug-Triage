import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await authApi.updateProfile(fullName);
      setMessage('Profile updated successfully!');
      setMessageType('success');
      setIsEditing(false);
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Failed to update profile');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Profile</h1>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">
                  {user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-4">
                <p className="text-lg font-medium text-gray-900">
                  {user.full_name || 'No name set'}
                </p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`px-6 py-3 ${
            messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <div className="px-6 py-4">
          {isEditing ? (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field"
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                <dd className="text-gray-900">{user.full_name || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="text-gray-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Account Status</dt>
                <dd className="text-gray-900">
                  {user.is_active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">User ID</dt>
                <dd className="text-gray-900 font-mono text-sm">{user.id}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Account Actions</h2>
        </div>
        <div className="px-6 py-4">
          <button
            onClick={logout}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}