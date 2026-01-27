export const AGREE_DISAGREE_COLORS = {
  agree: '#3B82F6',
  disagree: '#F97316',
  sometimes: '#8B5CF6',
} as const;

export const MULTI_CHOICE_COLORS = [
  '#6366F1',
  '#EC4899',
  '#14B8A6',
  '#F59E0B',
  '#8B5CF6',
  '#EF4444',
  '#10B981',
  '#F472B6',
] as const;

interface BarChartData {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface BarChartProps {
  data: BarChartData[];
  totalVotes?: number;
  size?: 'default' | 'large';
  theme?: 'dark' | 'light';
}

export function BarChart({ data, totalVotes, size = 'default', theme = 'dark' }: BarChartProps) {
  const isLarge = size === 'large';
  const isLight = theme === 'light';

  const countClass = isLarge
    ? `text-lg font-bold ${isLight ? 'text-gray-800' : 'text-white'}`
    : `text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`;

  const labelClass = isLarge
    ? `text-base font-medium ${isLight ? 'text-gray-600' : 'text-gray-200'}`
    : `text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`;

  const totalClass = isLarge
    ? `text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`
    : `text-xs ${isLight ? 'text-gray-500' : 'text-gray-500'}`;

  return (
    <div>
      <div
        className={`flex items-end justify-center ${isLarge ? 'gap-8' : 'gap-6'}`}
        style={{ height: isLarge ? 400 : 300 }}
      >
        {data.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center h-full"
            style={{ flex: '1 1 0', minWidth: 0, maxWidth: isLarge ? 160 : 120 }}
          >
            <div className={`${countClass} mb-1 whitespace-nowrap`}>
              {item.count} ({item.percentage}%)
            </div>
            <div className="w-full flex-1 flex items-end">
              <div
                className={`w-full ${isLarge ? 'rounded-t-xl' : 'rounded-t-lg'}`}
                style={{
                  height: `${item.percentage}%`,
                  backgroundColor: item.color,
                  transition: 'height 0.5s ease-out',
                  minHeight: item.count > 0 ? '4px' : '0px',
                }}
              />
            </div>
            <div className={`${labelClass} text-center mt-2 truncate w-full`}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
      {totalVotes !== undefined && (
        <div className={`${totalClass} text-center mt-3`}>
          Total: {totalVotes} votes
        </div>
      )}
    </div>
  );
}
