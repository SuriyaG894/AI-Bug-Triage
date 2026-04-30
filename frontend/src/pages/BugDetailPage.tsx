import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bugApi, Bug, PushBugResponse } from '../services/api';

export default function BugDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bug, setBug] = useState<Bug | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushBugResponse | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  const handlePushToAzureDevOps = async () => {
    if (!bug) return;
    
    setPushing(true);
    setPushResult(null);
    setShowModal(true);
    
    try {
      const response = await bugApi.pushToExternal(bug.id, 'azure_devops');
      setPushResult(response.data);
    } catch (err: any) {
      setPushResult({
        success: false,
        message: err.response?.data?.detail || 'Failed to push to Azure DevOps'
      });
    } finally {
      setPushing(false);
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

  const closeModal = () => {
    setShowModal(false);
    setPushResult(null);
    if (pushResult?.success) {
      fetchBug(bug!.id);
    }
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
            Bug #{bug.id} - Created {new Date(bug.created_at).toLocaleDateString()}
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

          {bug.repro_steps && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Steps to Reproduce</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{bug.repro_steps}</p>
            </div>
          )}

          {bug.expected_result && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Expected Result</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{bug.expected_result}</p>
            </div>
          )}

          {bug.actual_result && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Actual Result</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{bug.actual_result}</p>
            </div>
          )}

          {bug.duplicate_justification && (
            <div className="card bg-orange-50 border border-orange-200">
              <h2 className="text-lg font-semibold text-orange-800 mb-4">Justification for Duplicate Bug</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{bug.duplicate_justification}</p>
              {bug.duplicate_of_external_ids && bug.duplicate_of_external_ids.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-gray-500 mb-2">Matched ADO Bugs:</p>
                  <div className="flex flex-wrap gap-2">
                    {bug.duplicate_of_external_ids.map((extId, idx) => (
                      <a
                        key={idx}
                        href={`https://dev.azure.com/suriyaganesh894/AiBugTriage/_workitems/edit/${extId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        #{extId}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Analysis - Dynamic from API */}
          {bug.analysis ? (
            <div className="card bg-blue-50 border border-blue-200">
              <h2 className="text-lg font-semibold text-blue-800 mb-4">
                AI Analysis
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Suggested Root Causes:</p>
                  <ul className="list-disc list-inside text-sm text-gray-700 mt-1 space-y-1">
                    {bug.analysis.root_causes?.map((rc, idx) => (
                      <li key={idx}>
                        {rc.cause} 
                        <span className="text-blue-600 ml-1">
                          {((rc.confidence * 100)).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    Analyzed: {new Date(bug.analysis.analyzed_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card bg-gray-50 border border-gray-200">
              <p className="text-sm text-gray-500">No analysis available</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <p className="font-medium capitalize">{bug.priority || 'Not set'}</p>
              </div>
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
              <div>
                <p className="text-sm text-gray-500">Assigned To</p>
                <p className="font-medium">{bug.assigned_to || 'Not assigned'}</p>
              </div>
              {bug.external_id && (
                <div>
                  <p className="text-sm text-gray-500">Azure DevOps ID</p>
                  <a 
                    href={`https://dev.azure.com/suriyaganesh894/AIBugTriage/_workitems/edit/${bug.external_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    #{bug.external_id}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button 
                onClick={handlePushToAzureDevOps}
                disabled={pushing}
                className="w-full btn-primary disabled:opacity-50"
              >
                {pushing ? 'Pushing...' : 'Push to Azure DevOps'}
              </button>
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

      {/* Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            {pushing ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-700">Pushing to Azure DevOps...</p>
              </div>
            ) : pushResult ? (
              <div className="text-center">
                {pushResult.success ? (
                  <>
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-green-800 mb-2">Success!</h3>
                    <p className="text-gray-600 mb-2">{pushResult.message}</p>
                    {pushResult.external_id && (
                      <p className="text-sm text-gray-500 mb-4">Work Item ID: {pushResult.external_id}</p>
                    )}
                    {pushResult.url && (
                      <a 
                        href={pushResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mb-4 text-blue-600 hover:underline"
                      >
                        View in Azure DevOps
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Failed</h3>
                    <p className="text-gray-600 mb-4">{pushResult.message}</p>
                  </>
                )}
                <button 
                  onClick={closeModal}
                  className="btn-primary"
                >
                  Close
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}