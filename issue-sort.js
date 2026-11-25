export const ISSUE_SORT_MODES = ['newest', 'oldest', 'lead'];

// Only creation fields count. Editing, commenting and reassignment do not.
export function issueCreatedTime(issue) {
  for (const value of [issue.reportedAt, issue.createdAt, issue.created_at]) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const time = Date.parse(value);
    if (Number.isFinite(time)) return time;
  }
  return null;
}

export function sortIssues(items, allIssues, mode, group, getLead) {
  const indices = new Map(allIssues.map((issue, index) => [issue.id, index]));
  return [...items].sort((a, b) => {
    if (mode === 'lead') {
      const roleOrder = Number(getLead(b) === group) - Number(getLead(a) === group);
      return roleOrder || indices.get(a.id) - indices.get(b.id);
    }
    const aTime = issueCreatedTime(a), bTime = issueCreatedTime(b);
    // Undated legacy items precede dated items in oldest mode, and follow
    // them in newest mode. Preserve their original import order.
    if (aTime === null && bTime === null) return indices.get(a.id) - indices.get(b.id);
    if (aTime === null) return mode === 'oldest' ? -1 : 1;
    if (bTime === null) return mode === 'oldest' ? 1 : -1;
    return (mode === 'oldest' ? aTime - bTime : bTime - aTime)
      || indices.get(a.id) - indices.get(b.id);
  });
}

