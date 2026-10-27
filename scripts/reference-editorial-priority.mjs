// Reference maps/tables usually have self-contained evidence. Practical writers
// continue repairs in parallel; this priority never drops or splits a document.
export function referenceKindPriority(kind){return ({overview:0,connector:1,specifications:2,general:3,repair:4,diagnosis:5,wiring:6})[kind]??7;}
