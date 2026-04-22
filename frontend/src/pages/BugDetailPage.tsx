import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bugApi, Bug } from '../services/api';

export default function BugDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bug, setBug] = useState<Bug | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchBug(parseInt(id));
    }
  }, [id]);

  const fetchBug = async (bugId: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await bugApi.get(bugId);
      setBug(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load bug');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityClass = (severity: string) => {
    const classes: Record<string, string> = {
      critical: 'severity-critical',
      high: 'severity-high',
      medium: 'severity-medium',
      low: 'severity-low',
    };
    return classes[severity] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button onClick={() => navigate('/bugs')} className="btn-secondary mt-4">
          Back to Bugs
        </button>
      </div>
    );
  }

  if (!bug) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Bug not found</p>
        <button onClick={() => navigate('/bugs')} className="btn-secondary mt-4">
          Back to Bugs
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{bug.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bug #{bug.id} • Created {new Date(bug.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`severity-badge ${getSeverityClass(bug.severity)}`}>
            {bug.severity}
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
            {bug.type}
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
            {bug.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{bug.description}</p>
          </div>

          {/* AI Analysis (placeholder) */}
          <div className="card bg-blue-50 border border-blue-200">
            <h2 className="text-lg font-semibold text-blue-800 mb-4">
              AI Analysis
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Suggested Root Causes:</p>
                <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                  <li>Null reference handling</li>
                  <li>Missing input validation</li>
                  <li>API timeout</li>
                </ul>
              </div>
              <div>
                <p className="text-sm text-gray-500">Confidence: 85%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Severity</p>
                <p className="font-medium capitalize">{bug.severity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium capitalize">{bug.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium capitalize">{bug.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Source</p>
                <p className="font-medium capitalize">{bug.source}</p>
              </div>
              {bug.created_by && (
                <div>
                  <p className="text-sm text-gray-500">Reported By</p>
                  <p className="font-medium">{bug.created_by}</p>
                </div>
              )}
              {bug.external_id && (
                <div>
                  <p className="text-sm text-gray-500">External ID</p>
                  <p className="font-medium">{bug.external_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button className="w-full btn-primary">Push to Azure DevOps</button>
              <button className="w-full btn-secondary">Push to JIRA</button>
              <button
                onClick={() => navigate('/bugs')}
                className="w-full btn-secondary"
              >
                Back to List
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
