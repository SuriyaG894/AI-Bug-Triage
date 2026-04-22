import { ReactNode } from 'react';

interface NavbarProps {
  title?: string;
  children?: ReactNode;
}

export default function Navbar({ title, children }: NavbarProps) {
  return (
    <div className="bg-white shadow">
      <div className="px-4 py-5 sm:p-6">
        {title && (
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}
