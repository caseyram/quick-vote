export const AGREE_DISAGREE_COLORS = {
  agree: '#3B82F6',
  disagree: '#F97316',
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
}

export function BarChart({ data, totalVotes, size = 'default' }: BarChartProps) {
  const isLarge = size === 'large';

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
            <div className={`${isLarge ? 'text-lg font-bold text-white' : 'text-sm font-medium text-white'} mb-1 whitespace-nowrap`}>
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
            <div className={`${isLarge ? 'text-base font-medium text-gray-200' : 'text-sm text-gray-300'} text-center mt-2 truncate w-full`}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
      {totalVotes !== undefined && (
        <div className={`${isLarge ? 'text-sm text-gray-400' : 'text-xs text-gray-500'} text-center mt-3`}>
          Total: {totalVotes} votes
        </div>
      )}
    </div>
  );
}
