// No legacy document exclusions are carried into the new project.
export const EXCLUDED_FILES=new Set();
export function isExcludedDocument(doc){return doc?.status==='排除重复/错放';}


