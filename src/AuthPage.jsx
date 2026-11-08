import { useState } from 'react';
import { supabase } from './supabaseClient.js';

export default function AuthPage() {
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSignUp() {
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Check your Vite environment variables.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      setSuccessMessage('Account created. Check your email if confirmation is required.');
      setPassword('');
    } catch (error) {
      setErrorMessage(error.message || 'Could not create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignIn() {
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Check your Vite environment variables.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setSuccessMessage('Signed in successfully.');
      setPassword('');
    } catch (error) {
      setErrorMessage(error.message || 'Could not sign in. Check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (mode === 'sign-up') {
      await handleSignUp();
    } else {
      await handleSignIn();
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setErrorMessage('');
    setSuccessMessage('');
  }

  const isSignUp = mode === 'sign-up';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] px-5 py-12 text-[#202724]">
      <section className="w-full max-w-md rounded-lg border border-[#dce2dc] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#b34e35]">
            Research archive
          </p>
          <h1 className="font-serif text-3xl">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#59655f]">
            {isSignUp
              ? 'Join your research community and share paper summaries.'
              : 'Sign in to continue to your research library.'}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 border-b border-[#dce2dc]" role="tablist" aria-label="Account mode">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            onClick={() => changeMode('sign-in')}
            className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${
              !isSignUp
                ? 'border-[#176b58] text-[#176b58]'
                : 'border-transparent text-[#68746e] hover:text-[#303b35]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            onClick={() => changeMode('sign-up')}
            className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${
              isSignUp
                ? 'border-[#176b58] text-[#176b58]'
                : 'border-transparent text-[#68746e] hover:text-[#303b35]'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-sm font-semibold text-[#303b35]">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-[#cfd8d1] px-3 py-2.5 text-sm outline-none transition focus:border-[#176b58] focus:ring-2 focus:ring-[#176b5826]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-sm font-semibold text-[#303b35]">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              name="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-[#cfd8d1] px-3 py-2.5 text-sm outline-none transition focus:border-[#176b58] focus:ring-2 focus:ring-[#176b5826]"
              placeholder="At least 6 characters"
            />
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p role="status" className="rounded-md bg-[#eaf4ee] px-3 py-2 text-sm text-[#176b58]">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#176b58] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#105744] disabled:cursor-wait disabled:opacity-70"
          >
            {isSubmitting ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}