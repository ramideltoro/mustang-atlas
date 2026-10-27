import fs from 'node:fs';
import crypto from 'node:crypto';
export function hasWorkshopSupervision(guide, maps){
  const hash=crypto.createHash('sha256').update(JSON.stringify(guide)).digest('hex');
  return maps.some(map=>map[guide.id]?.approved===true&&map[guide.id]?.guideHash===hash);
}
export function workshopReady(guide){
  const paths=['work/editorial-workshop/supervisory-approvals.json','work/editorial-workshop-care/supervisory-approvals.json'];
  return hasWorkshopSupervision(guide,paths.map(p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):{}));
}
