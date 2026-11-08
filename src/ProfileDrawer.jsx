import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';

const STORAGE_BUCKET = 'paper_pdfs';
const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

function getStorageFilePath(publicUrl) {
  const pathname = new URL(publicUrl).pathname;
  const prefixIndex = pathname.indexOf(PUBLIC_OBJECT_PREFIX);

  if (prefixIndex === -1) {
    throw new Error('The PDF URL is not a public paper_pdfs storage URL.');
  }

  return decodeURIComponent(pathname.slice(prefixIndex + PUBLIC_OBJECT_PREFIX.length));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  userId,
  session,
  readVersion,
  onDeleted,
}) {
  const [papers, setPapers] = useState([]);
  const [readPapers, setReadPapers] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [userName, setUserName] = useState(
    session?.user?.email?.split('@')[0] || session?.user?.email || '',
  );
  const [profileErrorMessage, setProfileErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('uploads');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRead, setIsLoadingRead] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [readErrorMessage, setReadErrorMessage] = useState('');
  const [userLookupError, setUserLookupError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    const email = session?.user?.email || '';
    const fallbackName = email.split('@')[0] || email;
    setUserName(fallbackName);
    setProfileErrorMessage('');

    async function fetchUserName() {
      if (!session?.user?.id) {
        setProfileErrorMessage('Could not load your profile name because your session is unavailable.');
        return;
      }

      if (!supabase) {
        return;
      }

      const { data, error } = await supabase
        .from('team_users')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isCurrent) return;

      if (error) setProfileErrorMessage(error.message);
      setUserName(data?.full_name?.trim() || fallbackName);
    }

    fetchUserName().catch((error) => {
      if (!isCurrent) return;
      setUserName(fallbackName);
      setProfileErrorMessage(error.message || 'Could not load your profile name.');
    });

    return () => {
      isCurrent = false;
    };
  }, [session?.user?.email, session?.user?.id]);

  useEffect(() => {
    let isCurrent = true;

    async function fetchPapers() {
      setIsLoading(true);
      setErrorMessage('');

      if (!supabase || !userId) {
        setErrorMessage('Your papers are unavailable until Supabase authentication is configured.');
        setIsLoading(false);
        return;
      }

      const [usersResult, papersResult] = await Promise.all([
        supabase.from('team_users').select('id, full_name'),
        supabase
        .from('papers')
        .select('id, title, created_at, pdf_url, read_by')
        .eq('uploaded_by', userId)
        .order('created_at', { ascending: false }),
      ]);

      if (!isCurrent) return;

      if (usersResult.error) {
        setUserLookupError(usersResult.error.message);
        setUsersById({});
      } else {
        setUsersById(Object.fromEntries(
          (usersResult.data ?? []).map((user) => [
            user.id,
            user.full_name?.trim() || 'Unknown user',
          ]),
        ));
        setUserLookupError('');
      }

      if (papersResult.error) {
        setErrorMessage(papersResult.error.message);
        setPapers([]);
      } else {
        setPapers(papersResult.data ?? []);
      }
      setIsLoading(false);
    }

    fetchPapers().catch((error) => {
      if (!isCurrent) return;
      setErrorMessage(error.message || 'Could not load your papers.');
      setPapers([]);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [userId]);

  useEffect(() => {
    if (activeTab !== 'read') return undefined;

    let isCurrent = true;

    async function fetchReadPapers() {
      setIsLoadingRead(true);
      setReadErrorMessage('');

      if (!supabase || !session?.user?.id) {
        setReadErrorMessage('Your reading history is unavailable until Supabase authentication is configured.');
        setReadPapers([]);
        setIsLoadingRead(false);
        return;
      }

      const { data, error } = await supabase
        .from('papers')
        .select('id, title, methodology, team_users!papers_uploaded_by_fkey(full_name)')
        .contains('read_by', [session.user.id]);

      if (!isCurrent) return;

      if (error) {
        setReadErrorMessage(error.message);
        setReadPapers([]);
      } else {
        setReadPapers(data ?? []);
      }
      setIsLoadingRead(false);
    }

    fetchReadPapers().catch((error) => {
      if (!isCurrent) return;
      setReadErrorMessage(error.message || 'Could not load your reading history.');
      setReadPapers([]);
      setIsLoadingRead(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [activeTab, readVersion, session?.user?.id]);

  async function handleDelete(paper) {
    if (!supabase || deletingId !== null) return;

    setDeletingId(paper.id);
    setErrorMessage('');

    try {
      if (paper.pdf_url) {
        const filePath = getStorageFilePath(paper.pdf_url);
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([filePath]);

        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase
        .from('papers')
        .delete()
        .eq('id', paper.id);

      if (deleteError) throw deleteError;

      setPapers((currentPapers) => currentPapers.filter((item) => item.id !== paper.id));
      onDeleted?.();
    } catch (error) {
      setErrorMessage(error.message || 'Could not delete this paper. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close profile drawer"
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-drawer-title"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] transform overflow-y-auto bg-white px-5 py-6 shadow-xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center gap-4 rounded-lg bg-[#eaf4ee] p-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#176b58] text-xl font-bold text-white"
          >
            {userName.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="wrap-break-word text-lg font-semibold text-[#202724]">{userName}</p>
            <p className="wrap-break-word text-sm text-[#59655f]">{session?.user?.email}</p>
          </div>
        </div>
        {profileErrorMessage && (
          <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Could not load your profile name: {profileErrorMessage}
          </p>
        )}
        <div className="mb-6 flex items-start justify-between border-b border-[#e2e8e3] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b34e35]">
              Research archive
            </p>
            <h2 id="profile-drawer-title" className="mt-2 font-serif text-2xl text-[#202724]">
              My Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#cfd8d1] px-3 py-2 text-sm font-semibold text-[#303b35] transition hover:bg-[#f1f4f1]"
          >
            Close
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-md bg-[#f1f4f1] p-1" role="tablist" aria-label="Profile paper lists">
          <button
            type="button"
            id="profile-uploads-tab"
            role="tab"
            aria-selected={activeTab === 'uploads'}
            aria-controls="profile-uploads-panel"
            onClick={() => setActiveTab('uploads')}
            className={`rounded px-2 py-2 text-sm font-semibold transition ${
              activeTab === 'uploads' ? 'bg-white text-[#176b58] shadow-sm' : 'text-[#59655f]'
            }`}
          >
            My Uploads
          </button>
          <button
            type="button"
            id="profile-read-tab"
            role="tab"
            aria-selected={activeTab === 'read'}
            aria-controls="profile-read-panel"
            onClick={() => setActiveTab('read')}
            className={`rounded px-2 py-2 text-sm font-semibold transition ${
              activeTab === 'read' ? 'bg-white text-[#176b58] shadow-sm' : 'text-[#59655f]'
            }`}
          >
            Papers I've Read
          </button>
        </div>

        {activeTab === 'uploads' ? (
          <section id="profile-uploads-panel" role="tabpanel" aria-labelledby="profile-uploads-tab">
            <h3 className="mb-1 text-sm font-semibold text-[#303b35]">My Uploads</h3>
            <p className="mb-3 text-sm text-[#68746e]">Papers you have contributed to the library.</p>

            {isLoading ? (
              <p className="py-4 text-sm text-[#68746e]">Loading your papers...</p>
            ) : (
              <div>
                {(errorMessage || userLookupError) && (
                  <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                    {[errorMessage, userLookupError].filter(Boolean).join(' ')}
                  </p>
                )}

                {papers.length === 0 && !errorMessage ? (
                  <p className="py-4 text-sm text-[#68746e]">You have not uploaded any papers yet.</p>
                ) : (
                  <ul className="divide-y divide-[#e2e8e3]">
                    {papers.map((paper) => {
                      const readers = Array.isArray(paper.read_by) ? paper.read_by : [];
                      const readerNames = readers.map((readerId) => usersById[readerId] || 'Unknown user');

                      return (
                        <li key={paper.id} className="flex flex-col gap-3 py-4">
                          <div className="min-w-0">
                            <h4 className="wrap-break-word text-sm font-semibold text-[#303b35]">
                              {paper.title || 'Untitled paper'}
                            </h4>
                            <time
                              dateTime={paper.created_at}
                              className="mt-1 block text-xs text-[#68746e]"
                            >
                              {formatDate(paper.created_at)}
                            </time>
                            <p className="mt-2 text-xs text-[#68746e]">
                              Read by: {readerNames.length > 0 ? readerNames.join(', ') : 'No reads yet'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(paper)}
                            disabled={deletingId !== null}
                            className="w-fit rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                          >
                            {deletingId === paper.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        ) : (
          <section id="profile-read-panel" role="tabpanel" aria-labelledby="profile-read-tab">
            <h3 className="mb-1 text-sm font-semibold text-[#303b35]">Papers I've Read</h3>
            <p className="mb-3 text-sm font-semibold text-[#176b58]">
              Total Read: {readPapers.length}
            </p>

            {readErrorMessage && (
              <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {readErrorMessage}
              </p>
            )}
            {isLoadingRead ? (
              <p className="py-4 text-sm text-[#68746e]">Loading your reading history...</p>
            ) : readPapers.length === 0 && !readErrorMessage ? (
              <p className="py-4 text-sm text-[#68746e]">You have not marked any papers as read yet.</p>
            ) : (
              <ul className="divide-y divide-[#e2e8e3]">
                {readPapers.map((paper) => {
                  const uploaderName = (
                    Array.isArray(paper.team_users)
                      ? paper.team_users[0]?.full_name
                      : paper.team_users?.full_name
                  )?.trim() || 'Pranav';

                  return (
                    <li key={paper.id} className="py-4">
                      <h4 className="wrap-break-word text-sm font-semibold text-[#303b35]">
                        {paper.title || 'Untitled paper'}
                      </h4>
                      <span className="mt-2 inline-flex rounded-full bg-[#eaf4ee] px-2.5 py-1 text-xs font-semibold text-[#176b58]">
                        Translated by {uploaderName}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </aside>
    </>
  );
}