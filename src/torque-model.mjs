export const uncorrected = new Set(['15degext','90degcrow','90degext','90degstraight']);
export const brands = ['Cornwell','Gear Wrench','Matco','MAC','Snap-On'];
export const moonDimensions = [[4.491,1.1614],[5.03,1.908],[4.372,1.547],[4.875,1.678],[4.491,1.614],[5.09,1.759],[5.412,2.275],[5.752,2.602],[4.418,1.63],[5.08,1.808]];
export const moonLengths = {18:[9.5,14.5],23:[14.5,15],46:[14.5,15]};
export const isMoon = type => ['180degmoonleft','180degmoonright'].includes(type);
const positive = values => values.every(value=>Number.isFinite(value)&&value>0);
const result = lbft => ({lbft:Math.round(lbft),lbin:Math.round(lbft*12),nm:Math.round(lbft*1.355)});
export function calculateTorque({type,torque,torqueUnit='lbft',length,adapter,lengthUnit='in',adapterUnit='in',brandIndex}) {
 if(uncorrected.has(type))return null;
 if(isMoon(type)) {
  if(brandIndex===undefined||brandIndex===null||brandIndex==='')throw Error('Choose a supported torque, wrench length and adapter.');
  const s=Number(torque),l=Number(length),i=Number(brandIndex);
  if(!moonLengths[s]?.includes(l)||!Number.isInteger(i)||i<0||i>=moonDimensions.length||s===18&&i%2!==0)throw Error('Choose a supported torque, wrench length and adapter.');
  const [a,h]=moonDimensions[i],b=Math.floor(i/2)+1,r=type==='180degmoonleft'?2:1;
  const setting=24.3443-6.6043*l-2.352*r-6.0915*b+43.747*h-2.6545*a+0.2409*s+0.229*l*l+0.0989*b*b+19.8224*h*h+3.3372*a*a-0.0016*s*s+0.2908*l*h+0.0358*l*s-0.0931*r*b-1.8557*r*h+1.2903*r*a-0.0181*r*s-1.562*b*h+1.922*b*a-0.0291*b*s-22.685*h*a+0.0451*a*s;
  if(!positive([setting]))throw Error('This combination does not produce a usable setting.');
  return result(setting);
 }
 if(!['180degstraight','180degstraightwext','180degcrow','0degstraightwext'].includes(type))throw Error('Unsupported adapter arrangement.');
 const torqueFactors={lbft:1,lbin:12,nm:1.355},lengthFactors={in:1,mm:25.4};
 const t=Number(torque)/torqueFactors[torqueUnit],a=Number(length)/lengthFactors[lengthUnit],b=Number(adapter)/lengthFactors[adapterUnit];
 if(!positive([t,a,b]))throw Error('Enter a positive torque and both measured lengths.');
 const effective=a+(type==='0degstraightwext'?-b:b);
 if(effective<=0)throw Error('For this arrangement, the adapter must be shorter than the wrench.');
 return result(t*a/effective);
}
