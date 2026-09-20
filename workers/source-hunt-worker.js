const ALLOWED_ORIGIN='*';
const VERSION='1.9';
const CACHE_TTL_SECONDS=900;
const MAX_RESULTS=12;
const MAX_FETCH_BYTES=1600000;
const MAX_SUBREQUEST_BUDGET=18;
const MAX_PAGE_SCANS=6;

const PROFILES={
  'ERT1':{aliases:['ert1','ert 1','ert1.gr','ερτ1'],searches:['ERT1','ERT 1'],mainNames:['ert1','ert 1','ερτ1']},
  'ERT2':{aliases:['ert2','ert 2','ert2.gr','ερτ2'],searches:['ERT2','ERT 2'],mainNames:['ert2','ert 2','ερτ2']},
  'ERT3':{aliases:['ert3','ert 3','ert3.gr','ερτ3'],searches:['ERT3','ERT 3'],mainNames:['ert3','ert 3','ερτ3']},
  'ERT News':{aliases:['ertnews','ert news','ert_news','ert-news','ertnews.gr','ερτ news'],searches:['ERT News','ERTNEWS'],mainNames:['ert news','ertnews','ερτ news']},
  'ANT1':{aliases:['ant1','antenna1','ant1.gr','antenna','ant1 hd'],searches:['ANT1','ANT1 TV'],mainNames:['ant1','ant1 hd','ant1 tv','antenna']},
  'Alpha TV':{aliases:['alpha tv','alphatv','alpha.gr','alpha hd'],searches:['Alpha TV','AlphaTV'],mainNames:['alpha','alpha tv','alpha hd','alphatv']},
  'SKAI':{aliases:['skai','skaitv','skai tv','skai.gr','skai hd','σκαι','σκαϊ'],searches:['SKAI','SKAI TV'],mainNames:['skai','skai hd','skai tv','skaitv','σκαι','σκαϊ']},
  'Open TV':{aliases:['open tv','opentv','open beyond','open.gr','open hd'],searches:['OPEN TV','OPEN Beyond'],mainNames:['open','open tv','open hd','open beyond','opentv']},
  'MEGA':{aliases:['mega tv','megatv','mega channel','mega.gr','mega hd'],searches:['MEGA TV','Mega Channel'],mainNames:['mega','mega tv','mega hd','mega channel','megatv']},
  'Star TV':{aliases:['star tv','startv','star channel','star.gr','star hd'],searches:['STAR TV','Star Channel Greece'],mainNames:['star','star tv','star hd','star channel','startv']},
  'Action 24':{aliases:['action 24','action24','action tv','action24.gr'],searches:['Action 24','Action24'],mainNames:['action 24','action24','action tv']},
  'Kontra':{aliases:['kontra','kontra channel','kontra tv','kontrachannel'],searches:['Kontra','Kontra Channel'],mainNames:['kontra','kontra channel','kontra tv','kontrachannel']}
};

const SEEDS=[
  {name:'hitnickgr/iptv',url:'https://raw.githubusercontent.com/hitnickgr/iptv/refs/heads/main/GreekChannels'},
  {name:'jimgate07/grtv',url:'https://raw.githubusercontent.com/jimgate07/grtv/refs/heads/master/android.m3u'},
  {name:'Michatec/Greek-IPTV',url:'https://raw.githubusercontent.com/Michatec/Greek-IPTV/refs/heads/main/greek-iptv.m3u8'},
  {name:'musics300/total',url:'https://raw.githubusercontent.com/musics300/total/refs/heads/main/TOTAL.m3u'},
  {name:'gdiolitsis/greek-iptv',url:'https://raw.githubusercontent.com/gdiolitsis/greek-iptv/refs/heads/master/ForestRock_GR'},
  {name:'Don24crk',url:'https://raw.githubusercontent.com/don24crk/Don24crk-Repository/refs/heads/master/android.m3u'}
];

const NEG='-crypto -coin -token -restaurant -tiktok -music -lyrics -celebrity -game -gaming';
const REJECT_VARIANTS=/\b(hybrid|sport|sports|radio|fm|web radio|webradio|not 24\/7|test feed|promo)\b/i;
const REJECT_NONLIVE=/(?:\/vod\/|\/archive\/|\/catchup\/|\/news\/.*\.mp4\/|chunklist|\.mp4\/|drm|widevine|playready)/i;
const BLOCKED_RESULT_HOSTS=/^(?:x\.com|twitter\.com|tiktok\.com|www\.tiktok\.com)$/i;

function cors(){return {'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'};}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8',...extra}});}
function normalize(s=''){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,' ').replace(/\s+/g,' ').trim();}
function profile(channel){return PROFILES[channel]||{aliases:[String(channel||'').toLowerCase()],searches:[String(channel||'')],mainNames:[String(channel||'').toLowerCase()]};}
function relevant(text,channel){const h=normalize(text);return profile(channel).aliases.some(a=>h.includes(normalize(a)));}
function cleanUrl(url=''){return String(url).replace(/&amp;/g,'&').replace(/\\\//g,'/').replace(/[),.;]+$/g,'');}
function hostOf(url=''){try{return new URL(url).hostname.toLowerCase();}catch{return '';}}
function isLiveUrl(url=''){const s=String(url);return /\.(?:m3u8|mpd)(?:\?|$)/i.test(s)&&!REJECT_NONLIVE.test(s);}
function isStrm(url=''){return /\.strm(?:\?|$)/i.test(String(url));}
function addUnique(list,item){if(item?.url&&!list.some(x=>x.url===item.url))list.push(item);}
function entryTitle(extinf=''){const i=String(extinf).lastIndexOf(',');return i>=0?String(extinf).slice(i+1).trim():String(extinf).trim();}

class Budget{constructor(limit=MAX_SUBREQUEST_BUDGET){this.limit=limit;this.used=0;}canUse(n=1){return this.used+n<=this.limit;}take(){if(!this.canUse())throw new Error('hunt subrequest budget exhausted');this.used++;}}

function classifyEntry(extinf='',url='',channel=''){
  const p=profile(channel), title=entryTitle(extinf), titleNorm=normalize(title), all=`${extinf} ${url}`;
  if(REJECT_VARIANTS.test(all))return false;
  if(/\b\d{2,3}[.,]\d\b/.test(all)||/listen\.pls|netradio/i.test(all))return false;
  if(!relevant(`${title} ${extinf}`,channel))return false;
  return p.mainNames.some(n=>titleNorm===normalize(n)||titleNorm.startsWith(`${normalize(n)} `))||p.aliases.some(a=>titleNorm.includes(normalize(a)));
}

function parseM3u(text='',channel=''){
  const lines=String(text).replace(/\r/g,'').split('\n'), out=[];
  for(let i=0;i<lines.length;i++){
    const extinf=lines[i].trim();
    if(!/^#EXTINF:/i.test(extinf)||!relevant(extinf,channel))continue;
    let stream='';
    for(let j=i+1;j<Math.min(lines.length,i+10);j++){
      const next=lines[j].trim();
      if(!next||next.startsWith('#'))continue;
      if(/^https?:\/\//i.test(next))stream=cleanUrl(next);
      break;
    }
    if(stream&&classifyEntry(extinf,stream,channel))out.push({url:stream,extinf:extinf.slice(0,500)});
  }
  return out;
}

function extractLive(text=''){
  return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd)(?:\?[^\s"'<>]*)?/gi)||[]).map(cleanUrl))].filter(isLiveUrl);
}

function toRawGithubUrl(input=''){
  try{
    const u=new URL(input);
    if(u.hostname==='github.com'){
      const p=u.pathname.split('/').filter(Boolean);
      if(p[2]==='blob'&&p.length>=5)return `https://raw.githubusercontent.com/${p[0]}/${p[1]}/${p[3]}/${p.slice(4).join('/')}`;
    }
    if(u.hostname==='gist.github.com'&&!u.pathname.endsWith('/raw'))return `${u.origin}${u.pathname}/raw`;
  }catch{}
  return input;
}

async function fetchText(url,budget){
  budget.take();
  const r=await fetch(url,{redirect:'follow',headers:{'user-agent':`Mozilla/5.0 WebTV-SourceHunt/${VERSION}`,accept:'text/plain,text/html,application/json,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}});
  if(!r.ok)return {ok:false,status:r.status,text:'',type:r.headers.get('content-type')||''};
  return {ok:true,status:r.status,text:(await r.text()).slice(0,MAX_FETCH_BYTES),type:r.headers.get('content-type')||''};
}

async function resolveStrm(url,budget){
  if(!isStrm(url)||!budget.canUse())return null;
  const f=await fetchText(toRawGithubUrl(url),budget);
  if(!f.ok)return null;
  return extractLive(f.text)[0]||null;
}

async function brave(env,q,budget,count=8){
  if(!env.BRAVE_API_KEY)throw new Error('BRAVE_API_KEY is not configured');
  budget.take();
  const u=new URL('https://api.search.brave.com/res/v1/web/search');
  u.searchParams.set('q',q);u.searchParams.set('count',String(count));u.searchParams.set('freshness','pm');u.searchParams.set('text_decorations','false');u.searchParams.set('search_lang','en');
  const r=await fetch(u,{headers:{Accept:'application/json','X-Subscription-Token':env.BRAVE_API_KEY}});
  if(!r.ok)throw new Error(`Brave ${r.status}`);
  const j=await r.json();return j?.web?.results||[];
}

function candidate(url,kind,origin,source,extra={}){
  return {url,kind,origin,title:source?.title||source?.name||'',source:source?.url||'',snippet:(source?.description||'').slice(0,280),updatedAt:null,...extra};
}

async function scanSeed(seed,channel,budget,debug){
  const out=[];const report={type:'seed',name:seed.name,status:null,accepted:0};
  if(!budget.canUse())return out;
  const f=await fetchText(seed.url,budget);report.status=f.status;
  if(f.ok){
    for(const e of parseM3u(f.text,channel)){
      let u=e.url,method='extinf-seed';
      if(isStrm(u)){const resolved=await resolveStrm(u,budget);if(!resolved)continue;u=resolved;method='extinf-seed-strm';}
      if(!isLiveUrl(u))continue;
      addUnique(out,candidate(u,'seed','Known Greek M3U seed',seed,{method,extinf:e.extinf}));
    }
  }
  report.accepted=out.length;if(debug)debug.push(report);return out;
}

function resultKind(r){
  const h=hostOf(r.url||'');
  if(/reddit\.com$/.test(h)||/forum|thread|linuxsat/i.test(`${r.url||''} ${r.title||''}`))return 'forum';
  return 'web';
}

function rank(r,channel){
  if(BLOCKED_RESULT_HOSTS.test(hostOf(r.url||'')))return -100;
  const ctx=`${r.title||''} ${r.description||''} ${r.url||''}`;
  let s=0;
  if(relevant(ctx,channel))s+=10;
  if(/m3u8|iptv|playlist|hls|stream|live tv|television|channel/i.test(ctx))s+=7;
  if(/github|gist|raw\.githubusercontent/i.test(r.url||''))s+=4;
  if(/reddit|forum|thread|linuxsat/i.test(ctx))s+=3;
  if(REJECT_VARIANTS.test(ctx)||/wikipedia|tiktok|celebrity|actress|actor/i.test(ctx))s-=10;
  return s;
}

function tvEvidence(context,channel){return relevant(context,channel)&&/(m3u8|iptv|hls|stream|live tv|television|channel|skai\.gr|ert\.gr|ant1\.gr|alphatv|megatv|star\.gr|open)/i.test(context);}

async function inspectResult(r,channel,budget,debug){
  const out=[];const kind=resultKind(r);const context=`${r.title||''}\n${r.description||''}\n${r.url||''}`;
  const report={type:kind,title:(r.title||'').slice(0,100),status:null,accepted:0};
  for(const u of extractLive(context))if(tvEvidence(`${context} ${u}`,channel)&&!REJECT_VARIANTS.test(`${context} ${u}`))addUnique(out,candidate(u,kind,kind==='forum'?'Forums / Reddit':'Fresh Web',r,{method:'snippet'}));
  if(out.length||!r.url||!budget.canUse()){report.accepted=out.length;if(debug)debug.push(report);return out;}
  const f=await fetchText(toRawGithubUrl(r.url),budget);report.status=f.status;
  if(f.ok){
    for(const e of parseM3u(f.text,channel)){
      let u=e.url;if(isStrm(u)){const resolved=await resolveStrm(u,budget);if(!resolved)continue;u=resolved;}
      if(isLiveUrl(u))addUnique(out,candidate(u,kind,kind==='forum'?'Forums / Reddit':'Fresh Web',r,{method:'extinf-page',extinf:e.extinf}));
    }
    for(const u of extractLive(f.text)){
      if(out.some(x=>x.url===u))continue;
      const idx=f.text.indexOf(u),near=idx>=0?f.text.slice(Math.max(0,idx-700),Math.min(f.text.length,idx+u.length+700)):'';
      if(tvEvidence(`${context} ${near} ${u}`,channel)&&!REJECT_VARIANTS.test(`${context} ${near} ${u}`))addUnique(out,candidate(u,kind,kind==='forum'?'Forums / Reddit':'Fresh Web',r,{method:'nearby'}));
    }
  }
  report.accepted=out.length;if(debug)debug.push(report);return out;
}

function buildQueries(channel){
  const p=profile(channel),primary=p.searches[0]||channel,alt=p.searches[1]||primary;
  return [
    {kind:'web',q:`"${primary}" m3u8 live ${NEG}`},
    {kind:'web',q:`"${alt}" IPTV playlist ${NEG}`},
    {kind:'forum',q:`"${primary}" site:reddit.com IPTV ${NEG}`},
    {kind:'forum',q:`"${primary}" IPTV forum stream ${NEG}`}
  ];
}

async function runHunt(env,channel,days,wantDebug=false){
  const budget=new Budget(),debug=[],seed=[],web=[],forum=[];
  for(const s of SEEDS){if(!budget.canUse())break;for(const c of await scanSeed(s,channel,budget,wantDebug?debug:null))addUnique(seed,c);}

  const merged=[];const queries=buildQueries(channel);let searches=0;
  for(const x of queries){if(!budget.canUse())break;try{const rows=await brave(env,x.q,budget,8);searches++;for(const r of rows)merged.push({...r,_kind:x.kind});}catch(error){if(wantDebug)debug.push({type:'query',query:x.q,error:error?.message||String(error)});}}

  const ranked=[...new Map(merged.filter(r=>r?.url).map(r=>[r.url,r])).values()]
    .map(r=>({r,score:rank(r,channel)})).filter(x=>x.score>=7).sort((a,b)=>b.score-a.score).slice(0,MAX_PAGE_SCANS);

  for(const {r} of ranked){if(!budget.canUse())break;const found=await inspectResult(r,channel,budget,wantDebug?debug:null);for(const c of found){if(c.kind==='forum')addUnique(forum,c);else addUnique(web,c);}}

  const groups={seed:seed.slice(0,6),web:web.slice(0,6),forums:forum.slice(0,6)};
  const flat=[...groups.seed,...groups.web,...groups.forums].slice(0,MAX_RESULTS);
  return {version:VERSION,channel,days,candidates:flat,groups,counts:{seed:groups.seed.length,web:groups.web.length,forums:groups.forums.length,total:flat.length},freshSearchesRun:searches,resultsScanned:ranked.length,subrequestsUsed:budget.used,subrequestBudget:budget.limit,debug:wantDebug?debug:undefined};
}

async function cacheGet(requestUrl){
  try{const u=new URL(requestUrl);u.searchParams.delete('debug');u.searchParams.set('_v',VERSION);return await caches.default.match(new Request(u.toString(),{method:'GET'}));}catch{return null;}
}
async function cachePut(requestUrl,payload){
  try{const u=new URL(requestUrl);u.searchParams.delete('debug');u.searchParams.set('_v',VERSION);const r=json(payload,200,{'cache-control':`public,max-age=${CACHE_TTL_SECONDS}`,'x-source-hunt-cache':'MISS'});await caches.default.put(new Request(u.toString(),{method:'GET'}),r.clone());}catch{}
}

export default{
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);
    if(url.pathname!=='/hunt')return json({ok:true,service:'WebTV Source Hunt Worker',version:VERSION,features:['split seed/web/forums','15m cache','18 subrequest budget','fresh 30d web search','exact EXTINF pairing'],endpoint:'/hunt?channel=SKAI&days=30'});
    const channel=(url.searchParams.get('channel')||'').trim();
    const days=Math.min(30,Math.max(1,Number(url.searchParams.get('days')||30)));
    const wantDebug=url.searchParams.get('debug')==='1';
    if(!channel)return json({error:'channel is required'},400);

    if(!wantDebug){
      const hit=await cacheGet(request.url);
      if(hit){const data=await hit.json();return json({...data,cached:true},200,{'cache-control':'no-store','x-source-hunt-cache':'HIT'});}
    }

    try{
      const payload=await runHunt(env,channel,days,wantDebug);
      payload.cached=false;
      if(!wantDebug)await cachePut(request.url,payload);
      return json(payload,200,{'cache-control':'no-store','x-source-hunt-cache':'MISS'});
    }catch(error){return json({error:error?.message||String(error),channel,days},500);}
  }
};