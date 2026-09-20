const ALLOWED_ORIGIN = '*';
const VERSION = '1.5';
const MAX_RESULTS = 12;
const TARGET_RESULTS = 8;
const MAX_DEBUG = 40;
const MAX_FETCH_BYTES = 2000000;
const MAX_SUBREQUEST_BUDGET = 36;
const MAX_SEARCH_RESULTS = 24;
const MAX_PLAYLIST_LINKS_PER_PAGE = 2;

const PROFILES = {
  'ERT1': { aliases:['ert1','ert 1','ert1.gr','ερτ1'], searches:['ERT1','ERT 1'] },
  'ERT2': { aliases:['ert2','ert 2','ert2.gr','ερτ2'], searches:['ERT2','ERT 2'] },
  'ERT3': { aliases:['ert3','ert 3','ert3.gr','ερτ3'], searches:['ERT3','ERT 3'] },
  'ERT News': { aliases:['ertnews','ert news','ert_news','ert-news','ertnews.gr','ερτ news'], searches:['ERT News','ERTNEWS'] },
  'ANT1': { aliases:['ant1','antenna1','ant1.gr','antenna','ant1 hd'], searches:['ANT1','ANT1 TV'] },
  'Alpha TV': { aliases:['alpha tv','alphatv','alpha.gr','alpha hd'], searches:['Alpha TV','AlphaTV'] },
  'SKAI': { aliases:['skai','skaitv','skai tv','skai.gr','skai hd','σκαι','σκαϊ'], searches:['SKAI','SKAI TV'] },
  'Open TV': { aliases:['open tv','opentv','open beyond','open.gr','open hd'], searches:['OPEN TV','OPEN Beyond'] },
  'MEGA': { aliases:['mega tv','megatv','mega channel','mega.gr','mega hd'], searches:['MEGA TV','Mega Channel'] },
  'Star TV': { aliases:['star tv','startv','star channel','star.gr','star hd'], searches:['STAR TV','Star Channel Greece'] },
  'Action 24': { aliases:['action 24','action24','action tv','action24.gr'], searches:['Action 24','Action24'] },
  'Kontra': { aliases:['kontra','kontra channel','kontra tv','kontrachannel'], searches:['Kontra','Kontra Channel'] },
};

// Known Greek playlist sources supplied by the project. These are scanned first
// because one request can expose many exact #EXTINF channel entries.
const SEED_PLAYLISTS = [
  {name:'hitnickgr/iptv',url:'https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels'},
  {name:'jimgate07/grtv',url:'https://raw.githubusercontent.com/jimgate07/grtv/refs/heads/master/android.m3u'},
  {name:'Michatec/Greek-IPTV',url:'https://raw.githubusercontent.com/Michatec/Greek-IPTV/refs/heads/main/greek-iptv.m3u8'},
  {name:'musics300/total',url:'https://raw.githubusercontent.com/musics300/total/refs/heads/main/TOTAL.m3u'},
  {name:'gdiolitsis/greek-iptv',url:'https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR'},
  {name:'Don24crk',url:'https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u'}
];

const NEGATIVE_TERMS='-crypto -coin -token -restaurant -tiktok -music -lyrics -celebrity -game -gaming';

function cors(){ return {'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}; }
function json(data,status=200){ return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}}); }
function normalize(s=''){ return String(s).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi,' '); }
function profile(channel){ return PROFILES[channel]||{aliases:[String(channel||'').toLowerCase()],searches:[String(channel||'')]}; }
function relevant(text,channel){ const h=normalize(text); return profile(channel).aliases.some(a=>h.includes(normalize(a).trim())); }
function cleanUrl(url=''){ return String(url).replace(/&amp;/g,'&').replace(/\\\//g,'/').replace(/[),.;]+$/g,''); }
function addUnique(list,item){ if(item?.url && !list.some(x=>x.url===item.url)) list.push(item); }

class Budget {
  constructor(limit=MAX_SUBREQUEST_BUDGET){ this.limit=limit; this.used=0; }
  canUse(n=1){ return this.used+n<=this.limit; }
  take(){ if(!this.canUse()) throw new Error('hunt subrequest budget exhausted'); this.used++; }
}

function parseM3uEntries(text='',channel=''){
  const lines=String(text).replace(/\r/g,'').split('\n');
  const out=[];
  for(let i=0;i<lines.length;i++){
    const extinf=lines[i].trim();
    if(!/^#EXTINF:/i.test(extinf) || !relevant(extinf,channel)) continue;
    let stream='';
    for(let j=i+1;j<Math.min(lines.length,i+10);j++){
      const next=lines[j].trim();
      if(!next) continue;
      if(next.startsWith('#')) continue;
      if(/^https?:\/\//i.test(next)) stream=cleanUrl(next);
      break;
    }
    if(stream) out.push({url:stream,extinf:extinf.slice(0,500)});
  }
  return out;
}

function extractDirectStreams(text=''){
  return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd|mp4|webm)(?:\?[^\s"'<>]*)?/gi)||[]).map(cleanUrl))];
}

function isPlausiblePlaylistUrl(raw='',baseUrl=''){
  try{
    const u=new URL(cleanUrl(raw),baseUrl||undefined);
    if(!/^https?:$/.test(u.protocol)) return null;
    // The pathname itself must look like a playlist. Do not accept ?id=foo.m3u noise.
    if(!/\.m3u$/i.test(u.pathname)) return null;
    if(/google\.com|play\.google\.com|accounts\.google\.com/i.test(u.hostname)) return null;
    return u.href;
  }catch{ return null; }
}

function extractPlaylistLinks(text='',baseUrl=''){
  const src=String(text).replace(/&amp;/g,'&').replace(/\\\//g,'/');
  const found=[];
  for(const m of src.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)){
    const u=isPlausiblePlaylistUrl(m[1],baseUrl); if(u) found.push(u);
  }
  for(const m of src.matchAll(/https?:\/\/[^\s"'<>]+/gi)){
    const u=isPlausiblePlaylistUrl(m[0],baseUrl); if(u) found.push(u);
  }
  return [...new Set(found)];
}

function toRawGithubUrl(input=''){
  try{
    const u=new URL(input);
    if(u.hostname==='github.com'){
      const p=u.pathname.split('/').filter(Boolean);
      if(p[2]==='blob'&&p.length>=5) return `https://raw.githubusercontent.com/${p[0]}/${p[1]}/${p[3]}/${p.slice(4).join('/')}`;
    }
    if(u.hostname==='gist.github.com'){
      const p=u.pathname.split('/').filter(Boolean);
      if(p.length>=2&&!u.pathname.endsWith('/raw')) return `${u.origin}${u.pathname}/raw`;
    }
  }catch{}
  return input;
}

async function fetchText(url,budget){
  budget.take();
  const r=await fetch(url,{redirect:'follow',headers:{'user-agent':`Mozilla/5.0 WebTV-SourceHunt/${VERSION}`,accept:'text/plain,text/html,application/json,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}});
  const type=r.headers.get('content-type')||'';
  if(!r.ok) return {ok:false,status:r.status,type,text:''};
  const text=(await r.text()).slice(0,MAX_FETCH_BYTES);
  return {ok:true,status:r.status,type,text};
}

async function braveSearch(env,q,budget,count=8){
  if(!env.BRAVE_API_KEY) throw new Error('BRAVE_API_KEY is not configured');
  budget.take();
  const u=new URL('https://api.search.brave.com/res/v1/web/search');
  u.searchParams.set('q',q); u.searchParams.set('count',String(count)); u.searchParams.set('freshness','pm'); u.searchParams.set('text_decorations','false'); u.searchParams.set('search_lang','en');
  const r=await fetch(u,{headers:{Accept:'application/json','X-Subscription-Token':env.BRAVE_API_KEY}});
  if(!r.ok) throw new Error(`Brave ${r.status}`);
  const j=await r.json(); return j?.web?.results||[];
}

function candidate(url,origin,source,extra={}){
  return {url,origin,title:source?.title||source?.name||'',source:source?.url||'',snippet:(source?.description||'').slice(0,300),updatedAt:null,...extra};
}

async function scanPlaylist(seed,channel,budget,debug,origin='Known Greek M3U seed'){
  const report={type:'playlist',name:seed.name||'',url:seed.url,status:null,entries:0,accepted:0,reason:''};
  const out=[];
  if(!budget.canUse()) { report.reason='budget skipped'; if(debug) debug.push(report); return out; }
  try{
    const f=await fetchText(toRawGithubUrl(seed.url),budget); report.status=f.status;
    if(!f.ok){ report.reason=`fetch failed ${f.status}`; if(debug) debug.push(report); return out; }
    const entries=parseM3uEntries(f.text,channel); report.entries=entries.length;
    for(const e of entries) addUnique(out,candidate(e.url,origin,seed,{method:'extinf-seed',extinf:e.extinf,playlist:seed.url}));
    report.accepted=out.length; report.reason=out.length?'matching EXTINF entries':'channel not found';
  }catch(error){ report.reason=error?.message||String(error); }
  if(debug) debug.push(report); return out;
}

function buildQueries(channel){
  const p=profile(channel); const primary=p.searches[0]||channel; const alt=p.searches[1]||primary;
  return [
    `"${primary}" m3u8 ${NEGATIVE_TERMS}`,
    `"${primary}" m3u IPTV ${NEGATIVE_TERMS}`,
    `"${primary}" EXTINF ${NEGATIVE_TERMS}`,
    `"${alt}" playlist ${NEGATIVE_TERMS}`,
    `Greek IPTV m3u ${NEGATIVE_TERMS}`,
    `site:github.com Greek IPTV m3u ${NEGATIVE_TERMS}`,
    `"${primary}" site:reddit.com IPTV ${NEGATIVE_TERMS}`
  ];
}

function rankResult(r,channel){
  const ctx=`${r.title||''} ${r.description||''} ${r.url||''}`;
  let s=0;
  if(relevant(ctx,channel)) s+=10;
  if(/github|gist|raw\.githubusercontent/i.test(r.url||'')) s+=7;
  if(/m3u|iptv|playlist|stream/i.test(ctx)) s+=5;
  if(/reddit|forum|linuxsat/i.test(ctx)) s+=2;
  if(/wikipedia|tiktok|play\.google|aptoide|sourceforge/i.test(r.url||'')) s-=10;
  return s;
}

async function inspectWebResult(result,channel,budget,debug){
  const report={type:'page',title:(result.title||'').slice(0,120),url:result.url||'',score:rankResult(result,channel),status:null,directFound:0,playlistLinksFound:0,accepted:0,reason:''};
  const out=[]; const context=`${result.title||''}\n${result.description||''}\n${result.url||''}`;
  for(const u of extractDirectStreams(context)) if(relevant(`${context} ${u}`,channel)) addUnique(out,candidate(u,'Web search',result,{method:'brave-snippet'}));
  if(out.length>=TARGET_RESULTS || !result.url || report.score<3 || !budget.canUse()){ report.accepted=out.length; report.reason=out.length?'direct snippet':'skipped low-value/budget'; if(debug) debug.push(report); return out; }

  try{
    const f=await fetchText(toRawGithubUrl(result.url),budget); report.status=f.status;
    if(!f.ok){ report.reason=`fetch failed ${f.status}`; if(debug) debug.push(report); return out; }

    const own=parseM3uEntries(f.text,channel);
    for(const e of own) addUnique(out,candidate(e.url,/github/i.test(result.url)?'GitHub/Web search':'Web search',result,{method:'extinf-page',extinf:e.extinf,playlist:result.url}));

    const direct=extractDirectStreams(f.text); report.directFound=direct.length;
    for(const u of direct){
      if(out.some(x=>x.url===u)) continue;
      const idx=f.text.indexOf(u); const nearby=idx>=0?f.text.slice(Math.max(0,idx-700),Math.min(f.text.length,idx+u.length+700)):'';
      if(relevant(`${nearby} ${context}`,channel)) addUnique(out,candidate(u,'Web search',result,{method:'nearby'}));
    }

    const links=extractPlaylistLinks(f.text,result.url).slice(0,MAX_PLAYLIST_LINKS_PER_PAGE); report.playlistLinksFound=links.length;
    for(const url of links){
      if(out.length>=TARGET_RESULTS || !budget.canUse()) break;
      const found=await scanPlaylist({name:result.title||'linked playlist',url},channel,budget,debug,'Web linked M3U');
      for(const c of found) addUnique(out,c);
    }
    report.accepted=out.length; report.reason=out.length?'accepted candidates':'no channel stream';
  }catch(error){ report.reason=error?.message||String(error); }
  if(debug) debug.push(report); return out;
}

async function hunt(env,channel,days,wantDebug=false){
  const budget=new Budget(); const candidates=[]; const scans=[]; const queryDebug=[];

  // Phase 1: efficient exact scans of known Greek playlists.
  for(const seed of SEED_PLAYLISTS){
    if(candidates.length>=TARGET_RESULTS || !budget.canUse()) break;
    const found=await scanPlaylist(seed,channel,budget,wantDebug?scans:null);
    for(const c of found) addUnique(candidates,c);
  }

  // Phase 2: recent Brave discovery, with fewer calls and ranked pages.
  const queries=buildQueries(channel);
  const merged=[];
  for(const q of queries){
    if(candidates.length>=TARGET_RESULTS || !budget.canUse()) break;
    try{
      const rows=await braveSearch(env,q,budget,8); merged.push(...rows);
      if(wantDebug) queryDebug.push({query:q,results:rows.length});
    }catch(error){ if(wantDebug) queryDebug.push({query:q,error:error?.message||String(error)}); }
  }

  const ranked=[...new Map(merged.filter(r=>r?.url).map(r=>[r.url,r])).values()]
    .map(r=>({r,score:rankResult(r,channel)})).sort((a,b)=>b.score-a.score).slice(0,MAX_SEARCH_RESULTS);

  for(const {r} of ranked){
    if(candidates.length>=TARGET_RESULTS || !budget.canUse()) break;
    const found=await inspectWebResult(r,channel,budget,wantDebug?scans:null);
    for(const c of found) addUnique(candidates,c);
  }

  const result={candidates:candidates.slice(0,MAX_RESULTS),count:Math.min(candidates.length,MAX_RESULTS),searched:queryDebug.length||queries.length,resultsScanned:ranked.length,subrequestsUsed:budget.used,subrequestBudget:budget.limit};
  if(wantDebug) result.debug={queries:queryDebug,scans:scans.slice(0,MAX_DEBUG)};
  return result;
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);
    if(url.pathname!=='/hunt') return json({ok:true,service:'WebTV Source Hunt Worker',version:VERSION,features:['seed-first Greek M3U','exact EXTINF pairing','budgeted Brave fallback','ranked page scans'],endpoint:'/hunt?channel=SKAI&days=30&debug=1'});
    const channel=(url.searchParams.get('channel')||'').trim();
    const days=Math.min(30,Math.max(1,Number(url.searchParams.get('days')||30)));
    const wantDebug=url.searchParams.get('debug')==='1';
    if(!channel) return json({error:'channel is required'},400);
    try{ return json({channel,days,...await hunt(env,channel,days,wantDebug)}); }
    catch(error){ return json({error:error?.message||String(error),channel,days},500); }
  }
};
