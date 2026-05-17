import { TooltipProps } from 'recharts';
import { getChartColors, isDarkMode, SEVERITY_COLORS } from '../theme/charts';

export default function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const colors = getChartColors(isDarkMode());
  const hasLabel = label && label !== '';

  return (
    <div
      className="rounded-lg border shadow-lg p-3 text-sm"
      style={{
        backgroundColor: colors.tooltip.bg,
        borderColor: colors.tooltip.border,
      }}
    >
      {hasLabel && (
        <p className="font-medium mb-1.5 text-xs uppercase tracking-wider" style={{ color: colors.tooltip.label }}>
          {label}
        </p>
      )}
      {payload.map((entry, index) => {
        const severityColor = entry.payload?.severity ? SEVERITY_COLORS[entry.payload.severity] : undefined;
        const dotColor = entry.color || severityColor || colors.tooltip.text;

        return (
          <div key={index} className="flex items-center gap-2 py-0.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            <span style={{ color: colors.tooltip.text }}>
              <span className="font-medium">{entry.name}: </span>
              <span className="font-semibold">{entry.value}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
