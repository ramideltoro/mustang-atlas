import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {openDb,decodeDocument} from '../server/db.mjs';
import {saveAsset} from '../server/parser.mjs';

// Write a separate proposal so this process never races the bulk image recovery map.
export async function proposePdfMedia({dataDir='data',documentId='reference-ac69a942e089',output='work/media-quality-metrics.json',longEdge=4096}={}) {
  dataDir=path.resolve(dataDir);output=path.resolve(output);
  if(output===path.join(dataDir,'media-quality.json'))throw new Error('Write a separate proposal; the live media map is owned by the bulk recovery job.');
  if(!Number.isSafeInteger(longEdge)||longEdge<1600||longEdge>8192)throw new Error('Long edge must be an integer between 1600 and 8192 pixels.');
  const db=openDb({dataDir,readOnly:true});let row;
  try{row=db.prepare('SELECT * FROM documents WHERE id=?').get(documentId);}finally{db.close();}
  if(!row?.pdf_file||path.basename(row.pdf_file)!==row.pdf_file)throw new Error('The selected document has no scoped source PDF.');
  const document=decodeDocument(row);
  const sourceBytes=await fs.readFile(path.join(dataDir,'source',row.pdf_file));
  const pdf=await getDocument({data:new Uint8Array(sourceBytes),useSystemFonts:true,isEvalSupported:false}).promise;
  const proposal={version:1,assets:{}};
  try{
    for(const media of document.media){
      if(!Number.isInteger(media.sourcePage)||media.sourcePage<1||media.sourcePage>pdf.numPages)continue;
      const page=await pdf.getPage(media.sourcePage);
      try{
        const operations=await page.getOperatorList();
        if(operations.fnArray.some(op=>[OPS.paintImageXObject,OPS.paintInlineImageXObject,OPS.paintImageMaskXObject].includes(op)))throw new Error('This page contains raster images; verify their native quality before proposing a larger render.');
        const original=page.getViewport({scale:1});
        const scale=longEdge/Math.max(original.width,original.height);
        const viewport=page.getViewport({scale});
        const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
        if(width<=media.width||height<=media.height)continue;
        const canvas=createCanvas(width,height);
        await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;
        const asset=await saveAsset(await canvas.encode('png'),'image/png',dataDir);
        proposal.assets[media.url]={...asset,sourceWidth:media.width,sourceHeight:media.height,sourceDocumentId:document.id,sourcePage:media.sourcePage,sourceKind:'vector-pdf-render',renderScale:scale};
      }finally{page.cleanup();}
    }
  }finally{await pdf.destroy();}
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.writeFile(output+'.tmp',JSON.stringify(proposal,null,2));
  await fs.rename(output+'.tmp',output);
  return proposal;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
  const output=option('--output','work/media-quality-metrics.json');
  const result=await proposePdfMedia({dataDir:option('--data','data'),documentId:option('--document','reference-ac69a942e089'),output,longEdge:Number(option('--long-edge','4096'))});
  console.log(JSON.stringify({output,upgrades:Object.entries(result.assets).map(([originalUrl,asset])=>({originalUrl,url:asset.url,width:asset.width,height:asset.height,sourcePage:asset.sourcePage}))},null,2));
}
