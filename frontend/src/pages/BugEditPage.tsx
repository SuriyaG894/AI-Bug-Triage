import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { bugApi, DuplicateCheckResponse, BugSuggestion, uploadApi, projectApi, Project, Bug } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, Modal, ConfirmDialog } from '../components';
import { ArrowLeft, Loader2, Brain, AlertTriangle, Paperclip, X, ExternalLink, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactQuill from 'react-quill';
import DOMPurify from 'dompurify';
import 'react-quill/dist/quill.snow.css';

const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    ['clean']
  ],
};

const quillFormats = [
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet',
  'indent'
];


interface BugEditInputs {
  title: string;
  description: string;
  repro_steps: string;
  expected_result: string;
  actual_result: string;
  priority: string;
  severity: string;
  type: string;
  status: string;
  assigned_to: string;
}

interface Attachment {
  name: string;
  url: string;
  content_base64?: string;
}

export default function BugEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const renderModalFieldContent = (content: string | undefined | null) => {
    if (!content) return null;
    const isHtml = /<[a-zA-Z]+[^>]*>/.test(content);
    if (isHtml) {
      const cleanHtml = DOMPurify.sanitize(content);
      return (
        <div 
          className="rich-content text-sm text-gray-900 bg-gray-50 rounded p-2"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
    }
    return (
      <ul className="list-disc list-inside text-sm text-gray-900 bg-gray-50 rounded p-2 space-y-0.5">
        {content.split('\n').filter(Boolean).map((item, i) => (
          <li key={i}>{item.replace(/^\d+[.)\s]*/, '')}</li>
        ))}
      </ul>
    );
  };

  const renderModalDescriptionContent = (content: string | undefined | null) => {
    if (!content) return null;
    const isHtml = /<[a-zA-Z]+[^>]*>/.test(content);
    if (isHtml) {
      const cleanHtml = DOMPurify.sanitize(content);
      return (
        <div 
          className="rich-content text-sm text-gray-900 bg-gray-50 rounded p-2"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
    }
    return (
      <div className="text-sm text-gray-900 bg-gray-50 rounded p-2 whitespace-pre-wrap">
        {content}
      </div>
    );
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
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
  const [formData, setFormData] = useState<BugEditInputs | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showBypassConfirm, setShowBypassConfirm] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [bugData, setBugData] = useState<any>(null);
  const [showPushOption, setShowPushOption] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [bugId, setBugId] = useState<number | null>(null);
  const [viewBug, setViewBug] = useState<Bug | null>(null);
  const [loadingViewBug, setLoadingViewBug] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    if (id) {
      const parsedId = parseInt(id);
      setBugId(parsedId);
      Promise.all([
        bugApi.get(parsedId),
        projectApi.myProjects(),
      ]).then(([bugResp, projResp]) => {
        const bug = bugResp.data;
        setBugData(bug);
        setProjects(projResp.data);
        setSelectedProjectId(bug.project_id);
        setAttachments(
          (bug.attachments || []).map((a: any) =>
            typeof a === 'string' ? { url: a, name: a.split('/').pop() || 'file' } : a
          )
        );
        reset({
          title: bug.title,
          description: bug.description,
          repro_steps: bug.repro_steps || '',
          expected_result: bug.expected_result || '',
          actual_result: bug.actual_result || '',
          priority: bug.priority || 'medium',
          severity: bug.severity,
          type: bug.type,
          status: bug.status,
          assigned_to: bug.assigned_to || '',
        });
        setPageLoading(false);
      }).catch(() => {
        toast.error('Failed to load bug');
        navigate('/bugs');
      });
    }
  }, [id]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<BugEditInputs>({
    defaultValues: {
      priority: 'medium',
      severity: 'medium',
      type: 'general',
      status: 'open',
      assigned_to: '',
      repro_steps: '',
      expected_result: '',
      actual_result: '',
    }
  });

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
      const response = await bugApi.checkDuplicateWithExclude(title, description, bugId!, reproSteps);
      setDuplicateResult(response.data);
    } catch (error) {
      console.error('Error checking duplicates:', error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const openBugDetail = async (bugId: number) => {
    setLoadingViewBug(true);
    setShowViewModal(true);
    try {
      const response = await bugApi.get(bugId);
      setViewBug(response.data);
    } catch (error) {
      toast.error('Failed to load bug details');
      setShowViewModal(false);
    } finally {
      setLoadingViewBug(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion) {
      setValue('priority', suggestion.priority);
      setValue('severity', suggestion.severity);
      setShowSuggestion(false);
    }
  };

  const submitBugUpdate = async (data: BugEditInputs, justText: string | null) => {
    if (!bugId) return;
    setLoading(true);

    try {
      const response = await bugApi.update(bugId, {
        title: data.title,
        description: data.description,
        priority: data.priority,
        severity: data.severity,
        type: data.type,
        status: data.status,
        repro_steps: data.repro_steps,
        expected_result: data.expected_result || undefined,
        actual_result: data.actual_result || undefined,
        assigned_to: data.assigned_to || undefined,
        attachments: attachments.length > 0 ? attachments.map(a => ({ url: a.url, name: a.name, content_base64: a.content_base64 })) : undefined,
        project_id: selectedProjectId,
        duplicate_justification: justText || undefined,
      });

      toast.success(`Bug "${response.data.title}" updated successfully!`);

      if (bugData?.external_id || bugData?.push_to_external) {
        setShowPushOption(true);
        setBugData(response.data);
      } else {
        navigate(`/bugs/${bugId}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update bug');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: BugEditInputs) => {
    if (!user?.is_admin && !selectedProjectId) {
      setProjectError('Please select a project before saving');
      toast.error('Project selection is required');
      return;
    }
    setProjectError('');

    if (duplicateResult && duplicateResult.similar_bugs.some(bug => bug.source === 'azure_devops')) {
      setPendingDuplicateBug(duplicateResult);
      setShowJustificationModal(true);
      setFormData(data);
      return;
    }

    await submitBugUpdate(data, null);
  };

  const handleJustificationSubmit = async () => {
    if (!pendingDuplicateBug || !justification.trim() || !formData) return;

    if (!user?.is_admin && !selectedProjectId) {
      setProjectError('Please select a project before saving');
      toast.error('Project selection is required');
      setShowJustificationModal(false);
      setPendingDuplicateBug(null);
      return;
    }

    setShowJustificationModal(false);
    setJustification('');
    setPendingDuplicateBug(null);

    await submitBugUpdate(formData, justification);
  };

  const handlePushUpdates = async (fallback = false) => {
    if (!bugId) return;

    if (!user?.is_admin && !selectedProjectId) {
      setProjectError('A project must be selected to push to Azure DevOps');
      toast.error('Select a project before pushing to Azure DevOps');
      return;
    }

    setPushing(true);
    try {
      const resp = await bugApi.pushToExternal(bugId, 'azure_devops', undefined, fallback);
      if (!resp.data.success && resp.data.error === 'bypass_rules_failed') {
        setShowBypassConfirm(true);
        return;
      }
      if (resp.data.success) {
        if (resp.data.attachment_errors?.length) {
          toast.error(`Pushed to ADO, but ${resp.data.attachment_errors.length} attachment(s) failed: ${resp.data.attachment_errors.join('; ')}`);
        } else {
          toast.success('Changes pushed to Azure DevOps!');
        }
        navigate(`/bugs/${bugId}`);
      } else {
        toast.error(resp.data.message);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to push changes to Azure DevOps');
    } finally {
      setPushing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newAttachments: Attachment[] = [];
      for (const file of Array.from(files)) {
        const result = await uploadApi.upload(file);
        newAttachments.push({ name: file.name, url: result.url, content_base64: result.content_base64 });
      }
      setAttachments([...attachments, ...newAttachments]);
      toast.success(`Uploaded ${files.length} file(s)`);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/bugs/${bugId}`)}
          className="btn-icon"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Bug #{bugId}</h1>
          <p className="text-sm text-gray-500">Update the bug details below</p>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                {...register('type')}
                className="input-field"
              >
                <option value="general">General</option>
                <option value="ui">UI</option>
                <option value="backend">Backend</option>
                <option value="api">API</option>
                <option value="data">Data</option>
                <option value="security">Security</option>
                <option value="performance">Performance</option>
                <option value="crash">Crash</option>
                <option value="data_loss">Data Loss</option>
              </select>
            </div>

            {projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project {user?.is_admin ? '(optional)' : <span className="text-red-500">*</span>}
                </label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value ? Number(e.target.value) : null);
                    setProjectError('');
                  }}
                  className={`input-field ${projectError ? 'border-red-500' : ''}`}
                >
                  {!user?.is_admin && <option value="">Select a project...</option>}
                  {user?.is_admin && <option value="">No project (optional)</option>}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {projectError && (
                  <p className="mt-1 text-sm text-red-600">{projectError}</p>
                )}
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
              <Controller
                name="repro_steps"
                control={control}
                rules={{
                  required: 'Reproduction steps are required',
                  validate: {
                    minLength: (v) => {
                      const text = v ? v.replace(/<[^>]*>/g, '').trim() : '';
                      return text.length >= 20 || 'Please provide detailed steps (at least 20 characters)';
                    }
                  }
                }}
                render={({ field }) => (
                  <ReactQuill
                    theme="snow"
                    modules={quillModules}
                    formats={quillFormats}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={() => {
                      field.onBlur();
                      checkDuplicate();
                    }}
                    placeholder="Enter steps to reproduce..."
                  />
                )}
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
                <Controller
                  name="expected_result"
                  control={control}
                  rules={{
                    required: 'Expected result is required',
                    validate: {
                      minLength: (v) => {
                        const text = v ? v.replace(/<[^>]*>/g, '').trim() : '';
                        return text.length >= 10 || 'At least 10 characters';
                      }
                    }
                  }}
                  render={({ field }) => (
                    <ReactQuill
                      theme="snow"
                      modules={quillModules}
                      formats={quillFormats}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="What should happen?"
                    />
                  )}
                />
                {errors.expected_result && (
                  <p className="mt-1 text-sm text-red-600">{errors.expected_result.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Actual Result <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="actual_result"
                  control={control}
                  rules={{
                    required: 'Actual result is required',
                    validate: {
                      minLength: (v) => {
                        const text = v ? v.replace(/<[^>]*>/g, '').trim() : '';
                        return text.length >= 10 || 'At least 10 characters';
                      }
                    }
                  }}
                  render={({ field }) => (
                    <ReactQuill
                      theme="snow"
                      modules={quillModules}
                      formats={quillFormats}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="What actually happened?"
                    />
                  )}
                />
                {errors.actual_result && (
                  <p className="mt-1 text-sm text-red-600">{errors.actual_result.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                {...register('status')}
                className="input-field"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
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

        {/* Assignment & Attachments */}
        <Card>
          <div className="space-y-4">
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
                multiple
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
          <Card className="border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-semibold text-gray-900">
                Similar Bugs Found ({duplicateResult.similar_bugs.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 -mx-4 -mb-4">
              {duplicateResult.similar_bugs.slice(0, 3).map((bug, idx) => {
                const pct = Math.round(bug.similarity * 100);
                const isHigh = pct >= 82;
                const isMid = pct >= 60;
                const barColor = isHigh ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-blue-500';
                const badgeStyle = isHigh
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : isMid
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200';
                return (
                  <div key={bug.id || bug.external_id || idx} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{bug.title}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 max-w-[200px] bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        {bug.source === 'azure_devops' && (
                          <span className="text-xs text-gray-400 font-medium">ADO</span>
                        )}
                        {bug.source !== 'azure_devops' && bug.source && (
                          <span className="text-xs text-gray-400 font-medium capitalize">{bug.source}</span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${badgeStyle} flex-shrink-0`}>
                      {pct}%
                    </span>
                    {bug.source === 'azure_devops' && bug.external_url ? (
                      <a
                        href={bug.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors flex-shrink-0"
                      >
                        ADO
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : bug.id ? (
                      <button
                        type="button"
                        onClick={() => openBugDetail(bug.id!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Submit / Push */}
        <div className="flex justify-end gap-3 items-center">
          <button
            type="button"
            onClick={() => navigate(`/bugs/${bugId}`)}
            className="btn-secondary"
          >
            Cancel
          </button>
          {showPushOption && bugData?.external_id ? (
            <button
              type="button"
              onClick={handlePushUpdates}
              disabled={pushing}
              className="btn-primary disabled:opacity-50"
            >
              {pushing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pushing to Azure DevOps...
                </span>
              ) : 'Save & Push to Azure DevOps'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : 'Save Changes'}
            </button>
          )}
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
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Similar Bugs ({pendingDuplicateBug.similar_bugs.length})
              </h4>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {pendingDuplicateBug.similar_bugs
                  .slice(0, 5)
                  .map((bug, idx) => {
                    const pct = Math.round(bug.similarity * 100);
                    const isHigh = pct >= 82;
                    const isMid = pct >= 60;
                    const barColor = isHigh ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-blue-500';
                    const badgeStyle = isHigh
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : isMid
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200';
                    return (
                      <div key={idx} className="flex items-center gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{bug.title}</p>
                            {bug.source === 'azure_devops' && (
                              <span className="text-xs text-gray-400 font-medium flex-shrink-0">ADO</span>
                            )}
                          </div>
                          <div className="mt-2 max-w-[240px] bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border flex-shrink-0 ${badgeStyle}`}>
                          {pct}%
                        </span>
                        {bug.source === 'azure_devops' && bug.external_url ? (
                          <a
                            href={bug.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors flex-shrink-0"
                          >
                            ADO
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : bug.id ? (
                          <button
                            type="button"
                            onClick={() => openBugDetail(bug.id!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
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
                type="button"
                onClick={() => {
                  setShowJustificationModal(false);
                  setPendingDuplicateBug(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
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

      {/* Bug Detail Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewBug(null); }}
        title="Bug Details"
        size="lg"
      >
        {loadingViewBug ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : viewBug ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">{viewBug.title}</h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge label={viewBug.severity} variant="severity" color={viewBug.severity as any} />
                {viewBug.priority && <Badge label={viewBug.priority} />}
                <Badge label={viewBug.status} variant="status" color={viewBug.status as any} />
                {viewBug.type && <Badge label={viewBug.type} />}
                {viewBug.source && <Badge label={viewBug.source} variant="source" color={viewBug.source === 'azure_devops' ? 'external' : 'internal'} />}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex gap-1">
                <span className="text-gray-400">By:</span>
                <span className="text-gray-700 truncate">{viewBug.created_by || '-'}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-gray-400">To:</span>
                <span className="text-gray-700 truncate">{viewBug.assigned_to || '-'}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-gray-400">Created:</span>
                <span className="text-gray-700">{new Date(viewBug.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-1">
                <span className="text-gray-400">Updated:</span>
                <span className="text-gray-700">{new Date(viewBug.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1">Description</p>
              {renderModalDescriptionContent(viewBug.description)}
            </div>

            {viewBug.repro_steps && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Repro Steps</p>
                {renderModalFieldContent(viewBug.repro_steps)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {viewBug.expected_result && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Expected</p>
                  {renderModalFieldContent(viewBug.expected_result)}
                </div>
              )}
              {viewBug.actual_result && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Actual</p>
                  {renderModalFieldContent(viewBug.actual_result)}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Bypass Rules Fallback Confirmation */}
      <ConfirmDialog
        isOpen={showBypassConfirm}
        onClose={() => {
          setShowBypassConfirm(false);
          toast.error("Bug changes saved locally, but updates were not pushed to Azure DevOps.");
          navigate(`/bugs/${bugId}`);
        }}
        onConfirm={() => {
          setShowBypassConfirm(false);
          handlePushUpdates(true);
        }}
        title="Azure DevOps Access Warning"
        message="This user doesn't have access to ADO, so PAT owner name will be used as bug creator. Do you want to proceed?"
        confirmLabel="Proceed"
        variant="warning"
        loading={pushing}
      />
    </div>
  );
}
