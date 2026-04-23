import { useForm } from 'react-hook-form';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugApi, DuplicateCheckResponse, BugSuggestion, PushBugResponse } from '../services/api';

interface BugFormInputs {
  title: string;
  description: string;
  repro_steps: string;
  priority: string;
  severity: string;
  created_by: string;
}

export default function BugFormPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [gettingSuggestion, setGettingSuggestion] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResponse | null>(null);
  const [suggestion, setSuggestion] = useState<BugSuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [pushingToAzure, setPushingToAzure] = useState(false);
  const [pushResult, setPushResult] = useState<PushBugResponse | null>(null);

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

  const onSubmit = async (data: BugFormInputs, pushToExternal: boolean = false) => {
    setLoading(true);
    setPushResult(null);
    try {
      const response = await bugApi.create({
        title: data.title,
        description: data.description,
        priority: data.priority,
        severity: data.severity,
        repro_steps: data.repro_steps,
        created_by: data.created_by || undefined,
      });
      
      if (pushToExternal) {
        await pushToAzureDevOps(response.data.id);
      }
      
      navigate('/bugs');
    } catch (error) {
      console.error('Error creating bug:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitWithPush = () => {
    handleSubmit((data) => onSubmit(data, true))();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Report New Bug</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                placeholder="1. Go to login page&#10;2. Enter valid credentials&#10;3. Click login button&#10;4. App crashes with error"
              />
              {errors.repro_steps && (
                <p className="mt-1 text-sm text-red-600">{errors.repro_steps.message}</p>
              )}
              <button
                type="button"
                onClick={fetchSuggestion}
                disabled={gettingSuggestion || !title || title.length < 5 || !description || description.length < 20 || !reproSteps || reproSteps.length < 20}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {gettingSuggestion ? 'Analyzing...' : 'Get Priority & Severity Suggestion'}
              </button>
            </div>

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
                  <span className="text-sm text-gray-500">Suggested Priority:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    suggestion.priority === 'critical' ? 'bg-red-100 text-red-800' :
                    suggestion.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {suggestion.priority.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Suggested Severity:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                    suggestion.severity === 'critical' ? 'bg-red-100 text-red-800' :
                    suggestion.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                    suggestion.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {suggestion.severity.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Bug Type:</span>
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {suggestion.bug_type}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Confidence:</span>
                  <span className="ml-2 text-sm font-medium">
                    {(suggestion.confidence * 100).toFixed(0)}%
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
                <div
                  key={bug.id}
                  className="bg-white p-3 rounded border border-orange-100"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{bug.title}</p>
                      <p className="text-sm text-gray-500">
                        {bug.description.substring(0, 100)}...
                      </p>
                    </div>
                    <span className={`severity-badge severity-${bug.severity}`}>
                      {bug.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Push Result */}
        {pushResult && (
          <div className={`card ${pushResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium ${pushResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {pushResult.success ? 'Successfully pushed to Azure DevOps!' : 'Push failed'}
                </p>
                <p className="text-sm text-gray-600 mt-1">{pushResult.message}</p>
                {pushResult.url && (
                  <a href={pushResult.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    View in Azure DevOps
                  </a>
                )}
              </div>
              {pushResult.external_id && (
                <span className="text-sm text-gray-500">
                  ID: {pushResult.external_id}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/bugs')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit((data) => onSubmit(data, true))()}
            disabled={loading || pushingToAzure}
            className="btn-secondary disabled:opacity-50"
          >
            {pushingToAzure ? 'Pushing...' : 'Submit & Push to Azure DevOps'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Bug'}
          </button>
        </div>
        <div className="flex justify-end gap-4">
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
      </form>
    </div>
  );
}