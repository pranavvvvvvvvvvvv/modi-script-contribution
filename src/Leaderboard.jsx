import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';

export function rankPaperContributors(papers) {
  const contributorsById = papers.reduce((contributors, paper) => {
    if (!paper.uploaded_by) return contributors;

    const name = (
      Array.isArray(paper.team_users)
        ? paper.team_users[0]?.full_name
        : paper.team_users?.full_name
    )?.trim() || 'Team Member';
    const id = paper.uploaded_by;
    const contributor = contributors.get(id) || { id, name, paperCount: 0 };

    contributor.paperCount += 1;
    contributor.name = name;
    contributors.set(id, contributor);
    return contributors;
  }, new Map());

  return Array.from(contributorsById.values())
    .sort((a, b) => b.paperCount - a.paperCount || a.name.localeCompare(b.name));
}

export default function Leaderboard() {
  const [contributors, setContributors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function fetchLeaderboard() {
      if (!supabase) {
        setErrorMessage('Supabase is not configured. Check your Vite environment variables.');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('papers')
        .select('*, team_users!papers_uploaded_by_fkey(full_name)');

      if (!isCurrent) return;

      if (error) {
        setErrorMessage(error.message);
      } else {
        setContributors(rankPaperContributors(data ?? []));
      }
      setIsLoading(false);
    }

    fetchLeaderboard().catch((error) => {
      if (!isCurrent) return;
      setErrorMessage(error.message || 'Could not load the leaderboard.');
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="mt-10 border-t border-[#cfd8d1] pt-7" aria-labelledby="leaderboard-title">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b34e35]">
          Team activity
        </p>
        <h2 id="leaderboard-title" className="mt-2 font-serif text-2xl text-[#202724]">
          Paper leaderboard
        </h2>
      </div>

      {isLoading ? (
        <p className="py-4 text-sm text-[#68746e]">Loading team rankings...</p>
      ) : errorMessage ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage}
        </p>
      ) : contributors.length === 0 ? (
        <p className="py-4 text-sm text-[#68746e]">No paper contributions to rank yet.</p>
      ) : (
        <ol className="divide-y divide-[#e2e8e3]">
          {contributors.map((contributor, index) => {
            const isFirst = index === 0;

            return (
              <li
                key={contributor.id}
                className={`flex items-center justify-between gap-4 py-3 ${isFirst ? 'text-amber-800' : 'text-[#303b35]'}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-label={`Rank ${index + 1}`}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      isFirst ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-[#edf3ef] text-[#59655f]'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`truncate text-sm font-semibold ${isFirst ? 'text-amber-800' : ''}`}>
                    {contributor.name}
                  </span>
                  {isFirst && (
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Top contributor
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-sm text-[#68746e]">
                  {contributor.paperCount} {contributor.paperCount === 1 ? 'paper' : 'papers'}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}