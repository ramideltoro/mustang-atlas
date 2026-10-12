// Keep browsing a large catalog from retaining every document for the session.
// Entries expire from insertion time, so revisiting a live catalog can refresh it.
export function createApiCache({maxEntries=64,ttlMs=300000,now=()=>Date.now()}={}){
 const entries=new Map();
 return {
  get(key){
   const entry=entries.get(key);
   if(!entry)return undefined;
   if(entry.expiresAt<=now()){entries.delete(key);return undefined;}
   entries.delete(key);entries.set(key,entry);
   return entry.value;
  },
  set(key,value,lifetime=ttlMs){
   const time=now();
   for(const [candidate,entry] of entries)if(entry.expiresAt<=time)entries.delete(candidate);
   entries.delete(key);entries.set(key,{value,expiresAt:time+Math.max(0,lifetime)});
   while(entries.size>Math.max(1,maxEntries))entries.delete(entries.keys().next().value);
  },
  get size(){return entries.size;},
 };
}
export const apiCacheLifetime=path=>path.startsWith('/maintenance?')?30000:300000;
