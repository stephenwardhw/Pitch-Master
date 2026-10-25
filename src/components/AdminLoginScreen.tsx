import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  Database,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { loginAdmin, AdminUser } from '../utils/authClient';

interface AdminLoginScreenProps {
  onLoginSuccess: (user: AdminUser) => void;
  onGoToHome: () => void;
  onGoToPortal: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onLoginSuccess,
  onGoToHome,
  onGoToPortal,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCredentialsHint, setShowCredentialsHint] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your administrator username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await loginAdmin(username.trim(), password, rememberMe);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.message || 'Invalid administrator credentials. Access denied.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 select-none font-sans">
      {/* Top Bar with Navigation Back */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <button
          type="button"
          onClick={onGoToHome}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>PitchMaster Home</span>
        </button>

        <button
          type="button"
          onClick={onGoToPortal}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-950/40 hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/20 cursor-pointer"
        >
          <span>Parent & Coach Portal</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 sm:p-9 text-slate-900 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          {/* Logo & Header */}
          <div className="text-center space-y-2 mb-7">
            <div className="w-14 h-14 bg-linear-to-tr from-indigo-600 to-indigo-700 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20 border border-indigo-400/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                League Administration
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Authorized Personnel & Scheduler Access
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or your username"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowCredentialsHint(!showCredentialsHint)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Setup Help</span>
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Hint Box */}
            {showCredentialsHint && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-slate-700 space-y-1.5 animate-in fade-in">
                <div className="font-semibold text-indigo-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>MySQL Authentication Details</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Credentials are verified against the MySQL <code className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200 text-indigo-900 font-bold">admin_users</code> table.
                </p>
                <div className="text-[11px] bg-white/80 p-2 rounded-lg border border-indigo-100 font-mono text-slate-800 space-y-0.5">
                  <div>Default Username: <strong className="text-indigo-700">admin</strong></div>
                  <div>Default Password: <strong className="text-indigo-700">pitchmaster</strong></div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-600 font-medium">Remember on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Information */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>MySQL Database Verified</span>
            </span>
            <span className="font-semibold text-slate-400">
              PitchMaster Security
            </span>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="text-center text-xs text-slate-500 py-2">
        <p>PitchMaster Soccer Scheduling & Field Management Platform</p>
      </footer>
    </div>
  );
};
