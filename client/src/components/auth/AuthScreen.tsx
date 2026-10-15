import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, User, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [emailOrUsername, setEmailOrUsername] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!emailOrUsername.trim() || !password) {
        throw new Error('Please enter your credentials');
      }
      await login({
        emailOrUsername: emailOrUsername.trim(),
        password,
      });
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!username.trim() || !email.trim() || !password) {
        throw new Error('Please fill in all fields');
      }
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
      });
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="screen-auth"
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50/60 via-white to-amber-50/40 overflow-y-auto"
    >
      {/* Top-Anchored Card with Strict Fixed Height = 100% ZERO SHIFT */}
      <div
        className="auth-card-lock w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-google-grey200 overflow-hidden shrink-0 flex flex-col relative"
        style={{ height: '540px', maxHeight: '90vh' }}
      >
        {/* Solid Google Blue Header Block (Fixed Height: 160px) */}
        <div
          className="bg-google-blue px-6 py-5 text-center text-white shrink-0 relative flex flex-col items-center justify-center"
          style={{ height: '160px' }}
        >
          {/* White Rounded Badge with Large, Sharp GDG Brackets Logo */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white p-2 shadow-md mb-2">
            <img
              src="/assets/brand/logo-gdg-clean.webp"
              alt="GDG Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-none">
            GDG-HUST
          </h1>
          <p className="text-[11px] sm:text-xs text-blue-100 font-medium tracking-tight mt-1 max-w-[280px] leading-tight">
            Google Developer Groups on Campus • Hanoi University of Science and Technology
          </p>
        </div>

        {/* Form Body with EXACT SAME HEIGHT & FIXED BUTTON ANCHOR (Zero Pixel Movement) */}
        <div
          className="p-6 sm:p-7 flex-1 flex flex-col justify-between"
          style={{ height: '380px' }}
        >
          {/* Tabs: Sign In / Create Account (Height: 40px) */}
          <div
            className="flex p-1 bg-google-grey100 rounded-full mb-4 border border-google-grey200 shrink-0 h-10"
            role="tablist"
            aria-label="Authentication modes"
          >
            <button
              id="tab-auth-signin"
              type="button"
              role="tab"
              aria-selected={!isRegister}
              aria-controls="panel-signin"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                !isRegister
                  ? 'bg-white text-google-blue shadow-xs'
                  : 'text-google-grey700 hover:text-google-grey900'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-auth-register"
              type="button"
              role="tab"
              aria-selected={isRegister}
              aria-controls="panel-register"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                isRegister
                  ? 'bg-white text-google-blue shadow-xs'
                  : 'text-google-grey700 hover:text-google-grey900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* RIGID FORM CONTAINER: Holds panels at exact same coordinates */}
          <div
            className="relative flex-1"
            style={{ height: '275px' }}
            data-testid="auth-form-container"
          >
            {/* TAB 1: SIGN IN FORM (Pinned to exact coordinates) */}
            <div
              id="panel-signin"
              role="tabpanel"
              aria-labelledby="tab-auth-signin"
              hidden={isRegister}
              className={`absolute inset-0 flex flex-col justify-between ${
                isRegister ? 'hidden' : ''
              }`}
            >
              <form onSubmit={handleLoginSubmit} className="h-full flex flex-col justify-between">
                <div className="space-y-4 pt-1">
                  {error && !isRegister && (
                    <div
                      role="alert"
                      className="p-2 rounded-xl bg-google-red-subtle border border-google-red/20 flex items-center gap-1.5 text-google-red text-xs shrink-0"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{error}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="login-username"
                      className="block text-xs font-semibold text-google-grey700 mb-1 ml-1"
                    >
                      Email or Username
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3 text-google-grey700" />
                      <input
                        id="login-username"
                        type="text"
                        value={emailOrUsername}
                        onChange={(e) => setEmailOrUsername(e.target.value)}
                        placeholder="alex or alex@gdghust.dev"
                        className="w-full pl-10 pr-4 py-2.5 rounded-full border border-google-grey300 bg-google-grey50 focus:bg-white focus:outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 text-xs sm:text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-google-grey700 mb-1 ml-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3 text-google-grey700" />
                      <input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-full border border-google-grey300 bg-google-grey50 focus:bg-white focus:outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 text-xs sm:text-sm transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON PINNED AT THE EXACT SAME PIXEL POSITION */}
                <div className="pb-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-full bg-google-blue hover:bg-google-blue-hover text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to GDG-HUST</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* TAB 2: CREATE ACCOUNT FORM (Pinned to exact coordinates, Button 100% visible) */}
            <div
              id="panel-register"
              role="tabpanel"
              aria-labelledby="tab-auth-register"
              hidden={!isRegister}
              className={`absolute inset-0 flex flex-col justify-between ${
                !isRegister ? 'hidden' : ''
              }`}
            >
              <form onSubmit={handleRegisterSubmit} className="h-full flex flex-col justify-between">
                <div className="space-y-2.5">
                  {error && isRegister && (
                    <div
                      role="alert"
                      className="p-1.5 rounded-xl bg-google-red-subtle border border-google-red/20 flex items-center gap-1.5 text-google-red text-xs shrink-0"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{error}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="reg-username"
                      className="block text-xs font-semibold text-google-grey700 mb-0.5 ml-1"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-2.5 text-google-grey700" />
                      <input
                        id="reg-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. duynat_dev"
                        className="w-full pl-10 pr-4 py-2 rounded-full border border-google-grey300 bg-google-grey50 focus:bg-white focus:outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 text-xs sm:text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-semibold text-google-grey700 mb-0.5 ml-1"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-2.5 text-google-grey700" />
                      <input
                        id="reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@gdghust.dev"
                        className="w-full pl-10 pr-4 py-2 rounded-full border border-google-grey300 bg-google-grey50 focus:bg-white focus:outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 text-xs sm:text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-semibold text-google-grey700 mb-0.5 ml-1"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-2.5 text-google-grey700" />
                      <input
                        id="reg-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2 rounded-full border border-google-grey300 bg-google-grey50 focus:bg-white focus:outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 text-xs sm:text-sm transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON PINNED AT THE EXACT SAME PIXEL POSITION */}
                <div className="pb-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-full bg-google-blue hover:bg-google-blue-hover text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create GDG-HUST Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
