import { useApi } from '../hooks/useApi';
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

export default function HomePage() {
  const { data: summary, loading: summaryLoading } = useApi<Stats>('/analytics/summary');
  const { data: severityData } = useApi<ChartItem[]>('/analytics/severity-distribution');
  const { data: typeData } = useApi<ChartItem[]>('/analytics/type-distribution');
  const { data: trendsData } = useApi<ChartItem[]>('/analytics/trends?days=30');

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Bugs</p>
          <p className="text-3xl font-bold text-gray-900">{stats.total_bugs || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Open Bugs</p>
          <p className="text-3xl font-bold text-orange-600">{stats.open_bugs || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Critical</p>
          <p className="text-3xl font-bold text-red-600">{stats.critical_bugs || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Resolved</p>
          <p className="text-3xl font-bold text-green-600">{stats.resolved_bugs || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Severity Distribution</h2>
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
        </div>

        {/* Type Distribution */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Bug Types</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trends */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Bug Trends (Last 30 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
