import { useApi } from '../hooks/useApi';
import { Card, Skeleton } from '../components';
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
} from 'recharts';
import { AlertTriangle, Bug, CheckCircle, FileText, TrendingUp } from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

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
  color: string;
  bgColor: string;
}

function StatCard({ title, value, icon, color, bgColor }: StatCardProps) {
  return (
    <Card hoverable>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgColor}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { data: summary, loading: summaryLoading } = useApi<Stats>('/analytics/summary');
  const { data: severityData, loading: severityLoading } = useApi<ChartItem[]>('/analytics/severity-distribution');
  const { data: typeData, loading: typeLoading } = useApi<ChartItem[]>('/analytics/type-distribution');
  const { data: trendsData, loading: trendsLoading } = useApi<ChartItem[]>('/analytics/trends?days=30');

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
            <Card key={i}>
              <Skeleton variant="text" />
              <div className="mt-4">
                <Skeleton variant="title" />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card><Skeleton variant="rect" height="300px" /></Card>
          <Card><Skeleton variant="rect" height="300px" /></Card>
        </div>
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
          icon={<FileText className="w-6 h-6 text-blue-600" />}
          color="text-gray-900"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Open Bugs"
          value={stats.open_bugs}
          icon={<Bug className="w-6 h-6 text-orange-600" />}
          color="text-orange-600"
          bgColor="bg-orange-50"
        />
        <StatCard
          title="Critical"
          value={stats.critical_bugs}
          icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          title="Resolved"
          value={stats.resolved_bugs}
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          color="text-green-600"
          bgColor="bg-green-50"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Severity Distribution</h2>
          </div>
          {severityLoading ? (
            <div className="h-72 flex items-center justify-center">
              <Skeleton variant="rect" width="100%" height="100%" />
            </div>
          ) : pieData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No severity data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index: number) => (
                    <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name] || '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Type Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Bug className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Bug Types</h2>
          </div>
          {typeLoading ? (
            <div className="h-72 flex items-center justify-center">
              <Skeleton variant="rect" width="100%" height="100%" />
            </div>
          ) : barData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No type data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Trends */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Bug Trends (Last 30 Days)</h2>
        </div>
        {trendsLoading ? (
          <div className="h-72 flex items-center justify-center">
            <Skeleton variant="rect" width="100%" height="100%" />
          </div>
        ) : lineData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-gray-500">
            No trend data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}