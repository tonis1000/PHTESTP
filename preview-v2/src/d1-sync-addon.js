const DB_NAME='webtv-v2-playlists';
const STORE='playlists';
const MY_ID='__my_playlist__';
const URL_KEY='webtv_v2_registry_url';
const TOKEN_KEY='webtv_v2_registry_token';
const $=id=>document.getElementById(id);
function registryUrl(){return(localStorage.getItem(URL_KEY)||'').trim().replace(/\/$/,'');}
function token(){return localStorage.getItem(TOKEN_KEY)||'';}
function headers(){const h={};if(token())h.authorization=`Bearer ${token()}`;return h;}
function status(text,tone='idle'){const el=$('playlist-manager-status');if(el){el.textContent=text;el.dataset.tone=tone;}}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function put(item){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=()=>resolve(item);tx.onerror=()=>reject(tx.error);});}
function esc(v=''){return String(v||'').replace(/"/g,"'");}
function channelsToM3U(channels){const lines=['#EXTM3U'];for(const c of channels){const urls=(c.sources||[]).map(s=>s.url).filter(Boolean);const ext=`#EXTINF:-1 tvg-id="${esc(c.tvgId||c.id||c.name)}" tvg-name="${esc(c.name)}" tvg-logo="${esc(c.logo||'')}" group-title="${esc(c.groupName||'Other')}",${c.name}`;if(urls.length){for(const u of urls)lines.push(ext,u);}else lines.push(ext,'');}return`${lines.join('\n')}\n`;}
async function api(path){const base=registryUrl();if(!base)throw new Error('Registry URL is not configured');const r=await fetch(`${base}${path}`,{cache:'no-store',headers:headers()});let j={};try{j=await r.json();}catch{}if(!r.ok)throw new Error(j.error||`Registry HTTP ${r.status}`);return j;}
async function pull(){if(!registryUrl())throw new Error('Registry URL is required');if(!token())throw new Error('Admin token is required to sync Saved Playlists');status('Pulling protected D1 library…','busy');const my=await api('/api/my-playlist');const myText=channelsToM3U(my.channels||[]);await put({id:MY_ID,name:'My Playlist',type:'curated',url:'',text:myText,channelCount:(my.channels||[]).length,groupCount:new Set((my.channels||[]).map(c=>c.groupName||'Other')).size,createdAt:Date.now(),updatedAt:Date.now()});const list=await api('/api/playlists');let saved=0;for(const meta of list.playlists||[]){const detail=(await api(`/api/playlists/${encodeURIComponent(meta.id)}`)).playlist;if(!detail?.rawM3u)continue;await put({id:detail.id,name:detail.name,type:detail.kind||'saved',url:detail.sourceUrl||'',text:detail.rawM3u,channelCount:detail.channelCount||0,groupCount:detail.groupCount||0,createdAt:Date.parse(detail.createdAt)||Date.now(),updatedAt:Date.parse(detail.updatedAt)||Date.now()});saved++;}status(`D1 pull complete · ${(my.channels||[]).length} My Playlist channels · ${saved} saved playlists`,'ok');const panel=$('playlist-manager');if(panel&&!panel.hidden){$('playlist-manager-toggle')?.click();setTimeout(()=>$('playlist-manager-toggle')?.click(),40);}}
const button=$('registry-sync-down');if(button){button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();pull().catch(error=>status(`D1 pull failed · ${error.message}`,'error'));},true);}
window.WebTVD1Sync={pull};
