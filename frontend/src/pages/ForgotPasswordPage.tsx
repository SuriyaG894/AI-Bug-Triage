import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

type Step = 'email' | 'otp' | 'reset';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSuccess('Check your email for the verification code.');
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.verifyOTP(email, otp);
      setResetToken(response.data.reset_token || '');
      setSuccess('OTP verified! Set your new password.');
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(resetToken, newPassword);
      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderEmailStep = () => (
    <form onSubmit={handleSendOTP} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-field"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary"
      >
        {loading ? 'Sending...' : 'Send Verification Code'}
      </button>
    </form>
  );

  const renderOTPStep = () => (
    <form onSubmit={handleVerifyOTP} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Verification Code
        </label>
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
          required
          maxLength={6}
          className="input-field text-center text-2xl tracking-widest font-mono"
          placeholder="000000"
        />
        <p className="text-xs text-gray-500 mt-1">Enter the 6-digit code sent to your email</p>
      </div>
      <button
        type="submit"
        disabled={loading || otp.length !== 6}
        className="w-full btn-primary"
      >
        {loading ? 'Verifying...' : 'Verify Code'}
      </button>
      <button
        type="button"
        onClick={() => setStep('email')}
        className="w-full text-sm text-gray-600 hover:text-gray-800"
      >
        Use a different email
      </button>
    </form>
  );

  const renderResetStep = () => (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="input-field"
          placeholder="Minimum 8 characters"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="input-field"
          placeholder="Re-enter password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary"
      >
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );

  const getStepTitle = () => {
    switch (step) {
      case 'email': return 'Forgot Password';
      case 'otp': return 'Enter Code';
      case 'reset': return 'Set New Password';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {getStepTitle()}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Back to login
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Progress indicator */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center space-x-4">
              {['email', 'otp', 'reset'].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s ? 'bg-blue-600 text-white' :
                    ['email', 'otp', 'reset'].indexOf(step) > i ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {['email', 'otp', 'reset'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  {i < 2 && <div className="w-8 h-0.5 bg-gray-200 mx-2" />}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {step === 'email' && renderEmailStep()}
          {step === 'otp' && renderOTPStep()}
          {step === 'reset' && renderResetStep()}
        </div>
      </div>
    </div>
  );
}