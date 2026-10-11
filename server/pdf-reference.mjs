import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {hash,saveAsset,normalize} from './parser.mjs';
export async function parsePdfReference(bytes,{id,title,dataDir,reference=id}){
 const pdf=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false}).promise;
 const blocks=[],media=[],texts=[];
 try{for(let p=1;p<=pdf.numPages;p++){
  const page=await pdf.getPage(p);const viewport=page.getViewport({scale:1.7});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  const asset=await saveAsset(await canvas.encode('webp',90),'image/webp',dataDir);const m={id:`${id}-m${String(p).padStart(4,'0')}`,...asset,caption:`${title} — original PDF page ${p}`,sourcePage:p};media.push(m);blocks.push({id:`${id}-page${p}-image`,type:'media',mediaId:m.id});
  const content=await page.getTextContent();const lines=[];let text='';for(const item of content.items){if(item.str!==undefined){text+=item.str+' ';if(item.hasEOL){if(normalize(text))lines.push(normalize(text));text='';}}}if(normalize(text))lines.push(normalize(text));texts.push(...lines);
  blocks.push({id:`${id}-page${p}-labels`,type:'table',rows:lines.map(text=>({cells:[{text,colSpan:1,rowSpan:1,header:false,blocks:[]}]}))});page.cleanup();
 }}finally{await pdf.destroy();}
 return {id,title,systemId:'general',section:{code:'',title:'Fastener and measurement reference'},kind:'general',engines:[],summary:'Fastener identification and metric reference charts.',sourceHash:hash(bytes),blocks,media,related:[],source:{reference,pdfUrl:null,revision:null},text:texts.join('\n'),warnings:[],abbreviations:[],sourceImageCount:0};
}
