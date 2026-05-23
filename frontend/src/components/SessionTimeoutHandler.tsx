import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { LogOut, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SessionTimeoutHandler() {
  const { user, logout, token } = useAuth();
  const [isWarning, setIsWarning] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [timeoutMs, setTimeoutMs] = useState(2 * 60 * 60 * 1000); // 2 hours default

  const lastActivity = useRef<number>(Date.now());
  const isWarningRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch timeout configuration when user logs in
  useEffect(() => {
    if (!user || !token) {
      setIsWarning(false);
      isWarningRef.current = false;
      return;
    }

    const fetchTimeout = async () => {
      try {
        const res = await authApi.getSessionTimeout();
        const { hours, minutes } = res.data;
        const totalMs = (hours * 3600 + minutes * 60) * 1000;
        // Ensure at least 1 minute to prevent immediate timeout
        setTimeoutMs(Math.max(60000, totalMs));
      } catch (err) {
        console.error('Failed to fetch session timeout setting, using default 2h:', err);
        setTimeoutMs(2 * 60 * 60 * 1000); // 2 hours default fallback
      }
    };

    fetchTimeout();
    lastActivity.current = Date.now();
  }, [user, token]);

  // Set up inactivity tracking
  useEffect(() => {
    if (!user || !token) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'mousedown', 'touchstart'];
    
    const resetTimer = () => {
      if (!isWarningRef.current) {
        lastActivity.current = Date.now();
      }
    };

    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start interval check
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivity.current;

      if (!isWarningRef.current) {
        // Trigger 10 seconds warning
        if (elapsed >= timeoutMs - 10000) {
          isWarningRef.current = true;
          setIsWarning(true);
          setCountdown(10);
        }
      } else {
        // Count down
        setCountdown(prev => prev - 1);
      }
    }, 1000);

    // Clean up
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, token, timeoutMs]);

  // Handle session expiration side-effects when countdown reaches 0
  useEffect(() => {
    if (isWarning && countdown <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsWarning(false);
      isWarningRef.current = false;
      toast.error('Session expired due to inactivity.');
      logout();
    }
  }, [countdown, isWarning, logout]);

  const handleContinue = async () => {
    try {
      // Ping server to ensure session remains active on backend
      await authApi.getSessionTimeout();
    } catch (e) {
      // Ignored
    }
    // Reset activity timer
    lastActivity.current = Date.now();
    isWarningRef.current = false;
    setIsWarning(false);
    toast.success('Session extended successfully.');
  };

  const handleLogout = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsWarning(false);
    isWarningRef.current = false;
    logout();
  };

  if (!isWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" />

      {/* Modern Warning Card Container */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 overflow-hidden transform scale-100 transition-all duration-300 flex flex-col items-center text-center animate-fade-in">
        {/* Pulsing Warning Icon */}
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 relative">
          <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-75" />
          <ShieldAlert className="w-8 h-8 text-amber-500 relative z-10" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">Session Expiring Soon</h3>
        
        <p className="text-sm text-gray-600 mb-6">
          You have been idle for a while. Your session will end in:
        </p>

        {/* Countdown display */}
        <div className="w-24 h-24 rounded-full border-4 border-amber-500/20 flex items-center justify-center mb-6 bg-amber-50/50">
          <span className="text-4xl font-extrabold text-amber-600 animate-pulse">
            {countdown}s
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <button
            onClick={handleContinue}
            className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md shadow-primary-600/10 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 active:scale-[0.98]"
          >
            Continue Working
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-gray-400 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
