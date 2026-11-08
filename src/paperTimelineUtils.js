export function groupPapersByDate(papers) {
  return papers.reduce((groups, paper) => {
    const timestamp = new Date(paper.created_at);
    if (Number.isNaN(timestamp.getTime())) return groups;

    const date = timestamp.toLocaleDateString(undefined, {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const uploaderId = paper.uploaded_by ?? 'unknown';
    const joinedUploaderName = (
      Array.isArray(paper.team_users)
        ? paper.team_users[0]?.full_name
        : paper.team_users?.full_name
    )?.trim();
    const uploaderName = joinedUploaderName || 'Team Member';

    if (!groups[date]) {
      groups[date] = { uploaders: [], papers: [], latestTimestamp: timestamp.getTime() };
    }
    groups[date].latestTimestamp = Math.max(groups[date].latestTimestamp, timestamp.getTime());

    if (!groups[date].uploaders.some((item) => item.id === uploaderId)) {
      groups[date].uploaders.push({ id: uploaderId, fullName: uploaderName });
    }

    groups[date].papers.push({
      id: paper.id,
      uploaded_by: paper.uploaded_by,
      title: paper.title || 'Untitled paper',
      methodology: paper.methodology || 'No methodology summary is available.',
      pdf_url: paper.pdf_url,
      read_by: paper.read_by || [],
      uploaderName,
    });
    return groups;
  }, {});
}
