import type { ResponseTemplate } from '../types/database';

interface TemplateSelectorProps {
  value: string | null;           // Currently selected template ID (null = custom)
  onChange: (templateId: string | null) => void;
  templates: ResponseTemplate[];
  disabled?: boolean;             // Disabled when question has votes
  disabledReason?: string;        // Tooltip/message explaining why disabled
}

export function TemplateSelector({
  value,
  onChange,
  templates,
  disabled = false,
  disabledReason,
}: TemplateSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChange(val === '' ? null : val);
  };

  return (
    <div className="space-y-1">
      <label htmlFor="template-selector" className="block text-sm font-medium text-gray-700">
        Response Template
      </label>
      <select
        id="template-selector"
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">None (custom options)</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {disabled && disabledReason && (
        <p className="text-xs text-gray-500">{disabledReason}</p>
      )}
    </div>
  );
}
