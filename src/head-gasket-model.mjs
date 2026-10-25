// Installation step 2, 303-01B LH/RH heads. Positions follow each published view.
// Independent schematic: the LH front is left; the RH front is right.
export const HEAD_BOLT_ROWS=[[8,4,2,6],[7,3,1,5]];
export const HEAD_BOLT_STAGES=[
 {id:1,value:'20 Nm',secondary:'177 lb-in',instruction:'Complete the first torque pass through bolts 1–8.'},
 {id:2,value:'35 Nm',secondary:'26 lb-ft',instruction:'Complete the second torque pass through bolts 1–8.'},
 {id:3,value:'+90°',secondary:'Quarter-turn',instruction:'Add 90° to each bolt, working through bolts 1–8.'},
 {id:4,value:'+90°',secondary:'Another quarter-turn',instruction:'Make a separate second 90° pass through bolts 1–8.'},
 {id:5,value:'+45°',secondary:'Eighth-turn',instruction:'Finish with a separate 45° pass through bolts 1–8.'},
];
export const HEAD_BANKS={lh:{name:'Left head',front:'left',documentId:'G1681515',figure:'E184550'},rh:{name:'Right head',front:'right',documentId:'G1681516',figure:'E184547'}};
