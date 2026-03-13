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
    ? `text-base font-semibold leading-tight ${isLight ? 'text-gray-600' : 'text-white/80'}`
    : `text-sm ${isLight ? 'text-gray-600' : 'text-white/70'}`;

  const totalClass = isLarge
    ? `text-base ${isLight ? 'text-gray-500' : 'text-white/60'}`
    : `text-xs ${isLight ? 'text-gray-500' : 'text-white/60'}`;

  const heightStyle: React.CSSProperties = isFill
    ? { height: '100%' }
    : { height: isLarge ? 400 : 300 };

  // For presentation (large/fill): always fit within viewport — equal columns, no scroll
  // For default (admin): allow scroll on narrow screens
  const minColPx = isLarge ? 0 : 72;
  const colTemplate = data.length > 0
    ? isLarge
      ? `repeat(${data.length}, 1fr)`
      : `repeat(${data.length}, minmax(${minColPx}px, 120px))`
    : 'none';

  return (
    <div className={isFill ? 'h-full flex flex-col' : ''}>
      {/* Scroll wrapper — only scrolls in non-large (admin) mode */}
      <div className={`${isFill ? 'flex-1 min-h-0 ' : ''}${isLarge ? '' : 'overflow-x-auto'}`}>
      <div
        className={`grid justify-center ${isLarge ? 'w-full' : 'min-w-max'} ${isFill ? 'h-full' : ''}`}
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: 'auto 1fr auto',
          gap: `0 ${isLarge ? '0.75rem' : '1rem'}`,
          ...(isFill ? undefined : heightStyle),
        }}
      >
        {/* Row 1: counts */}
        {data.map((item) => (
          <div key={`count-${item.label}`} className={`${countClass} text-center whitespace-nowrap mb-1`}>
            {item.count} ({item.percentage}%)
          </div>
        ))}
        {/* Row 2: bars */}
        {data.map((item) => (
          <div key={`bar-${item.label}`} className="flex items-end">
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
        ))}
        {/* Row 3: labels (grid row auto-sizes to tallest label) */}
        {data.map((item) => (
          <div key={`label-${item.label}`} className={`${labelClass} text-center mt-2 break-words`}>
            {item.label}
          </div>
        ))}
      </div>
      </div>{/* end scroll wrapper */}
      {totalVotes !== undefined && (
        <div className={`${totalClass} text-center mt-3 shrink-0`}>
          {totalVotes} {totalVotes === 1 ? 'response' : 'responses'}
        </div>
      )}
    </div>
  );
}
