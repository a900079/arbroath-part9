// Preserve discipline grouping; do not inherit issue-specific responsibility allocations.
export const RESPONSIBILITY_REVIEW='new-property-no-inherited-review';
export function disciplines(issue,resolveLead){return [...new Set([resolveLead(issue),...(issue.owners||[])].filter(Boolean))];}
export function applyResponsibilityReview(state){return {state,changed:false,count:0};}


