// Explicitly reviewed same-task matches. A merely related repair link is not
// sufficient to claim that an existing inspection guide explains that repair.
export const existingTaskCoverage={
 'G1692052':'automatic-fluid','G1692033':'automatic-fluid','G1692053':'automatic-level',
 'G1687327':'manual-fluid','G1687328':'manual-fluid',
 'G2214742':'axle-fluid','G2214894':'axle-fluid',
 'G1676759':'cabin-filter',
 'G1673189':'spark-plugs','G1675559':'spark-plugs','G1675575':'spark-plugs',
 'G1688219':'accessory-belts','G1688121':'accessory-belts','G1688132':'accessory-belts',
 'G1673124':'coolant-change','G1694549':'coolant-change','G1694583':'coolant-change',
 'G2361881':'brake-pressure-bleeding','G1694693':'brake-pressure-bleeding',
 'G1704358':'clutch-hydraulic-bleeding',
 'G1692355':'battery-testing-charging','G1692356':'battery-testing-charging','G1692362':'battery-testing-charging',
 'G1692357':'battery-drain-diagnosis',
 'G1912355':'ac-odor-treatment',
 'G1676871':'ac-performance-leak-testing','G1676873':'ac-performance-leak-testing','G1676875':'ac-performance-leak-testing','G1912321':'ac-performance-leak-testing',
 'G1675715':'ecoboost-charge-air-cooler-cleaning',
 'G1686504':'wheel-tire-runout-matching','G1686505':'wheel-tire-runout-matching',
 'G2214729':'driveline-vibration-runout','G2214730':'driveline-vibration-runout',
 'G1694306':'transmission-cooler-backflush',
 'G1687508':'corrosion-protection',
};
export function reusableCoverage(d,existing,scope){const id=existingTaskCoverage[d.id],g=existing.find(g=>g.id===id);if(!g?.sourceRefs?.some(r=>r.documentId===d.id&&r.sourceHash===d.source_hash))return null;const engines=scope.filter(e=>g.applicability.engines.includes(e));return engines.length?{documentId:d.id,guideId:g.id,engines,reason:'Existing guide explains this practical task for its stated engines; remaining variants stay in the authoring queue.'}:null;}
