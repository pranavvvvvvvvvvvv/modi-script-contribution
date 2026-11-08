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
