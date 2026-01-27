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
}

export function BarChart({ data, totalVotes }: BarChartProps) {
  return (
    <div>
      <div
        className="flex items-end justify-center gap-6"
        style={{ height: 300 }}
      >
        {data.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center h-full"
            style={{ flex: '1 1 0', minWidth: 0, maxWidth: 120 }}
          >
            <div className="text-sm font-medium text-white mb-1 whitespace-nowrap">
              {item.count} ({item.percentage}%)
            </div>
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-lg"
                style={{
                  height: `${item.percentage}%`,
                  backgroundColor: item.color,
                  transition: 'height 0.5s ease-out',
                  minHeight: item.count > 0 ? '4px' : '0px',
                }}
              />
            </div>
            <div className="text-sm text-gray-300 text-center mt-2 truncate w-full">
              {item.label}
            </div>
          </div>
        ))}
      </div>
      {totalVotes !== undefined && (
        <div className="text-xs text-gray-500 text-center mt-3">
          Total: {totalVotes} votes
        </div>
      )}
    </div>
  );
}
