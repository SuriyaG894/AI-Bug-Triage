import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import {
  User,
  Mail,
  Shield,
  Key,
  LogOut,
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
  Edit2,
  X,
  Fingerprint,
} from 'lucide-react';
import Card from '../components/Card';
import toast from 'react-hot-toast';

function getPasswordStrength(password: string) {
  if (password.length === 0) return { level: '', color: '', text: '', width: '0%' };
  if (password.length < 8) return { level: 'weak', color: 'bg-red-500', text: 'Weak', width: '33%' };

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const score = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  if (score >= 3 && password.length >= 10) {
    return { level: 'strong', color: 'bg-green-500', text: 'Strong', width: '100%' };
  } else if (score >= 2) {
    return { level: 'medium', color: 'bg-yellow-500', text: 'Medium', width: '66%' };
  }
  return { level: 'weak', color: 'bg-red-500', text: 'Weak', width: '33%' };
}

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label className="section-label">{label}</label>
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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const passwordStrength = getPasswordStrength(newPassword);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <User className="size-16 text-text-muted mb-4" />
        <p className="text-text-secondary">Please log in to view your profile.</p>
      </div>
    );
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await authApi.updateProfile(fullName);
      updateUser(response.data);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
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
      toast.success('Password changed successfully');
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

  const initials = user.email.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Profile</h1>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Edit2 className="size-4" />
            Edit Profile
          </button>
        )}
      </div>

      <Card>
        <div className="flex items-start gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-primary-600">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">
              {user.full_name || 'No name set'}
            </h2>
            <p className="text-text-secondary">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}
              >
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
              {user.is_admin && (
                <span className="badge badge-warning">Admin</span>
              )}
            </div>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="section-label">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="section-label">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="input-field bg-surface-secondary text-text-muted cursor-not-allowed"
              />
              <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFullName(user.full_name || '');
                }}
                className="btn-secondary"
              >
                <X className="size-4" />
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="space-y-3">
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <User className="size-4 text-text-muted flex-shrink-0" />
              <dt className="text-sm text-text-secondary w-24">Full Name</dt>
              <dd className="text-text-primary">{user.full_name || 'Not set'}</dd>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <Mail className="size-4 text-text-muted flex-shrink-0" />
              <dt className="text-sm text-text-secondary w-24">Email</dt>
              <dd className="text-text-primary">{user.email}</dd>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-border">
              <Shield className="size-4 text-text-muted flex-shrink-0" />
              <dt className="text-sm text-text-secondary w-24">Role</dt>
              <dd className="text-text-primary">{user.is_admin ? 'Admin' : 'User'}</dd>
            </div>
            <div className="flex items-center gap-3 py-2">
              <Fingerprint className="size-4 text-text-muted flex-shrink-0" />
              <dt className="text-sm text-text-secondary w-24">User ID</dt>
              <dd className="text-text-primary font-mono text-sm">{user.id}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card
        header={
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2 text-text-primary font-medium">
              <Key className="size-4" />
              Change Password
            </span>
            <span className={`transform transition-transform ${showPasswordSection ? 'rotate-180' : ''}`}>
              <svg className="size-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
        }
      >
        {showPasswordSection && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                <AlertCircle className="size-4 flex-shrink-0" />
                {passwordError}
              </div>
            )}

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
                  <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      passwordStrength.level === 'weak'
                        ? 'text-error'
                        : passwordStrength.level === 'medium'
                        ? 'text-warning'
                        : 'text-success'
                    }`}
                  >
                    {passwordStrength.text}
                  </span>
                </div>
              )}
              <p className="text-xs text-text-muted mt-1">Minimum 8 characters</p>
            </div>

            <PasswordInput
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter new password"
            />

            <button
              type="submit"
              className="btn-primary"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Key className="size-4" />
                  Change Password
                </>
              )}
            </button>
          </form>
        )}
      </Card>

      <Card>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-error hover:text-error/80 font-medium transition-colors"
        >
          <LogOut className="size-4" />
          Log Out
        </button>
      </Card>
    </div>
  );
}
