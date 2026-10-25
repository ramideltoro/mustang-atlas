export const THEME_STORAGE_KEY='mustang-atlas:theme:v1';
export const THEMES=[
 {id:'amber',name:'Amber',description:'Warm amber. Classic workshop glow.',colors:['#0a0a0a','#17120a','#facc15'],scheme:'dark'},
 {id:'sakura',name:'Sakura',description:'Cherry pink. A little matcha calm.',colors:['#fdeff4','#fff7ed','#456b35'],scheme:'light'},
 {id:'modern-saas',name:'SaaS',description:'Sleek charcoal and electric blue.',colors:['#121212','#1e1e1e','#3b82f6'],scheme:'dark'},
 {id:'san-juan',name:'Foxy',description:'Pastel streets. A tropical glow.',colors:['#f6c453','#e76f51','#2a9df4','#2f9e44'],scheme:'light'},
 {id:'creative-premium',name:'Butterfly',description:'Midnight navy with a purple glow.',colors:['#0f172a','#1e293b','#7c3aed'],scheme:'dark'},
 {id:'moody-cyberpunk',name:'Bambi',description:'Forest green meets cyber yellow.',colors:['#1a211b','#2c362f','#facc15'],scheme:'dark'},
];
export function normalizeTheme(value){return THEMES.some(t=>t.id===value)?value:'amber';}
export function readTheme(storage){try{return normalizeTheme(storage.getItem(THEME_STORAGE_KEY));}catch{return 'amber';}}
export function applyTheme(id,root=document.documentElement){const theme=THEMES.find(t=>t.id===normalizeTheme(id));root.dataset.theme=theme.id;root.style.colorScheme=theme.scheme;root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.colors[0]);}
