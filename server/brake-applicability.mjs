// Factory applications only. The 2015 Mustang press kit identifies the front
// 2-piston base brakes, 4-piston EcoBoost Performance Package/GT brakes, and
// 6-piston GT Performance Package brakes. Shelby's SVT package is distinct.
// Never infer front fitment from a rear caliper's piston count or body text.
const frontPackages = {2:['2.3L','3.7L'],4:['2.3L','5.0L'],6:['5.0L']};
const baseEngines = ['2.3L','3.7L','5.0L'];
// These unqualified articles were reviewed against their separate SVT
// counterparts. The hashes prevent a future changed procedure inheriting the
// review. General diagnostics and specifications intentionally remain shared.
const reviewedBase = {
 G1693782:{hash:'a2e2d71958c3640f11598ec511b30d29824af074f530461d556296db137525f8',engines:frontPackages[2]},
 G1693784:{hash:'9249ad74482b718dd4a5dd6df7a2f5883b829920530621d8e4bd2f1c1b39a375'},
 G1693785:{hash:'258dfb25a916a2fb6e4011055118eecacefc0e351f01aff591c62ef595942fc9'},
 G1693794:{hash:'9b33e5438a1d56dcda650bbf49fdb315c5e4a13a51542fccb956a5ea7a48cc64'},
 G1693752:{hash:'05b943efd6c901d99f02b6f6e159ddeb0572fd0feed6b17c60cdb3713652ccaf'},
 G1693753:{hash:'1acd31939417fc7c69894b85875c270fa3603ebb64bbc9ec75506d4a1920e15d'},
 G1693754:{hash:'591c9c4b082fb959fc9b3a5cec8f1ec1b5c45ed8923b05283e3f6810198ee350'},
 G1693755:{hash:'29549eb95aecb616a1dc5a21463da0f3aa667505e6e929ab32e6c7e299930328'},
 G1693756:{hash:'338c06c1e57ba55ac08a0034acd4309c801570ed4f16e8018e452a7da638f752'},
 G1693757:{hash:'1e867e789ba609a259cf041280ea63cfbb742e11ddb21bae2d79e5b0fc714912'},
 // These operate levers on the base rear calipers. SVT uses separate parking
 // shoes (G1717972) and wheel-drag cable adjustment (G1820640).
 G1693765:{hash:'958e1ebda4857414c237e995250ecf14dd25fa34646d796c034850f8b1f3552c'},
 G1693766:{hash:'410254a1c802fdd37039dcd58279738294ca4addc027f71d57605deb3901cfc6'},
 G1694515:{hash:'433cf243530c97af0172233162e999c7dad493c911f2bb9aeef66e79e7bd5c7a'},
 G1694516:{hash:'c040cbee9cf70d59aab23e55556d86e108cb3a742053a5864eb7fec7ff6ee2c0'},
};
export function factoryBrakeEngines(row) {
 const code=row.section_code??row.section?.code,title=row.title||'';
 if(!['206-03','206-04','206-05'].includes(code))return [];
 if(/\bVehicles With:\s*SVT Performance Package\b/i.test(title))return ['5.2L'];
 const count=code==='206-03'&&title.match(/\bVehicles With:\s*([246])[-\s]Piston Brake Caliper\b/i)?.[1];
 if(count)return [...frontPackages[count]];
 const reviewed=reviewedBase[row.id];
 return reviewed&&reviewed.hash===(row.source_hash??row.sourceHash)?[...(reviewed.engines||baseEngines)]:[];
}
