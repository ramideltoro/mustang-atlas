const dimension=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;

export function imageGeometry(figure={},natural=null,{compact=false}={}){
 const vector=/^image\/svg\+xml(?:;|$)/i.test(figure.mime||'')||/\.svg(?:[?#]|$)/i.test(figure.url||figure.src||'');
 // Percentage-sized SVGs report a browser fallback such as 300×150, which is
 // unrelated to their viewBox. The catalog preserves that coordinate space.
 const width=vector?(dimension(figure.width)||dimension(natural?.width)):(dimension(natural?.width)||dimension(figure.width));
 const height=vector?(dimension(figure.height)||dimension(natural?.height)):(dimension(natural?.height)||dimension(figure.height));
 const sourceWidth=dimension(figure.sourceWidth)||width,sourceHeight=dimension(figure.sourceHeight)||height;
 const thumbnail=compact||!!(sourceWidth&&sourceHeight&&sourceWidth<=160&&sourceHeight<=160);
 const previewWidth=thumbnail?Math.min(width||144,144):width;
 const previewHeight=width&&height?previewWidth*height/width:previewWidth;
 return {width,height,vector,thumbnail,previewWidth,previewHeight,maxPreviewWidth:thumbnail||!vector?previewWidth?previewWidth+32:null:null,aspectRatio:previewWidth&&previewHeight?`${previewWidth+32}/${previewHeight+32}`:'4/3'};
}

/** 100% is the image's intrinsic dimensions, not the dialog's width. Fit never
 * enlarges a raster image; vectors may scale up without introducing pixels. */
export function fitImageScale({width,height,vector},viewport,padding=32){
 if(!width||!height||!viewport?.width||!viewport?.height)return 1;
 const scale=Math.min(Math.max(1,viewport.width-padding)/width,Math.max(1,viewport.height-padding)/height);
 return vector?scale:Math.min(1,scale);
}
export function imageZoomLevels(fitScale=1,vector=false){return [...new Set([Math.max(.001,fitScale),.1,.25,.5,.75,1,1.25,1.5,2,3,4,...(vector?[6,8,Math.max(8,fitScale*4)]:[])])].sort((a,b)=>a-b);}
export function nextImageZoom(scale,direction,fitScale=1,vector=false){const levels=imageZoomLevels(fitScale,vector);return direction>0?(levels.find(level=>level>scale+.001)??levels.at(-1)):([...levels].reverse().find(level=>level<scale-.001)??levels[0]);}
