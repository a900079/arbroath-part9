export function belongsToDiscipline(issue,discipline,includeSupporting,lead,involved){
  return lead(issue)===discipline || (includeSupporting && involved(issue).includes(discipline));
}

