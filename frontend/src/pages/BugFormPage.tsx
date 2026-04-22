import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugApi, DuplicateCheckResponse } from '../services/api';

interface BugFormInputs {
  title: string;
  description: string;
  created_by: string;
}

export default function BugFormPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResponse | null>(null);
  const [classification] = useState<{ severity: string; type: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BugFormInputs>();

  const description = watch('description', '');

  const checkDuplicate = async () => {
    if (!description || description.length < 10) return;
    
    setCheckingDuplicate(true);
    try {
      const response = await bugApi.checkDuplicate(description);
      setDuplicateResult(response.data);
    } catch (error) {
      console.error('Error checking duplicates:', error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const onSubmit = async (data: BugFormInputs) => {
    setLoading(true);
    try {
      await bugApi.create(data);
      navigate('/bugs');
    } catch (error) {
      console.error('Error creating bug:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Report New Bug</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
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
                Description
              </label>
              <textarea
                {...register('description', { required: 'Description is required', minLength: 20 })}
                className="input-field"
                rows={6}
                placeholder="Detailed description of the bug, including steps to reproduce, expected behavior, and actual behavior"
                onBlur={checkDuplicate}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
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

        {/* Classification Result (placeholder) */}
        {classification && (
          <div className="card bg-blue-50 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              AI Classification
            </h3>
            <div className="flex gap-4">
              <div>
                <span className="text-sm text-gray-500">Severity:</span>
                <span className={`ml-2 severity-badge severity-${classification.severity}`}>
                  {classification.severity}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Type:</span>
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {classification.type}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Push to External Tool (placeholder) */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Push to External Tool
          </h3>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>Azure DevOps</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span>JIRA</span>
            </label>
          </div>
        </div>

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
