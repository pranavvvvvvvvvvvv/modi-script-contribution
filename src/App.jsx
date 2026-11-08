import { useEffect, useState } from 'react';
import DailyActivityTimeline from '../DailyActivityTimeline.jsx';
import { supabase } from './supabaseClient.js';
import AuthPage from './AuthPage.jsx';
import Leaderboard from './Leaderboard.jsx';
import PaperClaimer from './PaperClaimer.jsx';
import ProfileDrawer from './ProfileDrawer.jsx';
import UploadModal from './UploadModal.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [readingVersion, setReadingVersion] = useState(0);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setIsSessionLoading(false);
      return undefined;
    }

    let isMounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setIsSessionLoading(false);
        setAuthError('');
      }
    });

    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (!isMounted) return;
      setSession(currentSession);
      setIsSessionLoading(false);
      if (error) setAuthError(error.message);
    }).catch((error) => {
      if (!isMounted) return;
      setIsSessionLoading(false);
      setAuthError(error.message || 'Could not load your session.');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  }

  if (isSessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] text-sm text-[#59655f]">
        Loading your session...
      </main>
    );
  }

  if (!session) return <AuthPage />;

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#202724]">
      <header className="border-b border-[#dce2dc] bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
          <a href="/" className="flex min-w-0 items-center gap-3" aria-label="Research archive home">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#176b58] text-sm font-bold text-white">
              R
            </span>
            <span className="truncate text-sm font-semibold tracking-wide">RESEARCH ARCHIVE</span>
          </a>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden text-xs font-medium uppercase tracking-wider text-[#68746e] sm:inline">
              Shared library
            </span>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="min-h-11 flex-1 rounded-md bg-[#176b58] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#105744] sm:flex-none sm:px-4"
            >
              Upload paper
            </button>
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="min-h-11 flex-1 rounded-md border border-[#cfd8d1] px-3 py-2.5 text-sm font-semibold text-[#303b35] transition hover:bg-[#f1f4f1] sm:flex-none sm:px-4"
            >
              My Profile
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-11 flex-1 rounded-md border border-[#cfd8d1] px-3 py-2.5 text-sm font-semibold text-[#303b35] transition hover:bg-[#f1f4f1] sm:flex-none sm:px-4"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-8 sm:pb-16 sm:pt-16">
        {authError && (
          <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {authError}
          </p>
        )}
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#b34e35]">
            Paper contributions
          </p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            Research activity
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#59655f]">
            A day-by-day record of papers added to the shared library.
          </p>
        </div>

        <PaperClaimer
          session={session}
          onReadMarked={() => setReadingVersion((version) => version + 1)}
        />

        <div className="border-t border-[#cfd8d1] pt-7">
          <DailyActivityTimeline
            key={timelineVersion}
            supabase={supabase}
            session={session}
            onReadMarked={() => setReadingVersion((version) => version + 1)}
          />
        </div>

        <Leaderboard />

      </section>
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={session.user.id}
        session={session}
        readVersion={readingVersion}
        onDeleted={() => setTimelineVersion((version) => version + 1)}
      />
      {isUploadOpen && (
        <UploadModal
          session={session}
          onClose={() => setIsUploadOpen(false)}
          onUploaded={() => setTimelineVersion((version) => version + 1)}
        />
      )}
    </main>
  );
}