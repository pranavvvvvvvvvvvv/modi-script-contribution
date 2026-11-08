import { useEffect, useState } from 'react';
import { groupPapersByDate } from './src/paperTimelineUtils.js';

function getAvatarLabel(fullName) {
  return fullName.charAt(0).toUpperCase() || '?';
}

export default function DailyActivityTimeline({ supabase, session, onReadMarked }) {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markAsReadError, setMarkAsReadError] = useState('');
  const [markingPaperIds, setMarkingPaperIds] = useState(() => new Set());
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [selectedPaper, setSelectedPaper] = useState(null);

  useEffect(() => {
    let isCurrent = true;

    if (!supabase) {
      setError('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
      setLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    async function fetchPapers() {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('papers')
        .select('*, team_users!papers_uploaded_by_fkey(full_name)')
        .order('created_at', { ascending: false });

      if (!isCurrent) return;

      if (queryError) {
        setError(queryError.message);
        setPapers([]);
      } else {
        setPapers(data ?? []);
      }
      setLoading(false);
    }

    fetchPapers();
    return () => {
      isCurrent = false;
    };
  }, [supabase]);

  async function handleToggleRead(targetPaper) {
    const userId = session?.user?.id;
    if (!targetPaper || !userId || !supabase || targetPaper.uploaded_by === userId) {
      setMarkAsReadError('Could not update this paper’s read status. Please try again.');
      return;
    }

    if (markingPaperIds.has(targetPaper.id)) return;

    const previousReadBy = targetPaper.read_by || [];
    const isRead = previousReadBy.includes(userId);
    const updatedReadBy = isRead
      ? previousReadBy.filter((id) => id !== userId)
      : Array.from(new Set([...previousReadBy, userId]));
    setMarkAsReadError('');
    setMarkingPaperIds((currentIds) => new Set(currentIds).add(targetPaper.id));
    setSelectedPaper((currentPaper) => (
      currentPaper?.id === targetPaper.id ? { ...currentPaper, read_by: updatedReadBy } : currentPaper
    ));
    setPapers((currentPapers) => currentPapers.map((currentPaper) => (
      currentPaper.id === targetPaper.id ? { ...currentPaper, read_by: updatedReadBy } : currentPaper
    )));

    try {
      const { data, error } = await supabase
        .from('papers')
        .update({ read_by: updatedReadBy })
        .eq('id', targetPaper.id)
        .select();

      if (error || !data || data.length === 0) {
        throw error || new Error('Failed to update read status. Check RLS policies.');
      }
      onReadMarked?.();
    } catch (updateError) {
      console.error('Failed to update read status - check RLS policies', updateError);
      setSelectedPaper((currentPaper) => (
        currentPaper?.id === targetPaper.id
          ? { ...currentPaper, read_by: previousReadBy }
          : currentPaper
      ));
      setPapers((currentPapers) => currentPapers.map((currentPaper) => (
        currentPaper.id === targetPaper.id
          ? { ...currentPaper, read_by: previousReadBy }
          : currentPaper
      )));
      setMarkAsReadError(updateError.message || 'Could not update this paper’s read status.');
    } finally {
      setMarkingPaperIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(targetPaper.id);
        return nextIds;
      });
    }
  }

  const groupedPapers = groupPapersByDate(papers);
  const dates = Object.keys(groupedPapers).sort(
    (a, b) => groupedPapers[b].latestTimestamp - groupedPapers[a].latestTimestamp,
  );

  if (loading) {
    return <p className="py-6 text-sm text-slate-500">Loading activity...</p>;
  }

  if (error) {
    return <p role="alert" className="py-6 text-sm text-red-700">Could not load activity: {error}</p>;
  }

  if (dates.length === 0) {
    return <p className="py-6 text-sm text-slate-500">No paper activity yet.</p>;
  }

  return (
    <>
      <ol className="space-y-0">
      {dates.map((date) => {
        const { uploaders, papers: dayPapers } = groupedPapers[date];
          const tooltipId = `papers-${groupedPapers[date].latestTimestamp}`;

        return (
          <li key={date} className="grid grid-cols-[minmax(4.5rem,0.8fr)_minmax(0,2fr)] gap-2 sm:grid-cols-[minmax(6rem,1fr)_minmax(0,2fr)] sm:gap-4">
            <time
              dateTime={new Date(groupedPapers[date].latestTimestamp).toISOString()}
              className="pt-1 text-right text-xs font-medium text-slate-700 sm:text-sm"
            >
              {date}
            </time>
            <div className="relative min-h-20 border-l border-slate-300 pb-6 pl-6">
              <span
                aria-hidden="true"
                className="absolute -left-1.25 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-600 ring-1 ring-teal-600"
              />
              <div className="relative inline-flex">
                <button
                  type="button"
                  aria-label={`Show papers added on ${date}`}
                  aria-controls={tooltipId}
                  aria-expanded={activeTooltip === date}
                  onClick={() => setActiveTooltip(activeTooltip === date ? null : date)}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#176b58]"
                >
                  <span className="flex pl-3" aria-label={`${uploaders.length} uploaders`}>
                    {uploaders.map((uploader) => (
                      <span
                        key={uploader.id}
                        title={uploader.fullName}
                        className="-ml-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white ring-2 ring-white first:ml-0"
                      >
                        {getAvatarLabel(uploader.fullName)}
                      </span>
                    ))}
                  </span>
                </button>
                {activeTooltip === date && (
                  <div
                    id={tooltipId}
                    role="dialog"
                    aria-label={`Papers added on ${date}`}
                    className="absolute left-0 top-full z-10 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-md bg-slate-900 p-2 text-sm text-white shadow-lg sm:max-w-80"
                  >
                    <ul className="space-y-1">
                      {dayPapers.map((paper) => (
                        <li key={paper.id}>
                          <div className="flex min-w-0 flex-col items-stretch gap-2 rounded px-2 py-2 hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between sm:py-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPaper(paper);
                                setActiveTooltip(null);
                              }}
                              className="min-w-0 flex-1 break-words text-left focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <span className="block break-words font-medium">{paper.title}</span>
                              <span className="block break-words text-xs text-slate-300">{paper.uploaderName}</span>
                            </button>
                            {paper.uploaded_by === session?.user?.id ? (
                              <span className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-xs font-semibold text-white">
                                Your Upload
                              </span>
                            ) : paper.read_by?.includes(session?.user?.id) ? (
                              <button
                                type="button"
                                onClick={() => handleToggleRead(paper)}
                                disabled={markingPaperIds.has(paper.id)}
                                className="min-h-10 shrink-0 self-start rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-60 sm:self-auto"
                              >
                                ✓ Read
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleRead(paper)}
                                disabled={!session?.user?.id || markingPaperIds.has(paper.id)}
                                className="min-h-10 shrink-0 self-start rounded border border-white/40 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60 sm:self-auto"
                              >
                                {markingPaperIds.has(paper.id) ? 'Saving...' : 'Mark'}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
      </ol>
      {markAsReadError && !selectedPaper && (
        <p role="alert" className="py-2 text-sm text-red-700">{markAsReadError}</p>
      )}
      {selectedPaper && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#17201dcc] p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPaper(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="timeline-paper-title"
            className="my-auto w-full max-w-xl rounded-lg bg-white p-4 shadow-2xl sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b34e35]">
                  Paper Details
                </p>
                <h2 id="timeline-paper-title" className="mt-2 break-words font-serif text-2xl text-[#202724]">
                  {selectedPaper.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPaper(null)}
                className="min-h-11 shrink-0 rounded-md border border-[#cfd8d1] px-3 py-2 text-sm font-semibold text-[#303b35] transition hover:bg-[#f1f4f1]"
              >
                Close
              </button>
            </div>

            <p className="mb-5 inline-flex max-w-full flex-wrap break-words rounded-full bg-[#eaf4ee] px-3 py-1.5 text-sm font-semibold text-[#176b58]">
              Translated by: {selectedPaper.uploaderName}
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
            <div className="flex flex-wrap items-center gap-3">
            {selectedPaper.uploaded_by === session?.user?.id ? (
              <span className="inline-flex min-h-11 items-center rounded-full bg-[#f1f4f1] px-4 py-2.5 text-sm font-semibold text-[#59655f]">
                Your Upload
              </span>
            ) : selectedPaper.read_by?.includes(session?.user?.id) ? (
              <button
                type="button"
                onClick={() => handleToggleRead(selectedPaper)}
                disabled={markingPaperIds.has(selectedPaper.id)}
                className="inline-flex min-h-11 rounded-md bg-[#eaf4ee] px-4 py-2.5 text-sm font-semibold text-[#176b58]"
              >
                {markingPaperIds.has(selectedPaper.id) ? 'Saving...' : '✓ Read'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleRead(selectedPaper)}
                disabled={markingPaperIds.has(selectedPaper.id)}
                className="inline-flex min-h-11 rounded-md border border-[#176b58] px-4 py-2.5 text-sm font-semibold text-[#176b58] transition hover:bg-[#eaf4ee]"
              >
                {markingPaperIds.has(selectedPaper.id) ? 'Saving...' : 'Mark as Read'}
              </button>
            )}
            {selectedPaper.pdf_url ? (
              <a
                href={selectedPaper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-md bg-[#176b58] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#105744]"
              >
                View PDF
              </a>
            ) : (
              <p className="text-sm text-[#68746e]">No PDF is available for this paper.</p>
            )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}