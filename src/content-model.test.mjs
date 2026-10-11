import test from 'node:test';
import assert from 'node:assert/strict';
import {createTermMatcher,callout,readableTitle,safeHref,uniqueSources} from './content-model.mjs';
test('reader projection tolerates the initial loading and missing-document state',async()=>{const {readerBlocks}=await import('./content-model.mjs');assert.deepEqual(readerBlocks(undefined,null),[]);assert.deepEqual(readerBlocks([],null),[]);});
test('longest component alias links the pulley rather than the pump inside it',()=>{const match=createTermMatcher([{id:'pump',name:'coolant pump'},{id:'pulley',name:'coolant pump pulley'}]);const parts=match('Turn the coolant pump pulley, then inspect the coolant pump.');assert.deepEqual(parts.filter(part=>part.term).map(part=>part.term.id),['pulley','pump']);});
test('an unknown longer component protects against a misleading known substring',()=>{const match=createTermMatcher([{id:'pump',name:'coolant pump'},{id:'pulley',name:'coolant pump pulley',hasExplanation:false}]);assert.equal(match('coolant pump pulley').some(part=>part.term),false);});
test('shared term occurrence state avoids repeated links and honors word boundaries',()=>{const match=createTermMatcher([{id:'gear',name:'steering gear'}]);const seen=new Set();assert.equal(match('steering gearbox and steering gear',seen).filter(part=>part.term).length,1);assert.equal(match('steering gear',seen).filter(part=>part.term).length,0);});
test('ambiguous definitions and incompatible context do not receive an explanation link',()=>{const match=createTermMatcher([{id:'engine',name:'oil pump',matchCategories:['engine']},{id:'manual-clutch',name:'clutch disc',excludeSectionContains:['automatic']}],{system:'transmission',title:'Automatic transmission'});assert.equal(match('oil pump and clutch disc').some(part=>part.term),false);const ambiguous=createTermMatcher([{id:'one',name:'pump'},{id:'two',name:'pump'}]);assert.equal(ambiguous('pump').some(part=>part.term),false);});
test('hazard labels and their exact text remain intact',()=>{assert.deepEqual(callout('**WARNING:** Disconnect the battery.'),{kind:'warning',body:'Disconnect the battery.'});assert.deepEqual(callout('[!CAUTION]\nKeep the seal clean.'),{kind:'caution',body:'Keep the seal clean.'});assert.equal(callout('A note inside a normal sentence.'),null);});
test('overview and procedure titles retain useful system context',()=>{assert.equal(readableTitle('Description > Power Steering - Overview > Overview'),'Power Steering');assert.equal(readableTitle('Engine > Front Seal > Removal'),'Front Seal · Removal');});
test('source references deduplicate while untrusted link protocols stay inert',()=>{assert.equal(safeHref('javascript:alert(1)'),null);assert.equal(safeHref('//untrusted.test'),null);assert.equal(safeHref('#/document/one'),'#/document/one');assert.equal(uniqueSources([{page:1},{page:1},{page:2}]).length,2);});

test('source annotation is pure and repeatable, with first occurrence reset only at headings',async()=>{
 const {annotateSourceTerms}=await import('./content-model.mjs');
 const matcher=createTermMatcher([{id:'steering',name:'steering gear'}]);
 const original=[{id:'a',type:'paragraph',text:'The steering gear assists.'},{id:'b',type:'paragraph',text:'Inspect the steering gear.'},{id:'c',type:'heading',text:'Check it'},{id:'d',type:'paragraph',text:'Inspect the steering gear.'}];
 const first=annotateSourceTerms(original,matcher),second=annotateSourceTerms(original,matcher);
 assert.deepEqual(first,second);assert.equal(first[0].termParts.filter(part=>part.term).length,1);assert.equal(first[1].termParts.filter(part=>part.term).length,0);assert.equal(first[3].termParts.filter(part=>part.term).length,1);assert.equal(original[0].termParts,undefined);
});
test('Markdown annotation never nests term buttons inside links or code, and repeated renders retain links',async()=>{
 const {marked}=await import('marked');const {annotateMarkdownTerms}=await import('./content-model.mjs');const matcher=createTermMatcher([{id:'gear',name:'steering gear'}]);const tokens=marked.lexer('[steering gear](#/document/one) and `steering gear`.\n\nThe steering gear works.');const one=annotateMarkdownTerms(tokens,matcher,text=>marked.lexer(text)),two=annotateMarkdownTerms(tokens,matcher,text=>marked.lexer(text));assert.deepEqual(one,two);assert.equal(one[0].tokens[0].tokens[0].termParts,undefined);assert.equal(one.find(token=>token.text==='The steering gear works.').tokens[0].termParts.filter(part=>part.term).length,1);
});
test('source acronym expansions require their explicit uppercase form',()=>{const match=createTermMatcher([{id:'abbr-etc',name:'ETC',definition:'Electronic throttle control',editorial:{kind:'source-expansion'},hasExplanation:true}]);assert.equal(match('etc. is prose; ETC is an acronym.').filter(part=>part.term).length,1);});

test('authored acronym aliases are case-sensitive while full component names are not',()=>{
 const match=createTermMatcher([{id:'can',name:'Controller area network',aliases:['CAN']},{id:'dtc',name:'Diagnostic trouble code',aliases:['DTC','DTCs']}]);
 const parts=match('You can read CAN data. Controller Area Network is the same system. DTCs describe faults.');
 assert.equal(parts.filter(part=>part.term&&part.text==='can').length,0);
 assert.deepEqual(parts.filter(part=>part.term).map(part=>part.text),['CAN','DTCs']);
 const full=match('The controller AREA network is involved.');assert.equal(full.filter(part=>part.term).length,1);
});

test('source guide references become safe links without nested glossary controls',async()=>{
 const {annotateInlineSource,annotateSourceTerms}=await import('./content-model.mjs');
 const matcher=createTermMatcher([{id:'seal',name:'crankshaft front seal'}]);
 const text='Follow [Crankshaft Front Seal](#/document/G1685315), then inspect the crankshaft front seal.';
 const parts=annotateInlineSource(text,matcher);
 assert.deepEqual(parts.find(part=>part.href),{text:'Crankshaft Front Seal',href:'#/document/G1685315'});
 assert.equal(parts.find(part=>part.href).term,undefined);
 assert.equal(parts.filter(part=>part.term).length,1);
 const blocks=[{type:'step',id:'a',number:1,text,children:[{type:'safety',id:'b',severity:'note',text:'NOTE: Read [Wheel and Tire](#/document/G1).'}]},{type:'list',id:'c',items:[{type:'list-item',id:'d',text:'Use [Jack Setup](#/document/G2).',children:[]}]},{type:'table',id:'e',rows:[{cells:[{text:'See [Seal](#/document/G3).',blocks:[]}]}]}];
 const annotated=annotateSourceTerms(blocks,matcher);
 assert(annotated[0].termParts.some(part=>part.href));assert(annotated[0].children[0].termParts.some(part=>part.href));assert(annotated[1].items[0].termParts.some(part=>part.href));assert(annotated[2].rows[0].cells[0].termParts.some(part=>part.href));
 assert.deepEqual(annotated,annotateSourceTerms(blocks,matcher));assert.equal(blocks[0].text,text);
});
test('inline source rendering preserves ordinary technical text and rejects executable markup',async()=>{
 const {annotateInlineSource}=await import('./content-model.mjs');
 for(const text of ['Torque: 24 lb*ft (32 N*m).','<img src=x onerror=alert(1)>','`[literal](#/document/G1)`','[unsafe](javascript:alert(1))','[unsafe](data:text/html,content)','**source asterisks stay intact**']){
  const parts=annotateInlineSource(text);assert.equal(parts.map(part=>part.text).join(''),text);assert.equal(parts.some(part=>part.href),false);
 }
});

test('authored torque tables keep all four stages and surrounding instructions without changing source mode',async()=>{
 const {readerBlocks,annotateSourceTerms}=await import('./content-model.mjs');
 const text='Hold the pulley with the Strap Wrench.\n\n| Stage | Action |\n| --- | --- |\n| 1 | Tighten to 103 lb.ft (140 Nm) |\n| 2 | Loosen 360° |\n| 3 | Tighten to 74 lb.ft (100 Nm) |\n| 4 | Tighten a further 90° |\n\nFollow [Crankshaft Front Seal](#/document/G1685315), then inspect the crankshaft front seal.';
 const blocks=[{id:'G1685315-b00051',type:'step',number:6,text,children:[]}];
 const document={teachingStatus:'complete',kind:'repair'};
 const prepared=readerBlocks(blocks,document),rich=prepared[0].textBlocks;
 assert.deepEqual(rich.map(block=>block.type),['paragraph','table','paragraph']);
 assert.equal(rich[0].text,'Hold the pulley with the Strap Wrench.');
 assert.deepEqual(rich[1].rows.map(row=>row.cells.map(cell=>cell.text)),[['Stage','Action'],['1','Tighten to 103 lb.ft (140 Nm)'],['2','Loosen 360°'],['3','Tighten to 74 lb.ft (100 Nm)'],['4','Tighten a further 90°']]);
 assert(rich[1].rows[0].cells.every(cell=>cell.header));
 const annotated=annotateSourceTerms(prepared,createTermMatcher([{id:'seal',name:'crankshaft front seal'}]));
 const parts=annotated[0].textBlocks[2].termParts;
 assert.equal(parts.find(part=>part.href).term,undefined);assert.equal(parts.filter(part=>part.term).length,1);
 assert.deepEqual(annotated,annotateSourceTerms(prepared,createTermMatcher([{id:'seal',name:'crankshaft front seal'}])));
 assert.equal(readerBlocks(blocks,document,'source'),blocks);
 assert.equal(readerBlocks(blocks,{teachingStatus:'source'})[0].textBlocks,undefined);
 assert.equal(blocks[0].text,text);assert.equal(blocks[0].textBlocks,undefined);
});
test('authored lists preserve explicit numbering, nested lists and literal technical syntax',async()=>{
 const {guideTextBlocks}=await import('./content-model.mjs');
 const rich=guideTextBlocks('Before.\n\n3. Use 24 lb*ft (32 N*m).\n5. Inspect the part.\n   - Keep <tool> literal.\n\nAfter.');
 assert.equal(rich[0].text,'Before.');assert.equal(rich[1].start,3);
 assert.deepEqual(rich[1].items.map(item=>item.number),[3,5]);
 assert.equal(rich[1].items[0].children[0].text,'Use 24 lb*ft (32 N*m).');
 assert.equal(rich[1].items[1].children[1].items[0].children[0].text,'Keep <tool> literal.');
 assert.equal(rich.at(-1).text,'After.');
 assert.equal(guideTextBlocks('Use 24 lb*ft (32 N*m), **source asterisks**, and <tool>.'),null);
});
test('wiring PDF text runs collapse only in Atlas reader, never real pin tables',async()=>{
 const {readerBlocks}=await import('./content-model.mjs');
 const labels={id:'labels',type:'table',rows:['BN-VT','RMP19','12','C2123'].map(text=>({cells:[{text,header:false,colSpan:1,rowSpan:1,blocks:[]}]}))};
 const wiring={kind:'wiring',source:{reference:'ECAD EFB132001'}};
 const shown=readerBlocks([labels],wiring)[0];assert.equal(shown.diagramLabels,true);assert.deepEqual(shown.rows,labels.rows);
 assert.equal(readerBlocks([labels],wiring,'source')[0].diagramLabels,undefined);
 assert.equal(readerBlocks([labels],{kind:'connector'})[0].diagramLabels,undefined);
 assert.equal(readerBlocks([{...labels,rows:[{cells:[{text:'Cavity'},{text:'Circuit Number'}]}]}],wiring)[0].diagramLabels,undefined);
});
test('connector presentation hides export layout only and gives recognized pin columns headers',async()=>{
 const {readerBlocks,documentTitle}=await import('./content-model.mjs');
 const metadata={id:'metadata',type:'table',rows:[['Box','s1'],['Cols','2'],['CNumber','C100'],['Gender','FEMALE'],['Color','BK'],['Pin Count','2'],['Kit List','984'],['Title Mnemonic','Connector:']].map(([key,value])=>({cells:[{text:key,header:true,blocks:[]},{text:value,header:false,blocks:[]}]}))};
 const pins={id:'pins',type:'table',rows:[{cells:['Cavity','Circuit Number','Color','Gauge','Function','Qualifier','Used','Terminal Part Number'].map(text=>({text,header:false,blocks:[]}))},{cells:['1','ABC','BK','0.5','Power','','Yes','P1'].map(text=>({text,header:false,blocks:[]}))}]};
 const blocks=[metadata,pins],document={kind:'connector',title:'C100 — AIR CONDITIONING (A/C) CLUTCH AND FIELD COIL'};
 const rendered=readerBlocks(blocks,document);
 assert.deepEqual(rendered[0].rows.map(row=>row.cells[0].text),['CNumber','Gender','Color','Pin Count','Kit List']);
 assert(rendered[1].rows[0].cells.every(cell=>cell.header));assert(rendered[1].rows[1].cells.every(cell=>!cell.header));
 assert.equal(readerBlocks(blocks,document,'source'),blocks);assert.equal(pins.rows[0].cells[0].header,false);
 assert.equal(documentTitle(document),'C100 — Air Conditioning (A/C) Clutch And Field Coil');
});
