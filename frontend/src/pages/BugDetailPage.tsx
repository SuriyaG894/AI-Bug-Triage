import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bugApi, Bug, PushBugResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, Modal, Skeleton } from '../components';
import { ArrowLeft, ExternalLink, Loader2, CheckCircle, XCircle, Brain, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

export default function BugDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bug, setBug] = useState<Bug | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushBugResponse | null>(null);
  const [showPushModal, setShowPushModal] = useState(false);

  const renderFormattedContent = (content: string | undefined | null) => {
    if (!content) return null;
    const isHtml = /<[a-zA-Z]+[^>]*>/.test(content);
    if (isHtml) {
      const cleanHtml = DOMPurify.sanitize(content);
      return (
        <div 
          className="rich-content text-gray-700"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
    }
    return <p className="text-gray-700 whitespace-pre-wrap">{content}</p>;
  };

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
    
    try {
      const response = await bugApi.pushToExternal(bug.id, 'azure_devops');
      setPushResult(response.data);
      if (response.data.success) {
        toast.success('Pushed to Azure DevOps');
        fetchBug(bug.id);
      } else {
        toast.error(response.data.message);
      }
    } catch (err: any) {
      setPushResult({
        success: false,
        message: err.response?.data?.detail || 'Failed to push to Azure DevOps'
      });
      toast.error('Failed to push to Azure DevOps');
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="title" width="w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><Skeleton variant="text" lines={3} /></Card>
            <Card><Skeleton variant="text" lines={2} /></Card>
          </div>
          <div className="space-y-6">
            <Card><Skeleton variant="text" lines={5} /></Card>
            <Card><Skeleton variant="rect" height="120px" /></Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !bug) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Bug not found'}</p>
        <button onClick={() => navigate('/bugs')} className="btn-secondary">
          Back to Bugs
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/bugs')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Bugs
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{bug.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bug #{bug.id} · Created {new Date(bug.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={bug.severity} variant="severity" color={bug.severity as 'critical' | 'high' | 'medium' | 'low'} />
          <Badge label={bug.status.replace('_', ' ')} variant="status" color={bug.status as 'open' | 'in_progress' | 'resolved' | 'closed'} />
          <Badge label={bug.type} />
          <Badge label={bug.source} variant="source" color={bug.source === 'internal' ? 'internal' : 'external'} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Description</h2>
            {renderFormattedContent(bug.description)}
          </Card>

          {bug.repro_steps && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Steps to Reproduce</h2>
              {renderFormattedContent(bug.repro_steps)}
            </Card>
          )}

          {bug.expected_result && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Expected Result</h2>
              {renderFormattedContent(bug.expected_result)}
            </Card>
          )}

          {bug.actual_result && (
            <Card>
              <h2 className="text-lg font-semibold mb-4">Actual Result</h2>
              {renderFormattedContent(bug.actual_result)}
            </Card>
          )}

          {bug.duplicate_justification && (
            <Card className="bg-orange-50 border-orange-200">
              <h2 className="text-lg font-semibold text-orange-800 mb-4">Duplicate Justification</h2>
              {renderFormattedContent(bug.duplicate_justification)}
              {bug.duplicate_of_external_ids && bug.duplicate_of_external_ids.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Matched ADO Bugs:</p>
                  <div className="flex flex-wrap gap-2">
                    {bug.duplicate_of_external_ids.map((extId, idx) => (
                      <a
                        key={idx}
                        href={`https://dev.azure.com/suriyaganesh894/AiBugTriage/_workitems/edit/${extId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        #{extId}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* AI Analysis */}
          {bug.analysis ? (
            <Card className="bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-blue-800">AI Analysis</h2>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Suggested Root Causes:</p>
                <ul className="space-y-2">
                  {bug.analysis.root_causes?.map((rc, idx) => (
                    <li key={idx} className="flex items-start justify-between text-sm">
                      <span className="text-gray-700">{rc.cause}</span>
                      <span className="text-blue-600 font-medium ml-4">{(rc.confidence * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-4">
                  Analyzed: {new Date(bug.analysis.analyzed_at).toLocaleString()}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="bg-gray-50">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-gray-400" />
                <p className="text-sm text-gray-500">No AI analysis available</p>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Details</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500">Priority</dt>
                <dd className="font-medium capitalize mt-0.5">{bug.priority || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Severity</dt>
                <dd className="font-medium capitalize mt-0.5">{bug.severity}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="font-medium capitalize mt-0.5">{bug.type}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="font-medium capitalize mt-0.5">{bug.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Source</dt>
                <dd className="font-medium capitalize mt-0.5">{bug.source}</dd>
              </div>
              {bug.created_by && (
                <div>
                  <dt className="text-sm text-gray-500">Reported By</dt>
                  <dd className="font-medium mt-0.5">{bug.created_by}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Assigned To</dt>
                <dd className="font-medium mt-0.5">{bug.assigned_to || 'Not assigned'}</dd>
              </div>
              {bug.external_id && (
                <div>
                  <dt className="text-sm text-gray-500">Azure DevOps ID</dt>
                  <dd className="mt-0.5">
                    <a 
                      href={`https://dev.azure.com/suriyaganesh894/AIBugTriage/_workitems/edit/${bug.external_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                    >
                      #{bug.external_id}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              {user && (user.is_admin || bug.created_by === user?.email) && (
                <button
                  onClick={() => navigate(`/bugs/${bug.id}/edit`)}
                  className="w-full btn-secondary"
                >
                  <Pencil className="w-4 h-4 mr-2 inline" />
                  Edit Bug
                </button>
              )}
              <button 
                onClick={() => setShowPushModal(true)}
                disabled={pushing}
                className="w-full btn-primary disabled:opacity-50"
              >
                Push to Azure DevOps
              </button>
              <button className="w-full btn-secondary" disabled>
                Push to JIRA
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Push Modal */}
      <Modal
        isOpen={showPushModal}
        onClose={() => setShowPushModal(false)}
        title="Push to Azure DevOps"
        size="sm"
      >
        {pushing ? (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700">Pushing to Azure DevOps...</p>
          </div>
        ) : pushResult ? (
          <div className="text-center py-4">
            {pushResult.success ? (
              <>
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
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
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline mb-4"
                  >
                    View in Azure DevOps
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-800 mb-2">Failed</h3>
                <p className="text-gray-600 mb-4">{pushResult.message}</p>
              </>
            )}
            <button onClick={() => setShowPushModal(false)} className="btn-primary">
              Close
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to push this bug to Azure DevOps?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPushModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handlePushToAzureDevOps} className="btn-primary">
                Push
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}