import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  User,
  LogOut,
  ChevronDown,
  Shield,
  Sun,
  Moon,
  Monitor,
  ChevronUp,
} from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

interface HeaderProps {
  collapsed: boolean;
}

type Theme = 'light' | 'dark' | 'system';

export default function Header({ collapsed }: HeaderProps) {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    return stored || 'light';
  });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase();

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <header className={`fixed top-0 right-0 z-20 h-16 bg-white border-b border-gray-200 shadow-sm flex items-center justify-end px-4 lg:px-6 transition-all duration-300 ${collapsed ? 'lg:left-16' : 'lg:left-60'}`}>
      <div className="flex items-center gap-2">
        {/* Theme switcher */}
        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            className="btn-icon relative"
            title="Appearance"
          >
            <ThemeIcon className="w-5 h-5" />
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-card border border-gray-200 py-2 animate-fade-in">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Appearance</p>
              </div>
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setTheme(opt.value); setThemeMenuOpen(false); }}
                  className={`flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors ${
                    theme === opt.value
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        {user && <NotificationDropdown />}

        {/* User menu */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                {initials}
              </div>
              <span className="hidden md:block text-sm text-gray-700 max-w-32 truncate">
                {user.full_name || user.email}
              </span>
              {userMenuOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400 transition-transform" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 transition-transform" />
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-card border border-gray-200 py-2 animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                  {user.is_admin && (
                    <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  )}
                </div>

                <div className="py-1">
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                  {user.is_admin && (
                    <Link
                      to="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Shield className="w-4 h-4" />
                      Admin Panel
                    </Link>
                  )}
                </div>

                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
