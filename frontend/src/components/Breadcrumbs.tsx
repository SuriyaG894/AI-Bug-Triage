import { useLocation, Link } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  path: string;
  label: string;
  icon?: React.ReactNode;
}

const routeMap: Record<string, string> = {
  '/': 'Dashboard',
  '/bugs': 'Bugs',
  '/bugs/new': 'New Bug',
  '/bugs/': 'Bug Details',
  '/profile': 'Profile',
  '/admin': 'Admin Panel',
  '/settings': 'Settings',
  '/login': 'Login',
  '/register': 'Register',
  '/forgot-password': 'Forgot Password',
  '/about': 'About',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  
  if (location.pathname === '/') return null;

  const breadcrumbItems: BreadcrumbItem[] = [
    { path: '/', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    let label = routeMap[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    
    // Dynamic routes (e.g., /bugs/42)
    if (index === segments.length - 1 && !routeMap[currentPath]) {
      const parentPath = `/${segments.slice(0, -1).join('/')}`;
      const parentLabel = routeMap[parentPath] || parentPath;
      if (parentLabel === 'Bugs' && !isNaN(Number(segment))) {
        label = `Bug #${segment}`;
      } else if (parentLabel === 'Admin Panel') {
        label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      }
    }
    
    breadcrumbItems.push({ path: currentPath, label });
  });

  return (
    <nav className="flex items-center gap-1 text-sm">
      {breadcrumbItems.map((item, index) => (
        <div key={item.path + index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
          {index === breadcrumbItems.length - 1 ? (
            <span className="text-gray-900 font-medium">
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.label}
            </span>
          ) : (
            <Link
              to={item.path}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              {item.icon && item.icon}
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}