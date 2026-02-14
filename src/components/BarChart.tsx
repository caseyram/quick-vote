import { getTextColor } from '../lib/color-contrast';

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
  size?: 'default' | 'large' | 'fill';
  theme?: 'dark' | 'light';
  /** When provided, text colors are computed from this background for proper contrast */
  backgroundColor?: string;
}

export function BarChart({ data, totalVotes, size = 'default', theme = 'dark', backgroundColor }: BarChartProps) {
  const isLarge = size === 'large' || size === 'fill';
  const isFill = size === 'fill';

  // When backgroundColor is provided, compute text colors from it; otherwise use theme
  const isLight = backgroundColor ? getTextColor(backgroundColor) === 'dark' : theme === 'light';

  const countClass = isLarge
    ? `text-xl font-bold ${isLight ? 'text-gray-800' : 'text-white'}`
    : `text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`;

  const labelClass = isLarge
    ? `text-lg font-semibold ${isLight ? 'text-gray-600' : 'text-white/80'}`
    : `text-sm ${isLight ? 'text-gray-600' : 'text-white/70'}`;

  const totalClass = isLarge
    ? `text-base ${isLight ? 'text-gray-500' : 'text-white/60'}`
    : `text-xs ${isLight ? 'text-gray-500' : 'text-white/60'}`;

  const heightStyle: React.CSSProperties = isFill
    ? { height: '100%' }
    : { height: isLarge ? 400 : 300 };

  return (
    <div className={isFill ? 'h-full flex flex-col' : ''}>
      <div
        className={`flex items-end justify-center ${isLarge ? 'gap-8' : 'gap-6'} ${isFill ? 'flex-1 min-h-0' : ''}`}
        style={isFill ? undefined : heightStyle}
      >
        {data.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center h-full"
            style={{ flex: '1 1 0', minWidth: 0, maxWidth: isLarge ? 200 : 120 }}
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
            <div className={`${labelClass} text-center mt-2 w-full break-words`}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
      {totalVotes !== undefined && (
        <div className={`${totalClass} text-center mt-3 shrink-0`}>
          Total: {totalVotes} votes
        </div>
      )}
    </div>
  );
}
