import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings, User, Shield, Bell, Palette, Globe, Save, Loader2, Monitor, Moon, Sun } from 'lucide-react';
import Card from '../components/Card';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [language, setLanguage] = useState('en');

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
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="size-6 text-text-secondary" />
        <h1 className="page-title">Settings</h1>
      </div>

      <Card header={<span className="flex items-center gap-2 font-medium"><User className="size-4" />Profile Settings</span>}>
        <div className="space-y-4">
          <div>
            <label className="section-label">Email</label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="input-field bg-surface-secondary text-text-muted cursor-not-allowed"
            />
            <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="section-label">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="input-field"
              placeholder="Enter your full name"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Card>

      <Card header={<span className="flex items-center gap-2 font-medium"><Shield className="size-4" />Account Info</span>}>
        <dl className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <dt className="text-sm text-text-secondary">Role</dt>
            <dd className="text-sm text-text-primary font-medium">{user?.is_admin ? 'Admin' : 'User'}</dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <dt className="text-sm text-text-secondary">Status</dt>
            <dd className="text-sm text-text-primary font-medium">{user?.is_active ? 'Active' : 'Inactive'}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-sm text-text-secondary">User ID</dt>
            <dd className="text-sm text-text-primary font-mono">{user?.id}</dd>
          </div>
        </dl>
      </Card>

      <Card header={<span className="flex items-center gap-2 font-medium"><Palette className="size-4" />Appearance</span>}>
        <div className="space-y-4">
          <div>
            <label className="section-label">Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    theme === t
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-border text-text-secondary hover:bg-surface-secondary'
                  }`}
                >
                  {t === 'light' && <Sun className="size-4" />}
                  {t === 'dark' && <Moon className="size-4" />}
                  {t === 'system' && <Monitor className="size-4" />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card header={<span className="flex items-center gap-2 font-medium"><Bell className="size-4" />Notifications</span>}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Email Notifications</p>
              <p className="text-xs text-text-muted">Receive updates about bug assignments and status changes</p>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailNotifications ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      <Card header={<span className="flex items-center gap-2 font-medium"><Globe className="size-4" />Language & Region</span>}>
        <div className="space-y-4">
          <div>
            <label className="section-label">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input-field"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </div>
      </Card>
    </div>
  );
}
