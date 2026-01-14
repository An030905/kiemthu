
import React, { useEffect, useState } from 'react';
import { User } from '../../types';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface AuthFormProps {
  onLogin: (user: User, token: string) => void;
  t: any;
  resetToken?: string;
  onResetComplete?: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onLogin, t, resetToken, onResetComplete }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isLogin = authMode === 'login';
  const isRegister = authMode === 'register';
  const isForgotPassword = authMode === 'forgot';
  const isResetPassword = authMode === 'reset';

  const switchMode = (mode: 'login' | 'register' | 'forgot' | 'reset') => {
    setAuthMode(mode);
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    if (resetToken) {
      setAuthMode('reset');
      setError('');
      setSuccess('');
      return;
    }
    if (authMode === 'reset') {
      setAuthMode('login');
    }
  }, [resetToken, authMode]);

  const translateError = (msg: string, isLoginMode: boolean) => {
    const lower = (msg || '').toLowerCase();
    if (lower.includes('credentials')) return 'Invalid email or password';
    if (lower.includes('already exists')) return 'Account already exists';
    if (lower.includes('invalid email')) return 'Invalid email';
    if (lower.includes('password')) return 'Invalid password';
    if (lower.includes('missing') || lower.includes('required')) return 'Missing required fields';
    return isLoginMode ? 'Login failed' : 'Registration failed';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isForgotPassword) {
        if (!email.trim()) {
          setError(t.emailRequired || t.email);
          return;
        }
        await api.auth.forgotPassword({ email });
        setSuccess(t.resetLinkSent);
        return;
      }
      if (isResetPassword) {
        if (!resetToken) {
          setError(t.resetTokenInvalid || t.resetFailed);
          return;
        }
        if (!password || !confirmPassword) {
          setError(t.passwordRequired || t.password);
          return;
        }
        if (password !== confirmPassword) {
          setError(t.passwordMismatch);
          return;
        }
        await api.auth.resetPassword({ token: resetToken, password });
        setSuccess(t.resetSuccess);
        setPassword('');
        setConfirmPassword('');
        setAuthMode('login');
        if (onResetComplete) {
          onResetComplete();
        } else if (window?.history?.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('token');
          url.searchParams.delete('resetToken');
          window.history.replaceState({}, document.title, url.toString());
        }
        return;
      }
      if (isLogin) {
        const res = await api.auth.login({ email, password });
        onLogin(res.user, res.token);
      } else {
        const res = await api.auth.register({ email, password, fullName, major });
        onLogin(res.user, res.token);
      }
    } catch (err: any) {
      const msg = err?.message
        ? err.message
        : (isForgotPassword ? t.resetRequestFailed : (isResetPassword ? t.resetFailed : translateError('', isLogin)));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 relative z-10 border border-slate-100">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">U</div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {(isForgotPassword || isResetPassword) ? t.resetPassword : (isLogin ? t.welcome : t.createAccount)}
          </h2>
          {isForgotPassword && (
            <p className="mt-3 text-slate-500 text-sm">{t.resetPasswordDescription}</p>
          )}
          {isResetPassword && (
            <p className="mt-3 text-slate-500 text-sm">{t.setNewPasswordDescription}</p>
          )}
          {error && <p className="mt-4 text-red-500 text-sm font-bold bg-red-50 py-2 rounded-lg">{error}</p>}
          {success && <p className="mt-4 text-emerald-600 text-sm font-bold bg-emerald-50 py-2 rounded-lg">{success}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.full_name}</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input required type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.major}</label>
                <div className="relative">
                  <input required type="text" value={major} onChange={(e) => setMajor(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 outline-none" placeholder="Software Engineering..." />
                </div>
              </div>
            </>
          )}
          {!isResetPassword && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 outline-none" />
              </div>
            </div>
          )}
          {!isForgotPassword && !isResetPassword && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 outline-none" />
              </div>
              {isLogin && (
                <div className="mt-3 text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    {t.forgotPassword}
                  </button>
                </div>
              )}
            </div>
          )}
          {isResetPassword && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.newPassword}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t.confirmPassword}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 outline-none" />
                </div>
              </div>
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/30 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isForgotPassword ? t.sendResetLink : (isResetPassword ? t.updatePassword : (isLogin ? t.signIn : t.signUp)))}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-10 text-center">
          {(isForgotPassword || isResetPassword) ? (
            <button onClick={() => switchMode('login')} className="text-blue-600 font-bold hover:underline">
              {t.backToLogin}
            </button>
          ) : (
            <p className="text-slate-500 font-medium">
              {isLogin ? t.dontHaveAccount : t.alreadyHaveAccount}
              <button onClick={() => switchMode(isLogin ? 'register' : 'login')} className="ml-2 text-blue-600 font-bold hover:underline">
                {isLogin ? t.signUp : t.logIn}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
