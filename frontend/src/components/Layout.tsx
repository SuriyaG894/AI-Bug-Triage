import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumbs from './Breadcrumbs';
import { Toaster } from 'react-hot-toast';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <Header collapsed={collapsed} />
      <main className={`transition-all duration-300 pt-16 ${collapsed ? 'lg:ml-16' : 'lg:ml-60'}`}>
        <div className="px-4 lg:px-8 py-6">
          <Breadcrumbs />
          <div className="mt-4 page-transition">
            {children}
          </div>
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}