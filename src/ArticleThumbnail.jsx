import React,{useState} from 'react';
import {editorialThumbnail} from '../shared/article-thumbnail.mjs';
export function ArticleThumbnail({item,className=''}){
 const [failedUrl,setFailedUrl]=useState(null);
 const original=item.cardThumbnail||item.thumbnail;
 const fallback=editorialThumbnail(item);
 const image=original?.url&&original.url!==failedUrl?original:fallback;
 return <div className={className+(image.generated?' editorial-thumbnail':'')}><img src={image.url} alt="" width={image.width||800} height={image.height||500} loading="lazy" decoding="async" onError={()=>{if(image.url!==fallback.url)setFailedUrl(image.url);}}/>{image.generated&&<span className="thumbnail-label">Atlas illustration</span>}</div>;
}
