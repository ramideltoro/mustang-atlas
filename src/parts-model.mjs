export function hasPartsContent(data) {
 return ['parts', 'identifiers', 'diagrams'].some(key => Array.isArray(data?.[key]) && data[key].length > 0);
}
