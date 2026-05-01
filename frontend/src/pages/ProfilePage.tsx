import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

function getPasswordStrength(password: string): { level: string; color: string; text: string } {
  if (password.length === 0) return { level: '', color: '', text: '' };
  if (password.length < 8) return { level: 'weak', color: 'bg-red-500', text: 'Weak' };
  
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const score = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  
  if (score >= 3 && password.length >= 10) {
    return { level: 'strong', color: 'bg-green-500', text: 'Strong' };
  } else if (score >= 2) {
    return { level: 'medium', color: 'bg-yellow-500', text: 'Medium' };
  }
  return { level: 'weak', color: 'bg-red-500', text: 'Weak' };
}

function PasswordInput({ 
  label, 
  value, 
  onChange, 
  placeholder 
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  placeholder: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field pr-10"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [saving, setSaving] = useState(false);
  
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  const passwordStrength = getPasswordStrength(newPassword);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await authApi.updateProfile(fullName);
      updateUser(response.data);
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMessage('Password changed successfully!');
      setMessageType('success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (error: any) {
      setPasswordError(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPassword(false);
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
                  {saving ? 'Saving...' : 'Save Changes'}
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

      {/* Change Password Section */}
      <div className="mt-6 bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-medium text-gray-900">Change Password</h2>
            <svg
              className={`w-5 h-5 text-gray-500 transform transition-transform ${
                showPasswordSection ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {showPasswordSection && (
          <div className="px-6 py-4">
            {passwordError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {passwordError}
              </div>
            )}
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <PasswordInput
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Enter current password"
              />
              
              <div>
                <PasswordInput
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                />
                {newPassword && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                        style={{ 
                          width: passwordStrength.level === 'weak' ? '33%' : 
                                 passwordStrength.level === 'medium' ? '66%' : '100%' 
                        }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      passwordStrength.level === 'weak' ? 'text-red-600' :
                      passwordStrength.level === 'medium' ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 8 characters
                </p>
              </div>
              
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter new password"
              />
              
              <button
                type="submit"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="btn-primary disabled:opacity-50"
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}
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