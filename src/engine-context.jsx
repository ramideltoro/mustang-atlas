import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {ChevronDown,CarFront} from 'lucide-react';
import {ENGINES,normalizeEngine,engineLabel,routeForEngine} from './navigation-model.mjs';
const STORAGE='mustang-atlas:engine:v1';
const EngineContext=createContext({engine:'',setEngine:()=>{}});
function engineFromLocation(){const query=window.location.hash.split('?')[1]||'';const value=new URLSearchParams(query).get('engine');return value===null?null:normalizeEngine(value);}
function initialEngine(){const route=engineFromLocation();if(route!==null)return route;try{return normalizeEngine(localStorage.getItem(STORAGE));}catch{return '';}}
export function EngineProvider({children}){
 const [engine,setValue]=useState(initialEngine);
 const persist=useCallback(value=>{const next=normalizeEngine(value);setValue(next);try{localStorage.setItem(STORAGE,next);}catch{}},[]);
 const setEngine=useCallback(value=>{
  const next=normalizeEngine(value);persist(next);
  window.location.hash=routeForEngine(window.location.hash,next);
 },[persist]);
 useEffect(()=>{const routeChange=()=>{const value=engineFromLocation();if(value!==null)persist(value);};const storageChange=event=>{if(event.key===STORAGE)setValue(normalizeEngine(event.newValue));};routeChange();window.addEventListener('hashchange',routeChange);window.addEventListener('storage',storageChange);return()=>{window.removeEventListener('hashchange',routeChange);window.removeEventListener('storage',storageChange);};},[persist]);
 const context=useMemo(()=>({engine,setEngine}),[engine,setEngine]);
 return <EngineContext.Provider value={context}>{children}</EngineContext.Provider>;
}
export function useEngine(){return useContext(EngineContext);}
export function EngineSelector(){const{engine,setEngine}=useEngine();return <label className={'engine-selector '+(engine?'selected':'')}><CarFront size={17}/><span className="engine-selector-copy"><small>YOUR ENGINE</small><span>{engineLabel(engine)}</span></span><select aria-label="Choose engine for the whole library" value={engine} onChange={event=>setEngine(event.target.value)}>{ENGINES.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select><ChevronDown size={13}/></label>;}
