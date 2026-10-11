export function hasPartsContent(data) {
 return confirmedParts(data).length > 0;
}

export function confirmedParts(data) {
 return (Array.isArray(data?.parts) ? data.parts : []).filter(part =>
  typeof part?.name === 'string' && part.name.trim() &&
  typeof part?.number === 'string' && part.number.trim()
 );
}
