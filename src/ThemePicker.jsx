import React,{createContext,useContext,useState,useEffect} from 'react';
import {Palette,Settings,Check} from 'lucide-react';
import {Modal} from './ui.jsx';
import {THEMES,THEME_STORAGE_KEY,readTheme,normalizeTheme,applyTheme} from './theme-model.mjs';
const ThemeContext=createContext(null);
export function ThemeProvider({children}){
 const [theme,setTheme]=useState(()=>normalizeTheme(document.documentElement.dataset.theme));
 const [open,setOpen]=useState(false),[saved,setSaved]=useState(true);
 useEffect(()=>{const sync=event=>{if(event.key===THEME_STORAGE_KEY||event.key===null){const next=readTheme(localStorage);applyTheme(next);setTheme(next);}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 function choose(id){applyTheme(id);setTheme(id);try{localStorage.setItem(THEME_STORAGE_KEY,id);setSaved(true);}catch{setSaved(false);}}
 const current=THEMES.find(t=>t.id===theme);
 return <ThemeContext.Provider value={{current,open,setOpen}}>{children}{open&&<Modal title="Make it your Atlas." eyebrow="APPEARANCE" onClose={()=>setOpen(false)} className="theme-modal"><p className="theme-intro">Same garage. Your kind of atmosphere.</p><div className="theme-options" aria-label="Color theme">{THEMES.map(item=><button key={item.id} className="theme-option" aria-pressed={theme===item.id} onClick={()=>choose(item.id)}><span className="theme-swatches" aria-hidden="true">{item.colors.map(color=><i key={color} style={{backgroundColor:color}}/>)}</span><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="theme-check">{theme===item.id&&<Check size={19}/>}</span></button>)}</div><p className="theme-status" role="status">{saved?'Your choice is saved on this device.':'Applied for this visit. Browser storage is unavailable.'}</p></Modal>}</ThemeContext.Provider>;
}
export function ThemePicker({footer=false}){
 const {current,open,setOpen}=useContext(ThemeContext),Icon=footer?Settings:Palette;
 return <button type="button" className={footer?'footer-icon-button':'theme-trigger icon-button'} onClick={()=>setOpen(true)} aria-label={'Choose theme, current theme '+current.name} aria-haspopup="dialog" aria-expanded={open} title="Change theme"><Icon size={19} aria-hidden="true"/></button>;
}
