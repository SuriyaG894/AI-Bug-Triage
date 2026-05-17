export interface ChartColors {
  grid: string;
  axisText: string;
  axisLine: string;
  tooltip: {
    bg: string;
    border: string;
    text: string;
    label: string;
  };
  legend: string;
  bar: {
    gradient: { start: string; end: string; id: string };
  };
  line: {
    stroke: string;
    dotStroke: string;
    dotFill: string;
    areaGradient: { start: string; end: string; id: string };
  };
  pie: {
    stroke: string;
  };
}

export const LIGHT: ChartColors = {
  grid: '#e5e7eb',
  axisText: '#6b7280',
  axisLine: '#d1d5db',
  tooltip: {
    bg: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    label: '#6b7280',
  },
  legend: '#4b5563',
  bar: {
    gradient: { start: '#60a5fa', end: '#2563eb', id: 'barGradient-light' },
  },
  line: {
    stroke: '#3b82f6',
    dotStroke: '#3b82f6',
    dotFill: '#ffffff',
    areaGradient: { start: 'rgba(59,130,246,0.25)', end: 'rgba(59,130,246,0)', id: 'areaGradient-light' },
  },
  pie: {
    stroke: '#ffffff',
  },
};

export const DARK: ChartColors = {
  grid: '#374151',
  axisText: '#9ca3af',
  axisLine: '#4b5563',
  tooltip: {
    bg: '#1f2937',
    border: '#374151',
    text: '#f3f4f6',
    label: '#9ca3af',
  },
  legend: '#9ca3af',
  bar: {
    gradient: { start: '#93c5fd', end: '#3b82f6', id: 'barGradient-dark' },
  },
  line: {
    stroke: '#60a5fa',
    dotStroke: '#60a5fa',
    dotFill: '#1f2937',
    areaGradient: { start: 'rgba(96,165,250,0.25)', end: 'rgba(96,165,250,0)', id: 'areaGradient-dark' },
  },
  pie: {
    stroke: '#1f2937',
  },
};

export function getChartColors(dark: boolean): ChartColors {
  return dark ? DARK : LIGHT;
}

export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

export const CHART_MARGIN = { top: 20, right: 30, left: 20, bottom: 5 };
