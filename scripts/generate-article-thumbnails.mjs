import fs from 'node:fs/promises';
import {THUMBNAIL_TOPICS} from '../shared/article-thumbnail.mjs';
const ring=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}"/>`;
const rect=(x,y,w,h,r=9)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const path=d=>`<path d="${d}"/>`;
const gauge=ring(250,130,70)+ring(250,130,54)+path('M250 130l31-35M213 99l8 8m29-30v12m38 10-8 8M180 130h15m110 0h15M250 200v30q0 30-30 30h-35q-25 0-25 25v35')+rect(135,318,50,22,3);
const gear=ring(250,190,78)+ring(250,190,28)+Array.from({length:12},(_,i)=>`<path transform="rotate(${i*30} 250 190)" d="M238 111v-21h24v21"/>`).join('');
const drawings={
 'head-gasket':path('M100 105h300v65H100zM100 245h300v70H100zM100 207h300M120 207v-15h260v15')+[165,250,335].map(x=>ring(x,140,24)+ring(x,280,24)+`<ellipse cx="${x}" cy="207" rx="26" ry="9"/>`).join('')+path('M125 100V76m250 24V76M125 325v24m250-24v24M80 190l-30 17 30 17M420 190l30 17-30 17'),
 compression:gauge+path('M130 340h60m-50 9h40'),
 oil:path('M120 155h155l18 120-24 30H116l-16-25 12-95h-30v-30h38m30 0v-40h65v40m77 35 45-40 36 16-62 65')+path('M380 220q-29 38-29 52a29 29 0 0 0 58 0q0-14-29-52Z')+path('M145 230h83m-41-20v40'),
 filter:rect(95,210,310,110,13)+path('m95 210 55-70h200l55 70M95 250h310')+Array.from({length:11},(_,i)=>path(`M${140+i*22} 158l-20 45`)).join('')+path('M200 90v32m50-32v32m50-32v32'),
 wiper:path('M80 280l28-150q142-45 284 0l28 150ZM100 260q150-120 300 0M190 280l90-114m-26 4 78-23M290 280l-38-89m-20-13 69 29')+path('M130 80l-8 20m65-28-8 20m65-28-8 20m65-18-8 20m65-10-8 20'),
 battery:rect(115,130,270,190,17)+rect(145,100,50,30,3)+rect(305,100,50,30,3)+path('M155 180h45m-22-22v44M308 180h40m-100 3-40 65h43l-12 53 52-81h-45Z'),
 brake:ring(245,210,115)+ring(245,210,72)+ring(245,210,25)+[0,72,144,216,288].map(a=>`<g transform="rotate(${a} 245 210)">${ring(245,162,7)}</g>`).join('')+path('M322 108h37q31 0 31 31v89q0 30-31 30h-32l-25-48v-61Z'),
 clutch:ring(250,205,114)+ring(250,205,68)+ring(250,205,28)+Array.from({length:10},(_,i)=>`<path transform="rotate(${i*36} 250 205)" d="M242 169v-26h16v26m-26-57h36"/>`).join(''),
 wheel:ring(250,200,120)+ring(250,200,85)+ring(250,200,24)+[0,72,144,216,288].map(a=>`<path transform="rotate(${a} 250 200)" d="M238 177l-13-52h50l-13 52"/>`).join('')+path('M383 105v80m-13-65 13-15 13 15'),
 suspension:path('M250 65v40m-40 0h80m-80 200h80m-40 0v45M225 105v195h50V105')+path('m202 125 96 25-96 25 96 25-96 25 96 25-96 25 96 25')+ring(250,57,12)+ring(250,353,12),
 steering:ring(250,180,115)+ring(250,180,93)+rect(215,155,70,50,16)+path('M218 169l-60-20m125 20 60-20m-93 55v68M250 296v40h-95m95 0h95'),
 cooling:rect(120,115,260,210,15)+Array.from({length:10},(_,i)=>path(`M${145+i*23} 140v158`)).join('')+path('M120 160H80v-42m300 152h42v60M150 115V95h200v20')+ring(250,222,67)+path('M250 222q-50-70 4-56t-4 56q80-12 38 28t-38-28q-30 75-49 19t49-19'),
 fuel:rect(110,140,170,180,20)+rect(140,105,60,35,5)+path('M280 170h32q36 0 36 35v75q0 30 23 30t23-30V160l-35-39m-21 8 31-25 30 43-25 20M150 260h90')+path('M195 172q-27 37-27 49a27 27 0 0 0 54 0q0-12-27-49Z'),
 airflow:ring(250,210,90)+ring(250,210,27)+path('M250 120h130v45h-65M160 210v100h-65v-45h70M250 210q-70-60 0-65t0 65q80-30 50 30t-50-30q-5 90-48 39t48-39M380 130h40m-15-12 15 12-15 12'),
 timing:ring(170,150,54)+ring(330,150,54)+ring(250,285,40)+path('M116 150q-6-64 54-65h160q60 0 54 65l-92 145q-40 68-84 0ZM170 150h1m159 0h1m-81 135h1')+path('M158 150h24m-12-12v24M318 150h24m-12-12v24'),
 belt:ring(140,180,51)+ring(310,125,36)+ring(315,280,67)+ring(235,213,25)+path('M90 180q0-42 35-49l175-43q46-15 48 36l34 145q5 78-65 78-35 0-62-32L108 218q-18-12-18-38Z'),
 ignition:path('M230 70h40v55h-40Zm-7 55h54v85h-54Zm-14 85h82v33h-82Zm18 33h46v71h-46m46 0v25h-23v-16m-18-64h36m-36 15h36m-36 15h36M195 165l-40-23 12 38-34-2m177-17 37-30-5 36 31-8'),
 exhaust:path('M80 180h95v35h-95m95-65h160v105H175Zm160 30h65v35h-65M210 150v-24m84 24v-24M210 255v25m84-25v25M420 167q40 20 0 40t0 40')+path('M205 184h100m-100 37h100'),
 transmission:gear+path('M160 130H95v120h70m170-100h65v80h-62M205 90V65h90v25'),
 driveline:ring(250,210,75)+ring(250,210,30)+path('M175 190H70v40h105m150-40h105v40H325M230 135V65h40v70M85 167v85m330-85v85')+path('M210 200h80m-70 18h60'),
 climate:ring(250,200,33)+path('M250 166q-60-100 7-100t-7 100M281 216q118-2 84 56t-84-56M223 219q-58 103-91 44t91-44')+path('M105 125q-35 25 0 50t0 50m290-100q-35 25 0 50t0 50'),
 lighting:path('M135 130q-65 75 0 150h100V130Zm100 20h80m-80 36h105m-105 36h105m-105 36h80M143 150q-35 55 0 110')+path('M370 130v150m-18-130 18-20 18 20'),
 connector:rect(100,120,300,180,22)+rect(200,100,100,20,4)+rect(120,143,260,135,10)+Array.from({length:8},(_,i)=>rect(145+(i%4)*55,165+Math.floor(i/4)*55,24,24,4)).join('')+path('M180 300v43m70-43v43m70-43v43'),
 restraints:path('M202 95q30-45 60 0t-60 0Zm-5 65h77l42 109h-70l-12-44-30 81h-55l45-145M323 103l-130 194m140-185 15 10-138 188-17-13')+rect(170,285,55,25,4)+path('M110 90v245h230'),
 body:path('M100 270V135q5-35 40-40h190l70 110v105H120q-20 0-20-40Zm27-115h185l36 57H127Zm0 80h240v55H127')+path('M285 240h42m-67-85v55'),
 diagnosis:rect(135,80,230,260,20)+rect(158,105,184,140,6)+path('M175 180h32l20-40 25 80 25-60 18 20h28M170 278h35m40 0h35m-110 30h35m40 0h35')+ring(320,295,12),
 schedule:rect(120,100,260,230,15)+path('M120 158h260M175 80v45m150-45v45M165 200h35m35 0h35m35 0h35M165 245h35m35 0h35')+path('m284 275 18 18 39-43'),
 engine:path('M125 160h250v125H125Zm20-50h80v50h-80m130-50h80v50h-80M125 190H95v65h30m250-65h30v65h-30M170 285v30h160v-30M145 135h80m50 0h80')+ring(250,222,35)+path('M250 187v70m-35-35h70'),
 electrical:rect(160,110,180,190,15)+path('M185 150h130v110H185ZM100 150h60m-60 55h60m-60 55h60m180-110h60m-60 55h60m-60 55h60M205 65v45m45-45v45m45-45v45M205 300v45m45-45v45m45-45v45')+path('M250 170l-25 40h30l-10 30 30-45h-27Z'),
 safety:path('M140 100q110 0 110-35 0 35 110 35v105q0 82-110 140-110-58-110-140Z')+path('M190 205l40 40 80-95'),
};
await fs.mkdir('public/thumbnails',{recursive:true});
for(const {id,label} of THUMBNAIL_TOPICS){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500" role="img" aria-labelledby="title"><title id="title">${label} — original conceptual illustration</title><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#24241e"/><stop offset="1" stop-color="#101614"/></linearGradient><radialGradient id="glow"><stop stop-color="#e5b779" stop-opacity=".16"/><stop offset="1" stop-color="#e5b779" stop-opacity="0"/></radialGradient><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#f4dcb3" stroke-opacity=".045"/></pattern></defs><rect width="800" height="500" fill="url(#bg)"/><rect width="800" height="500" fill="url(#grid)"/><ellipse cx="410" cy="240" rx="300" ry="230" fill="url(#glow)"/><g transform="translate(150 25)" fill="none" stroke="#eac490" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${drawings[id]}</g><g stroke="#eac490" stroke-opacity=".35" fill="none"><path d="M84 76h24M84 76v24m632-24h-24m24 0v24M84 397h24m-24 0v-24m632 24h-24m24 0v-24"/><path d="M120 425h560"/></g><circle cx="120" cy="450" r="4" fill="#eac490"/><text x="137" y="454" fill="#c8bb9f" font-family="system-ui,sans-serif" font-size="13" letter-spacing="3">${label.toUpperCase().replaceAll('&','&amp;')}</text></svg>`;
 await fs.writeFile(`public/thumbnails/${id}.svg`,svg);
}
console.log(`Generated ${THUMBNAIL_TOPICS.length} original editorial topic illustrations.`);
