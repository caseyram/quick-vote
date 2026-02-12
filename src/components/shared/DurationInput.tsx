interface DurationInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  placeholder?: string;
}

export function DurationInput({ value, onChange, label, placeholder }: DurationInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || val === '0') {
      onChange(null);
    } else {
      const num = parseInt(val);
      if (!isNaN(num) && num > 0) {
        onChange(num);
      }
    }
  };

  // Human-readable conversion
  const getHumanReadable = () => {
    if (!value || value <= 0) return null;

    const minutes = Math.floor(value / 60);
    const seconds = value % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    } else if (seconds === 0) {
      return `${minutes}m`;
    } else {
      return `${minutes}m ${seconds}s`;
    }
  };

  const humanReadable = getHumanReadable();

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type="number"
        min="0"
        step="1"
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder || 'No timer'}
        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm"
      />
      {humanReadable && (
        <p className="text-xs text-gray-500 mt-1">= {humanReadable}</p>
      )}
    </div>
  );
}
