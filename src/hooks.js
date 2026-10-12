import {useEffect,useState,useCallback} from 'react';
import {createApiCache,apiCacheLifetime} from './api-cache.mjs';
const cache=createApiCache();
export async function api(path,{signal,refresh=false}={}){
  const cached=!refresh?cache.get(path):undefined;
  if(cached!==undefined)return cached;
  const response=await fetch('/api/v1'+path,{signal});
  if(!response.ok)throw new Error(response.status===404?'This reference could not be found.':'The library could not be reached. Please try again.');
  const value=await response.json();cache.set(path,value,apiCacheLifetime(path));return value;
}
export function useApi(path){
  const [attempt,setAttempt]=useState(0),[state,setState]=useState({path:null,data:null,loading:!!path,error:null});
  useEffect(()=>{
    if(!path){setState({path,data:null,loading:false,error:null});return;}
    const controller=new AbortController();
    const cached=!attempt?cache.get(path):undefined;
    if(cached!==undefined){setState({path,data:cached,loading:false,error:null});return;}
    setState({path,data:null,loading:true,error:null});
    api(path,{signal:controller.signal,refresh:attempt>0}).then(data=>{if(!controller.signal.aborted)setState({path,data,loading:false,error:null});}).catch(error=>{if(error.name!=='AbortError')setState({path,data:null,loading:false,error:error.message});});
    return()=>controller.abort();
  },[path,attempt]);
  const retry=useCallback(()=>setAttempt(n=>n+1),[]);
  return {...(state.path===path?state:{path,data:null,loading:!!path,error:null}),retry};
}
export function useRoute(){
  const read=()=>window.location.hash.slice(1)||'/';
  const [route,setRoute]=useState(read);
  useEffect(()=>{const change=()=>{setRoute(read());window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  const [path,query='']=route.split('?');
  return {path,params:new URLSearchParams(query),key:route};
}
export function navigate(path){window.location.hash=path;}
export function useBookmarks(){
  const [items,setItems]=useState(()=>{try{const value=JSON.parse(localStorage.getItem('mustang-atlas:bookmarks:v1')||'[]');return Array.isArray(value)?value.filter(item=>typeof item?.id==='string').slice(0,200):[];}catch{return [];}});
  const toggle=useCallback(doc=>setItems(previous=>{const next=previous.some(item=>item.id===doc.id)?previous.filter(item=>item.id!==doc.id):[{id:doc.id,title:doc.title,system:doc.system,kind:doc.kind},...previous].slice(0,200);try{localStorage.setItem('mustang-atlas:bookmarks:v1',JSON.stringify(next));}catch{}return next;}),[]);
  return {items,toggle};
}
export function useMediaQuery(query){
  const [matches,setMatches]=useState(()=>window.matchMedia(query).matches);
  useEffect(()=>{const media=window.matchMedia(query);const update=()=>setMatches(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[query]);
  return matches;
}
