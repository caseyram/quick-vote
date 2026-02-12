interface SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all
              ${isActive
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
              }
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
