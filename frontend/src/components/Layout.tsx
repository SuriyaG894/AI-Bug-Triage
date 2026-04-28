import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/bugs', label: 'Bugs' },
  { path: '/bugs/new', label: 'New Bug' },
  { path: '/settings', label: 'Settings' },
  { path: '/profile', label: 'Profile' },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-gray-900">
                AI Bug Triage
              </Link>
            </div>
            <nav className="flex items-center space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    location.pathname === item.path
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {user ? (
                <div className="flex items-center space-x-3 ml-4 border-l pl-4">
                  <Link
                    to="/profile"
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {user.email}
                  </Link>
                  <button
                    onClick={logout}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 ml-4 border-l pl-4">
                  <Link
                    to="/login"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Register
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
