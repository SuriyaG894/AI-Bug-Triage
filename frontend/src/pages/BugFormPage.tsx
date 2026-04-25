import { useForm } from 'react-hook-form';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugApi, DuplicateCheckResponse, BugSuggestion, PushBugResponse, uploadApi } from '../services/api';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [bugCreated, setBugCreated] = useState<{id: number; title: string} | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [gettingSuggestion, setGettingSuggestion] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResponse | null>(null);
  const [suggestion, setSuggestion] = useState<BugSuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [pushingToAzure, setPushingToAzure] = useState(false);
  const [pushResult, setPushResult] = useState<PushBugResponse | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

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

  const pushToAzureDevOps = async (bugId: number) => {
    setPushingToAzure(true);
    setPushResult(null);
    try {
      const response = await bugApi.pushToExternal(bugId, 'azure_devops');
      setPushResult(response.data);
    } catch (error: any) {
      setPushResult({
        success: false,
        message: error.response?.data?.detail || 'Failed to push to Azure DevOps'
      });
    } finally {
      setPushingToAzure(false);
    }
  };

  const onSubmit = async (data: BugFormInputs) => {
    setLoading(true);
    setSubmitSuccess(false);
    setBugCreated(null);
    setPushResult(null);
    
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
        created_by: data.created_by || undefined,
      });
      
      setBugCreated({ id: response.data.id, title: response.data.title });
      
      if (data.pushToAzure) {
        try {
          const pushResp = await bugApi.pushToExternal(response.data.id, 'azure_devops');
          setPushResult(pushResp.data);
          if (pushResp.data.success) {
            showSuccessModal(`Bug created and pushed to Azure DevOps!\nWork Item ID: ${pushResp.data.external_id}`);
          } else {
            showErrorModal(`Bug created but push failed: ${pushResp.data.message}`);
          }
        } catch (pushErr: any) {
          showErrorModal(`Bug created but push failed: ${pushErr.response?.data?.detail || 'Push failed'}`);
        }
      } else {
        showSuccessModal(`Bug "${response.data.title}" created successfully!\nBug ID: ${response.data.id}`);
      }
    } catch (error: any) {
      console.error('Error creating bug:', error);
      showErrorModal(error.response?.data?.detail || 'Failed to create bug');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitWithPush = () => {
    handleSubmit((data) => onSubmit(data, true))();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadApi.upload(file);
      setAttachments([...attachments, { name: file.name, url: result.url }]);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const showSuccessModal = (message: string) => {
    setModalMessage(message);
    setModalType('success');
    setShowModal(true);
  };

  const showErrorModal = (message: string) => {
    setModalMessage(message);
    setModalType('error');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    if (modalType === 'success') {
      navigate('/bugs');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Report New Bug</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info Card */}
        <div className="card">
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
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('description', { required: 'Description is required', minLength: 20 })}
                className="input-field"
                rows={5}
                placeholder="Detailed description of the bug, including expected vs actual behavior"
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
                placeholder="1. Go to login page\n2. Enter valid credentials\n3. Click login button\n4. App crashes with error"
              />
              {errors.repro_steps && (
                <p className="mt-1 text-sm text-red-600">{errors.repro_steps.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Result <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('expected_result', { 
                  required: 'Expected result is required', 
                  minLength: { value: 10, message: 'Please provide expected result (at least 10 characters)' }
                })}
                className="input-field"
                rows={3}
                placeholder="What should happen when the steps are followed?"
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
                  minLength: { value: 10, message: 'Please provide actual result (at least 10 characters)' }
                })}
                className="input-field"
                rows={3}
                placeholder="What actually happened?"
              />
              {errors.actual_result && (
                <p className="mt-1 text-sm text-red-600">{errors.actual_result.message}</p>
              )}
            </div>

            <button
              type="button"
              onClick={fetchSuggestion}
              disabled={gettingSuggestion || !title || title.length < 5 || !description || description.length < 20 || !reproSteps || reproSteps.length < 20}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {gettingSuggestion ? 'Analyzing...' : 'Get Priority & Severity Suggestion'}
            </button>
          </div>
        </div>

        {/* Priority & Severity Card */}
        <div className="card">
          <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* User Info Card */}
        <div className="card">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reported By
              </label>
              <input
                type="text"
                {...register('created_by')}
                className="input-field"
                placeholder="Your name (optional)"
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
                placeholder="user@email.com (for Azure DevOps)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attachments (Proof)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*"
                multiple
                className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
              {attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="text-sm bg-gray-100 px-2 py-1 rounded flex items-center gap-1">
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {att.name}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Suggestion Panel */}
        {gettingSuggestion && (
          <div className="card bg-blue-50 border border-blue-200">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-blue-800">Analyzing bug details...</span>
            </div>
          </div>
        )}

        {showSuggestion && suggestion && (
          <div className="card bg-blue-50 border border-blue-200">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-blue-800">
                AI Suggestion
              </h3>
              <button
                type="button"
                onClick={applySuggestion}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Apply Suggestions
              </button>
            </div>
            <div className="bg-white p-3 rounded border border-blue-100 mb-3">
              <p className="text-sm text-gray-600 mb-2">{suggestion.reasoning}</p>
              <div className="flex gap-4">
                <div>
                  <span className="text-sm text-gray-500">Priority:</span>
                  <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {suggestion.priority.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Severity:</span>
                  <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {suggestion.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSuggestion(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Duplicate Check Results */}
        {checkingDuplicate && (
          <div className="card bg-yellow-50 border border-yellow-200">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mr-3"></div>
              <span className="text-yellow-800">Checking for duplicates...</span>
            </div>
          </div>
        )}

        {duplicateResult && duplicateResult.similar_bugs.length > 0 && (
          <div className="card bg-orange-50 border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-800 mb-3">
              Similar Bugs Found
            </h3>
            <div className="space-y-2">
              {duplicateResult.similar_bugs.slice(0, 3).map((bug) => (
                <div key={bug.id} className="bg-white p-3 rounded border border-orange-100">
                  <p className="font-medium">{bug.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        {!submitSuccess && (
          <div className="flex justify-end gap-4 items-center">
            <label className="flex items-center text-sm text-gray-600 mr-4">
              <input
                type="checkbox"
                {...register('pushToAzure')}
                className="mr-2"
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
              {loading ? 'Submitting...' : 'Submit Bug'}
            </button>
          </div>
        )}
      </form>

      {/* Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${modalType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {modalType === 'success' ? 'Success!' : 'Error'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-gray-700 mb-6 whitespace-pre-line">{modalMessage}</p>
            <div className="flex justify-end gap-3">
              {modalType === 'success' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSubmitSuccess(false);
                    setBugCreated(null);
                    setPushResult(null);
                  }}
                  className="btn-secondary"
                >
                  Create Another
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="btn-primary"
              >
                {modalType === 'success' ? 'View Bugs' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}