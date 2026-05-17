import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, Skeleton, EmptyState } from '../components';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  LabelList,
} from 'recharts';
import { AlertTriangle, Bug, CheckCircle, FileText, TrendingUp, Inbox } from 'lucide-react';
import { getChartColors, isDarkMode, SEVERITY_COLORS, CHART_MARGIN } from '../theme/charts';
import ChartTooltip from '../components/ChartTooltip';

interface Stats {
  total_bugs: number;
  open_bugs: number;
  critical_bugs: number;
  resolved_bugs: number;
}

interface ChartItem {
  severity?: string;
  type?: string;
  date?: string;
  count: number;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  bgColor: string;
}

function StatCard({ title, value, icon, bgColor }: StatCardProps) {
  return (
    <div
      className={`${bgColor} rounded-xl border border-gray-200 shadow-card p-6 hover:scale-[1.02] transition-transform`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{title}</p>
          <p className="text-3xl font-bold mt-1 text-white">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10">
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function HomePage() {
  const { data: summary, loading: summaryLoading } = useApi<Stats>('/analytics/summary');
  const { data: severityData, loading: severityLoading } = useApi<ChartItem[]>('/analytics/severity-distribution');
  const { data: typeData, loading: typeLoading } = useApi<ChartItem[]>('/analytics/type-distribution');
  const { data: trendsData, loading: trendsLoading } = useApi<ChartItem[]>('/analytics/trends?days=30');

  const [dark, setDark] = useState(() => isDarkMode());

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const colors = getChartColors(dark);

  const stats = summary || { total_bugs: 0, open_bugs: 0, critical_bugs: 0, resolved_bugs: 0 };
  const pieData = (severityData || []).map((item) => ({
    name: item.severity || '',
    value: item.count,
  }));

  const barData = (typeData || []).map((item) => ({
    type: item.type || '',
    count: item.count,
  }));

  const lineData = (trendsData || []).map((item) => ({
    date: item.date || '',
    count: item.count,
  }));

  if (summaryLoading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="title" width="w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 shadow-card p-6">
              <Skeleton variant="text" />
              <div className="mt-4">
                <Skeleton variant="title" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="skeleton h-[300px] w-full rounded animate-pulse" />
          </Card>
          <Card>
            <div className="skeleton h-[300px] w-full rounded animate-pulse" />
          </Card>
        </div>
        <Card>
          <div className="skeleton h-[300px] w-full rounded animate-pulse" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Bugs"
          value={stats.total_bugs}
          icon={<FileText className="w-6 h-6 text-white" />}
          bgColor="bg-blue-600"
        />
        <StatCard
          title="Open Bugs"
          value={stats.open_bugs}
          icon={<Bug className="w-6 h-6 text-white" />}
          bgColor="bg-orange-600"
        />
        <StatCard
          title="Critical"
          value={stats.critical_bugs}
          icon={<AlertTriangle className="w-6 h-6 text-white" />}
          bgColor="bg-red-600"
        />
        <StatCard
          title="Resolved"
          value={stats.resolved_bugs}
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          bgColor="bg-green-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: colors.axisText }} />
            <h2 className="text-lg font-semibold" style={{ color: dark ? '#f3f4f6' : '#111827' }}>
              Severity Distribution
            </h2>
          </div>
          {severityLoading ? (
            <div className="skeleton h-[300px] w-full rounded animate-pulse" />
          ) : pieData.length === 0 ? (
            <div className="h-[300px]">
              <EmptyState icon={Inbox} title="No severity data" description="Severity distribution will appear here once data is available." />
            </div>
          ) : (
            <div role="img" aria-label="Severity distribution donut chart">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={CHART_MARGIN}>
                <defs>
                  {pieData.map((entry, index) => (
                    <linearGradient
                      key={`severity-grad-${index}`}
                      id={`severityGrad-${index}`}
                      x1="0" y1="0" x2="1" y2="1"
                    >
                      <stop offset="0%" stopColor={SEVERITY_COLORS[entry.name] || '#8884d8'} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={SEVERITY_COLORS[entry.name] || '#8884d8'} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                >
                  {pieData.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#severityGrad-${index})`}
                      stroke={colors.pie.stroke}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value: string) => (
                    <span style={{ color: colors.legend, fontSize: 13 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Type Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Bug className="w-5 h-5" style={{ color: colors.axisText }} />
            <h2 className="text-lg font-semibold" style={{ color: dark ? '#f3f4f6' : '#111827' }}>
              Bug Types
            </h2>
          </div>
          {typeLoading ? (
            <div className="skeleton h-[300px] w-full rounded animate-pulse" />
          ) : barData.length === 0 ? (
            <div className="h-[300px]">
              <EmptyState icon={Inbox} title="No type data" description="Bug type distribution will appear here once data is available." />
            </div>
          ) : (
            <div role="img" aria-label="Bug types bar chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={CHART_MARGIN} barCategoryGap="20%">
                <defs>
                  <linearGradient
                    id={colors.bar.gradient.id}
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor={colors.bar.gradient.start} stopOpacity={1} />
                    <stop offset="100%" stopColor={colors.bar.gradient.end} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="type"
                  tick={{ fill: colors.axisText, fontSize: 12 }}
                  stroke={colors.axisLine}
                />
                <YAxis
                  tick={{ fill: colors.axisText, fontSize: 12 }}
                  stroke={colors.axisLine}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="count"
                  fill={`url(#${colors.bar.gradient.id})`}
                  radius={[8, 8, 0, 0]}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    fill={colors.axisText}
                    fontSize={12}
                    offset={4}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Trends */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" style={{ color: colors.axisText }} />
          <h2 className="text-lg font-semibold" style={{ color: dark ? '#f3f4f6' : '#111827' }}>
            Bug Trends (Last 30 Days)
          </h2>
        </div>
        {trendsLoading ? (
          <div className="skeleton h-[300px] w-full rounded animate-pulse" />
        ) : lineData.length === 0 ? (
          <div className="h-[300px]">
            <EmptyState icon={Inbox} title="No trend data" description="Bug trends will appear here once data is available." />
          </div>
        ) : (
          <div role="img" aria-label="Bug trends line chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient
                  id={colors.line.areaGradient.id}
                  x1="0" y1="0" x2="0" y2="1"
                >
                  <stop offset="0%" stopColor={colors.line.areaGradient.start} stopOpacity={1} />
                  <stop offset="100%" stopColor={colors.line.areaGradient.end} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.axisText, fontSize: 12 }}
                stroke={colors.axisLine}
                tickFormatter={formatDate}
              />
              <YAxis
                tick={{ fill: colors.axisText, fontSize: 12 }}
                stroke={colors.axisLine}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                formatter={(value: string) => (
                  <span style={{ color: colors.legend, fontSize: 13 }}>{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="count"
                fill={`url(#${colors.line.areaGradient.id})`}
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={colors.line.stroke}
                strokeWidth={2}
                dot={{
                  r: 3,
                  strokeWidth: 2,
                  stroke: colors.line.dotStroke,
                  fill: colors.line.dotFill,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
