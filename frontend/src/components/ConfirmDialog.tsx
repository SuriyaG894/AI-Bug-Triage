import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    default: 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
  };

  const iconColors = {
    danger: 'text-red-600 bg-red-100',
    warning: 'text-amber-600 bg-amber-100',
    default: 'text-primary-600 bg-primary-100',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColors[variant]}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-700">{message}</p>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary" disabled={loading}>
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`btn-primary ${variantClasses[variant]}`}
          disabled={loading}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}