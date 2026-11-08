import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';

export default function PaperClaimer({ session, onReadMarked }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [markAsReadError, setMarkAsReadError] = useState('');
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);

  useEffect(() => {
    const searchTerm = query.trim().toLowerCase();
    if (!searchTerm) {
      setMatches([]);
      setHasSearched(false);
      setIsSearching(false);
      setErrorMessage('');
      return undefined;
    }

    let isCurrent = true;
    setIsSearching(true);
    setErrorMessage('');

    const timeoutId = setTimeout(async () => {
      if (!supabase) {
        if (isCurrent) {
          setMatches([]);
          setHasSearched(false);
          setErrorMessage('Supabase is not configured. Check your Vite environment variables.');
          setIsSearching(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('papers')
        .select('*, team_users!papers_uploaded_by_fkey(full_name)')
        .ilike('title', `%${searchTerm}%`);

      if (!isCurrent) return;

      if (error) {
        setMatches([]);
        setHasSearched(false);
        setErrorMessage(error.message);
      } else {
        setMatches((data ?? []).map((paper) => {
          const joinedUploaderName = (
            Array.isArray(paper.team_users)
              ? paper.team_users[0]?.full_name
              : paper.team_users?.full_name
          )?.trim();
          const uploaderName = joinedUploaderName || 'Team Member';

          return {
            id: paper.id,
            uploaded_by: paper.uploaded_by,
            title: paper.title || 'Untitled paper',
            methodology: paper.methodology || 'No methodology summary is available.',
            pdfUrl: paper.pdf_url,
            read_by: paper.read_by || [],
            uploader: uploaderName,
          };
        }));
        setHasSearched(true);
      }
      setIsSearching(false);
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timeoutId);
    };
  }, [query]);

  const hasMatches = matches.length > 0;

  async function handleToggleRead() {
    const userId = session?.user?.id;
    if (!selectedPaper || !userId || !supabase || selectedPaper.uploaded_by === userId) {
      setMarkAsReadError('Could not update this paper’s read status. Please try again.');
      return;
    }

    if (isMarkingAsRead) return;

    const previousReadBy = selectedPaper.read_by || [];
    const isRead = previousReadBy.includes(userId);
    const updatedReadBy = isRead
      ? previousReadBy.filter((id) => id !== userId)
      : Array.from(new Set([...previousReadBy, userId]));
    setMarkAsReadError('');
    setIsMarkingAsRead(true);
    setSelectedPaper({ ...selectedPaper, read_by: updatedReadBy });
    setMatches((currentMatches) => currentMatches.map((paper) => (
      paper.id === selectedPaper.id ? { ...paper, read_by: updatedReadBy } : paper
    )));

    try {
      const { data, error } = await supabase
        .from('papers')
        .update({ read_by: updatedReadBy })
        .eq('id', selectedPaper.id)
        .select();

      if (error || !data || data.length === 0) {
        throw error || new Error('Failed to update read status. Check RLS policies.');
      }
      onReadMarked?.();
    } catch (updateError) {
      console.error('Failed to update read status - check RLS policies', updateError);
      setSelectedPaper((paper) => (
        paper?.id === selectedPaper.id
          ? { ...paper, read_by: previousReadBy }
          : paper
      ));
      setMatches((currentMatches) => currentMatches.map((paper) => (
        paper.id === selectedPaper.id
          ? { ...paper, read_by: previousReadBy }
          : paper
      )));
      setMarkAsReadError(updateError.message || 'Could not update this paper’s read status.');
    } finally {
      setIsMarkingAsRead(false);
    }
  }

  if (selectedPaper) {
    return (
      <section className="mb-8 max-w-2xl rounded-md border border-[#dce2dc] bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b34e35]">
              Paper Details
            </p>
            <h2 className="mt-2 font-serif text-2xl text-[#202724]">{selectedPaper.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPaper(null)}
            className="rounded-md border border-[#cfd8d1] px-3 py-2 text-sm font-semibold text-[#303b35] transition hover:bg-[#f1f4f1]"
          >
            Close
          </button>
        </div>

        <p className="mb-5 inline-flex rounded-full bg-[#eaf4ee] px-3 py-1.5 text-sm font-semibold text-[#176b58]">
          Translated by: {selectedPaper.uploader}
        </p>

        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-[#303b35]">Methodology</h3>
          <p className="whitespace-pre-line text-sm leading-6 text-[#59655f]">
            {selectedPaper.methodology}
          </p>
        </div>

        {markAsReadError && (
          <p role="alert" className="mb-4 text-sm text-red-700">{markAsReadError}</p>
        )}
        {selectedPaper.uploaded_by === session?.user?.id ? (
          <span className="mr-3 inline-flex rounded-full bg-[#f1f4f1] px-4 py-2.5 text-sm font-semibold text-[#59655f]">
            Your Upload
          </span>
        ) : selectedPaper.read_by?.includes(session?.user?.id) ? (
          <button
            type="button"
            onClick={handleToggleRead}
            disabled={isMarkingAsRead}
            className="mr-3 inline-flex rounded-md bg-[#eaf4ee] px-4 py-2.5 text-sm font-semibold text-[#176b58] disabled:opacity-60"
          >
            {isMarkingAsRead ? 'Saving...' : '✓ Read'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleRead}
            disabled={isMarkingAsRead}
            className="mr-3 inline-flex rounded-md border border-[#176b58] px-4 py-2.5 text-sm font-semibold text-[#176b58] transition hover:bg-[#eaf4ee]"
          >
            {isMarkingAsRead ? 'Saving...' : 'Mark as Read'}
          </button>
        )}
        {selectedPaper.pdfUrl ? (
          <a
            href={selectedPaper.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md bg-[#176b58] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#105744]"
          >
            View PDF
          </a>
        ) : (
          <p className="text-sm text-[#68746e]">No PDF is available for this paper.</p>
        )}
      </section>
    );
  }

  return (
    <section className="mb-8 max-w-2xl" aria-labelledby="paper-check-title">
      <label
        id="paper-check-title"
        htmlFor="paper-title-search"
        className="mb-2 block text-sm font-semibold text-[#303b35]"
      >
        Check the library for an existing paper
      </label>
      <input
        id="paper-title-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by paper title"
        autoComplete="off"
        aria-controls="paper-search-results"
        aria-expanded={hasSearched && hasMatches}
        className="w-full rounded-md border border-[#cfd8d1] bg-white px-4 py-3 text-sm text-[#202724] outline-none transition placeholder:text-[#89938d] focus:border-[#176b58] focus:ring-2 focus:ring-[#176b5826]"
      />

      {isSearching && (
        <p className="mt-2 text-sm text-[#68746e]" role="status">Checking the library...</p>
      )}

      {errorMessage && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      )}

      {!isSearching && !errorMessage && hasSearched && hasMatches && (
        <ul
          id="paper-search-results"
          className="mt-2 max-h-72 overflow-y-auto rounded-md border border-[#dce2dc] bg-white shadow-sm"
        >
          {matches.map((match, index) => (
            <li
              key={`${match.title}-${match.uploader}-${index}`}
              className="border-b border-[#e8ece8] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setSelectedPaper(match)}
                className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-[#f8faf8] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium text-[#303b35]">{match.title}</span>
                <span className="w-fit rounded-full bg-[#fff1e8] px-2.5 py-1 text-xs font-semibold text-[#9c492f]">
                  Already uploaded by {match.uploader}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isSearching && !errorMessage && hasSearched && !hasMatches && (
        <p className="mt-2 rounded-md bg-[#eaf4ee] px-3 py-2.5 text-sm font-medium text-[#176b58]" role="status">
          Clear to research! No collisions found.
        </p>
      )}
    </section>
  );
}