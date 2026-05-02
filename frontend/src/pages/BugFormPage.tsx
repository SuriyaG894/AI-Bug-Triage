import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { bugApi, DuplicateCheckResponse, BugSuggestion, uploadApi, projectApi, Project } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, Modal } from '../components';
import { ArrowLeft, Loader2, Brain, AlertTriangle, Paperclip, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface BugFormInputs {
  title: string;
  description: string;
  repro_steps: string;
  expected_result: string;
  actual_result: string;
  priority: string;
  severity: string;
  created_by: string;
  pushToAzure: boolean;
  assigned_to: string;
}

interface Attachment {
  name: string;
  url: string;
}

export default function BugFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [gettingSuggestion, setGettingSuggestion] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResponse | null>(null);
  const [suggestion, setSuggestion] = useState<BugSuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [justification, setJustification] = useState('');
  const [pendingDuplicateBug, setPendingDuplicateBug] = useState<DuplicateCheckResponse | null>(null);
  const [formData, setFormData] = useState<BugFormInputs | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    projectApi.myProjects().then(res => {
      setProjects(res.data);
      if (res.data.length === 1) {
        setSelectedProjectId(res.data[0].id);
      }
    }).catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BugFormInputs>({
    defaultValues: {
      priority: 'medium',
      severity: 'medium',
      pushToAzure: false,
      assigned_to: '',
      expected_result: '',
      actual_result: '',
    }
  });

  useEffect(() => {
    if (user?.email) {
      setValue('created_by', user.email);
    }
  }, [user, setValue]);

  const title = watch('title', '');
  const description = watch('description', '');
  const reproSteps = watch('repro_steps', '');

  const fetchSuggestion = useCallback(async () => {
    if (!title || title.length < 5 || !description || description.length < 20 || !reproSteps || reproSteps.length < 20) {
      return;
    }
    
    setGettingSuggestion(true);
    try {
      const response = await bugApi.suggest(title, description, reproSteps);
      setSuggestion(response.data);
      setShowSuggestion(true);
    } catch (error) {
      console.error('Error getting suggestion:', error);
    } finally {
      setGettingSuggestion(false);
    }
  }, [title, description, reproSteps]);

  const checkDuplicate = async () => {
    if (!description || description.length < 10) return;
    
    setCheckingDuplicate(true);
    try {
      const response = await bugApi.checkDuplicate(title, description);
      setDuplicateResult(response.data);
    } catch (error) {
      console.error('Error checking duplicates:', error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion) {
      setValue('priority', suggestion.priority);
      setValue('severity', suggestion.severity);
      setShowSuggestion(false);
    }
  };

  const submitBug = async (data: BugFormInputs, justText: string | null, extIds: string[] | null) => {
    setLoading(true);

    try {
      const response = await bugApi.create({
        title: data.title,
        description: data.description,
        priority: data.priority,
        severity: data.severity,
        repro_steps: data.repro_steps,
        expected_result: data.expected_result || undefined,
        actual_result: data.actual_result || undefined,
        assigned_to: data.assigned_to || undefined,
        attachments: attachments.length > 0 ? attachments.map(a => ({ url: a.url, name: a.name })) : undefined,
        created_by: user?.email || data.created_by || undefined,
        reporter_id: user?.id,
        duplicate_justification: justText || undefined,
        duplicate_of_external_ids: extIds || undefined,
        project_id: selectedProjectId,
      });
      
      if (data.pushToAzure) {
        try {
          const pushResp = await bugApi.pushToExternal(response.data.id, 'azure_devops');
          if (pushResp.data.success) {
            toast.success(`Bug created and pushed to Azure DevOps! Work Item: ${pushResp.data.external_id}`);
          } else {
            toast.error(`Bug created but push failed: ${pushResp.data.message}`);
          }
        } catch (pushErr: any) {
          toast.error(`Bug created but push failed: ${pushErr.response?.data?.detail || 'Push failed'}`);
        }
      } else {
        toast.success(`Bug "${response.data.title}" created successfully!`);
      }
      navigate('/bugs');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create bug');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BugFormInputs) => {
    if (duplicateResult && duplicateResult.similar_bugs.some(bug => bug.source === 'azure_devops')) {
      setPendingDuplicateBug(duplicateResult);
      setShowJustificationModal(true);
      setFormData(data);
      return;
    }
    
    await submitBug(data, null, null);
  };
  
  const handleJustificationSubmit = async () => {
    if (!pendingDuplicateBug || !justification.trim() || !formData) return;
    
    const adoDuplicates = pendingDuplicateBug.similar_bugs.filter(b => b.source === 'azure_devops');
    const extIds = adoDuplicates.map(b => b.external_id).filter((id): id is string => !!id);
    
    setShowJustificationModal(false);
    setJustification('');
    setPendingDuplicateBug(null);
    
    await submitBug(formData, justification, extIds);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadApi.upload(file);
      setAttachments([...attachments, { name: file.name, url: result.url }]);
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/bugs')}
          className="btn-icon"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report New Bug</h1>
          <p className="text-sm text-gray-500">Fill in the details to create a new bug report</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('title', { required: 'Title is required', minLength: 5 })}
                className="input-field"
                placeholder="Brief summary of the bug"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project {user?.is_admin ? '(optional)' : <span className="text-red-500">*</span>}
                </label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="input-field"
                >
                  {!user?.is_admin && <option value="">Select a project...</option>}
                  {user?.is_admin && <option value="">No project (optional)</option>}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('description', { required: 'Description is required', minLength: 20 })}
                className="input-field"
                rows={5}
                placeholder="Detailed description of the bug"
                onBlur={checkDuplicate}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Steps to Reproduce <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('repro_steps', { 
                  required: 'Reproduction steps are required', 
                  minLength: { value: 20, message: 'Please provide detailed steps (at least 20 characters)' }
                })}
                className="input-field"
                rows={4}
                placeholder="1. Go to login page\n2. Enter valid credentials\n3. Click login button"
              />
              {errors.repro_steps && (
                <p className="mt-1 text-sm text-red-600">{errors.repro_steps.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Result <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('expected_result', { 
                    required: 'Expected result is required', 
                    minLength: { value: 10, message: 'At least 10 characters' }
                  })}
                  className="input-field"
                  rows={3}
                  placeholder="What should happen?"
                />
                {errors.expected_result && (
                  <p className="mt-1 text-sm text-red-600">{errors.expected_result.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Actual Result <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('actual_result', { 
                    required: 'Actual result is required', 
                    minLength: { value: 10, message: 'At least 10 characters' }
                  })}
                  className="input-field"
                  rows={3}
                  placeholder="What actually happened?"
                />
                {errors.actual_result && (
                  <p className="mt-1 text-sm text-red-600">{errors.actual_result.message}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={fetchSuggestion}
              disabled={gettingSuggestion || !title || title.length < 5 || !description || description.length < 20 || !reproSteps || reproSteps.length < 20}
              className="text-sm text-primary-600 hover:text-primary-800 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {gettingSuggestion ? 'Analyzing...' : 'Get AI Suggestion'}
            </button>
          </div>
        </Card>

        {/* Priority & Severity */}
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                {...register('priority', { required: 'Priority is required' })}
                className="input-field"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                {...register('severity', { required: 'Severity is required' })}
                className="input-field"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </Card>

        {/* User Info & Attachments */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reported By
              </label>
              <input
                type="text"
                {...register('created_by')}
                className="input-field bg-gray-50"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To (Email)
              </label>
              <input
                type="text"
                {...register('assigned_to')}
                className="input-field"
                placeholder="user@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attachments
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*"
                className="input-field"
              />
              {uploading && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}
              {attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm">
                      <Paperclip className="w-4 h-4 text-gray-500" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        {att.name}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* AI Suggestion */}
        {gettingSuggestion && (
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-blue-800 font-medium">Analyzing bug details...</span>
            </div>
          </Card>
        )}

        {showSuggestion && suggestion && (
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-800">AI Suggestion</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">{suggestion.reasoning}</p>
            <div className="flex gap-3 mb-4">
              <Badge label={`Priority: ${suggestion.priority.toUpperCase()}`} />
              <Badge label={`Severity: ${suggestion.severity.toUpperCase()}`} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={applySuggestion} className="btn-primary">
                Apply Suggestion
              </button>
              <button type="button" onClick={() => setShowSuggestion(false)} className="btn-secondary">
                Dismiss
              </button>
            </div>
          </Card>
        )}

        {/* Duplicate Check */}
        {checkingDuplicate && (
          <Card className="bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
              <span className="text-yellow-800 font-medium">Checking for duplicates...</span>
            </div>
          </Card>
        )}

        {duplicateResult && duplicateResult.similar_bugs.length > 0 && (
          <Card className="bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-orange-800">
                Similar Bugs Found ({duplicateResult.similar_bugs.length})
              </h3>
            </div>
            <div className="space-y-2">
              {duplicateResult.similar_bugs.slice(0, 3).map((bug, idx) => (
                <div key={bug.id || bug.external_id || idx} className="bg-white p-3 rounded-lg border border-orange-100">
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{bug.title}</p>
                    {bug.source === 'azure_devops' && (
                      <Badge label="ADO" />
                    )}
                  </div>
                  {bug.source === 'azure_devops' && bug.external_url && (
                    <a href={bug.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                      View in Azure DevOps
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(bug.similarity * 100)}% match
                    {bug.severity && ` • ${bug.severity}`}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 items-center">
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              {...register('pushToAzure')}
              className="mr-2 rounded border-gray-300"
            />
            Push to Azure DevOps
          </label>
          <button
            type="button"
            onClick={() => navigate('/bugs')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </span>
            ) : 'Submit Bug'}
          </button>
        </div>
      </form>

      {/* Justification Modal */}
      <Modal
        isOpen={showJustificationModal}
        onClose={() => {
          setShowJustificationModal(false);
          setPendingDuplicateBug(null);
        }}
        title="Duplicate Bug Detected"
        description="Similar bugs exist in Azure DevOps. Please provide justification to proceed."
        size="lg"
      >
        {pendingDuplicateBug && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-orange-800 mb-2">Similar Bugs:</h4>
              <ul className="space-y-2">
                {pendingDuplicateBug.similar_bugs
                  .filter(b => b.source === 'azure_devops')
                  .slice(0, 3)
                  .map((bug, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{bug.title}</span>
                      <span className="text-orange-600 font-medium ml-2">{Math.round(bug.similarity * 100)}%</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="input-field"
                rows={4}
                placeholder="Explain why this is not a duplicate or why it should be created anyway..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowJustificationModal(false);
                  setPendingDuplicateBug(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleJustificationSubmit}
                disabled={!justification.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Submit with Justification
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}