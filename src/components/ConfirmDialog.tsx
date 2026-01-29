interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmButtonStyles =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 disabled:bg-red-300'
      : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300';

  const buttonLabel = loading && confirmVariant === 'danger' ? 'Deleting...' : confirmLabel;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium disabled:text-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:cursor-not-allowed ${confirmButtonStyles}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
