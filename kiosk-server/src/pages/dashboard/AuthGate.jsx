import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function AuthGate({ auth }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState('login'); // login | register | magic-sent | forgot-sent | reset | magic-verify
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  // Handle URL tokens for magic link and password reset
  useEffect(() => {
    const magicToken = searchParams.get('magic');
    const resetToken = searchParams.get('reset');

    if (magicToken) {
      setView('magic-verify');
      setLoading(true);
      auth.verifyMagicLink(magicToken)
        .then(() => {
          setSearchParams({}, { replace: true });
        })
        .catch((err) => {
          setError(err.message || 'Invalid or expired magic link');
          setView('login');
          setSearchParams({}, { replace: true });
        })
        .finally(() => setLoading(false));
    } else if (resetToken) {
      setView('reset');
    }
  }, []);

  // Set initial view based on needsRegistration
  useEffect(() => {
    if (auth.needsRegistration) {
      setView('register');
    }
  }, [auth.needsRegistration]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await auth.register(email, password);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    try {
      await auth.requestMagicLink(email);
      setView('magic-sent');
    } catch (err) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    try {
      await auth.requestPasswordReset(email);
      setView('forgot-sent');
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const resetToken = searchParams.get('reset');
      await auth.resetPassword(resetToken, password);
      setSearchParams({}, { replace: true });
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'magic-verify') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <p className="text-white">Verifying magic link...</p>
        </div>
      </div>
    );
  }

  if (view === 'magic-sent' || view === 'forgot-sent') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="text-4xl mb-4">{view === 'magic-sent' ? '✉️' : '🔑'}</div>
          <h1 className="text-xl font-bold text-white mb-2">Check Your Email</h1>
          <p className="text-slate-400 text-sm mb-6">
            {view === 'magic-sent'
              ? "We've sent you a magic login link. Click the link in the email to sign in."
              : "If an account exists for that email, we've sent password reset instructions."}
          </p>
          <button
            onClick={() => { setView('login'); setError(''); setInfo(''); }}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (view === 'reset') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-2">Reset Password</h1>
          <p className="text-slate-400 text-center mb-6 text-sm">Enter your new password</p>
          <form onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="New password (min 8 chars)"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={loading}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Confirm password"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            {error && <p className="mt-3 text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Resetting...' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-2">Create Account</h1>
          <p className="text-slate-400 text-center mb-6 text-sm">Set up your parent account for kbnmouse</p>
          <form onSubmit={handleRegister}>
            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="Email address"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                disabled={loading}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Password (min 8 chars)"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Confirm password"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>
            {error && <p className="mt-3 text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Login view (default)
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-2">kbnmouse</h1>
        <p className="text-slate-400 text-center mb-6 text-sm">Sign in to continue</p>
        <form onSubmit={handleLogin}>
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="Email address"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              disabled={loading}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Password"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          {error && <p className="mt-3 text-red-400 text-sm text-center">{error}</p>}
          {info && <p className="mt-3 text-emerald-400 text-sm text-center">{info}</p>}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full mt-6 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <button
            onClick={handleForgotPassword}
            disabled={loading || !email}
            className="text-slate-400 hover:text-slate-300 disabled:text-slate-600"
          >
            Forgot password?
          </button>
          <button
            onClick={handleMagicLink}
            disabled={loading || !email}
            className="text-blue-400 hover:text-blue-300 disabled:text-slate-600"
          >
            Magic link
          </button>
        </div>
      </div>
    </div>
  );
}
