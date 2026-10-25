import React,{useEffect,useRef} from 'react';
import {Home,Search} from 'lucide-react';
import {ThemePicker} from './ThemePicker.jsx';
import './footer.css';

export function Footer({onSearch}){
 const footer=useRef(null);
 useEffect(()=>{
  const root=document.documentElement;
  const measure=()=>root.style.setProperty('--atlas-footer-height',`${Math.ceil(footer.current.getBoundingClientRect().height)}px`);
  measure();
  // Reserve the actual height, including wrapped links, text zoom and device safe areas.
  const observer=new ResizeObserver(measure);
  observer.observe(footer.current);
  return()=>{observer.disconnect();root.style.removeProperty('--atlas-footer-height');};
 },[]);
 return <footer ref={footer} className="atlas-footer">
  <div className="footer-inner">
   <div className="footer-toolbar">
    <div className="footer-shortcuts" role="group" aria-label="Site shortcuts">
     <a className="footer-icon-button" href="#/" aria-label="Go to Mustang Atlas home" title="Home"><Home size={19} aria-hidden="true"/></a>
     <button type="button" className="footer-icon-button" onClick={onSearch} aria-label="Search the library" title="Search"><Search size={19} aria-hidden="true"/></button>
     <ThemePicker footer/>
    </div>
    <nav className="footer-nav" aria-label="Footer navigation">
     <a href="#/library">Library</a>
     <a href="#/maintenance">Maintenance</a>
     <a href="#/glossary">Glossary</a>
     <a href="#/saved">Saved</a>
    </nav>
   </div>
   <p className="footer-copyright">© {new Date().getFullYear()} <a href="https://www.ramideltoro.com" target="_blank" rel="noreferrer">Rami Del Toro</a><span aria-hidden="true"> · </span>Mustang Atlas</p>
  </div>
 </footer>;
}
