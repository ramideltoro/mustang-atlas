// Factory Shelby GT350/GT350R is fastback-only (Ford's 2015 GT350 technical
// specification body-style table). Scope only unequivocal article metadata,
// never a convertible branch, cross-reference or component inside body text.
const reviewedConvertible = {
 // Both complete rear-quarter-speaker procedures require convertible trim
 // removal with no coupe branch. Their generic titles omit that body scope.
 G1694055:'7dca6aa392209b0dad45f1a69e14d2d7b28e90ce7fdfc7b24b45bacfbf9211e5',
 G1693903:'7d0e1aa3a8e989bd1df222dbf8f4bc257359c7fa54c50429a8da1ff327462ac9',
};
export function factoryBodyEngines(row) {
 const title=String(row.title||''),section=String(row.section_title??row.section?.title??'');
 if (/\b(?:coupe|fastback)\b/i.test(title)) return [];
 if (/\bconvertible\b/i.test(title) || /^Convertible Top$/i.test(section.trim()) ||
     (reviewedConvertible[row.id] && reviewedConvertible[row.id]===(row.source_hash??row.sourceHash))) return ['2.3L','3.7L','5.0L'];
 return [];
}
