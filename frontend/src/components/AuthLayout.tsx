import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  altLink?: {
    text: string;
    linkText: string;
    to: string;
  };
}

export default function AuthLayout({ title, children, altLink }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50/30 dark:from-gray-950 dark:to-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center">
          <h1 className="flex items-center justify-center">
            <Logo showText={true} className="h-16 w-auto" />
            <span className="sr-only">AI Bug Triage</span>
          </h1>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow-card sm:rounded-xl sm:px-10 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600" />

          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>

          {altLink && (
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              {altLink.text}{' '}
              <Link to={altLink.to} className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
                {altLink.linkText}
              </Link>
            </p>
          )}

          <div className="mt-6">
            {children}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          &copy; {new Date().getFullYear()} Bug Triage. v1.0.0
        </p>
      </div>
    </div>
  );
}
