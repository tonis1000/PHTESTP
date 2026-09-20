const ALLOWED_ORIGIN='*';
const VERSION='1.13';
const CACHE_TTL_SECONDS=900;
const MAX_RESULTS=12;
const MAX_LEADS=8;
const MAX_FETCH_BYTES=1400000;
const PLAYLIST_PROXY_MAX_BYTES=2500000;
const MAX_SUBREQUEST_BUDGET=16;
const MAX_PAGE_SCANS=4;
const FETCH_TIMEOUT_MS=6500;
const BRAVE_TIMEOUT_MS=6000;

const PROFILES={
  'ERT1':{aliases:['ert1','ert 1','ert1.gr','ερτ1'],searches:['ERT1','ERT 1'],mainNames:['ert1','ert 1','ερτ1']},
  'ERT2':{aliases:['ert2','ert 2','ert2.gr','ερτ2'],searches:['ERT2','ERT 2'],mainNames:['ert2','ert 2','ερτ2']},
  'ERT3':{aliases:['ert3','ert 3','ert3.gr','ερτ3'],searches:['ERT3','ERT 3','ερτ3'],mainNames:['ert3','ert 3','ερτ3']},
  'ERT News':{aliases:['ertnews','ert news','ert_news','ert-news','ertnews.gr','ερτ news'],searches:['ERT News','ERTNEWS'],mainNames:['ert news','ertnews','ερτ news']},
  'ANT1':{aliases:['ant1','antenna1','ant1.gr','antenna','ant1 hd'],searches:['ANT1 Greece TV','ANT1 TV'],mainNames:['ant1','ant1 hd','ant1 tv','antenna']},
  'Alpha TV':{aliases:['alpha tv','alphatv','alpha.gr','alpha hd'],searches:['Alpha TV Greece','AlphaTV'],mainNames:['alpha','alpha tv','alpha hd','alphatv']},
  'SKAI':{aliases:['skai','skaitv','skai tv','skai.gr','skai hd','σκαι','σκαϊ'],searches:['SKAI TV Greece','SKAI TV'],mainNames:['skai','skai hd','skai tv','skaitv','σκαι','σκαϊ']},
  'Open TV':{aliases:['open tv','opentv','open beyond','open.gr','open hd'],searches:['OPEN TV Greece','OPEN Beyond'],mainNames:['open','open tv','open hd','open beyond','opentv']},
  'MEGA':{aliases:['mega tv','megatv','mega channel','mega.gr','mega hd'],searches:['MEGA TV Greece','Mega Channel'],mainNames:['mega','mega tv','mega hd','mega channel','megatv']},
  'Star TV':{aliases:['star tv','startv','star channel','star.gr','star hd'],searches:['STAR TV Greece','Star Channel Greece'],mainNames:['star','star tv','star hd','star channel','startv']},
  'Action 24':{aliases:['action 24','action24','action tv','action24.gr'],searches:['Action 24 Greece','Action24'],mainNames:['action 24','action24','action tv']},
  'Kontra':{aliases:['kontra','kontra channel','kontra tv','kontrachannel'],searches:['Kontra Channel Greece','Kontra Channel'],mainNames:['kontra','kontra channel','kontra tv','kontrachannel']}
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
const BLOCKED_RESULT_HOSTS=/^(?:x\.com|twitter\.com|tiktok\.com|www\.tiktok\.com|wikipedia\.org|en\.wikipedia\.org|el\.wikipedia\.org)$/i;
const LOW_TRUST_HOSTS=/(?:^|\.)(?:fandom\.com|freeintertv\.com)$/i;
const ANT1_SUBCHANNELS=/\b(drama|comedy|just[ _-]?music|music|series|movies|kids|ant1\+|antenna\+)\b/i;

function cors(){return {'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'};}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8',...extra}});}
function normalize(s=''){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,' ').replace(/\s+/g,' ').trim();}
function profile(channel){return PROFILES[channel]||{aliases:[String(channel||'').toLowerCase()],searches:[String(channel||'')],mainNames:[String(channel||'').toLowerCase()]};}
function relevant(text,channel){const h=normalize(text);return profile(channel).aliases.some(a=>h.includes(normalize(a)));}
function cleanUrl(url=''){return String(url).replace(/&amp;/g,'&').replace(/\\\//g,'/').replace(/[),.;]+$/g,'');}
function hostOf(url=''){try{return new URL(url).hostname.toLowerCase();}catch{return '';}}
function isLiveUrl(url=''){const s=String(url);return /\.(?:m3u8|mpd)(?:\?|$)/i.test(s)&&!REJECT_NONLIVE.test(s);}
function isStrm(url=''){return /\.strm(?:\?|$)/i.test(String(url));}
function addUnique(list,item,key='url'){const v=item?.[key];if(v&&!list.some(x=>x?.[key]===v))list.push(item);}
function entryTitle(extinf=''){const i=String(extinf).lastIndexOf(',');return i>=0?String(extinf).slice(i+1).trim():String(extinf).trim();}
function cutoff(days=30){return Date.now()-days*86400000;}
function explicitOldDate(url=''){const m=String(url).match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})\//);if(!m)return false;const t=Date.UTC(+m[1],+m[2]-1,+m[3]);return Number.isFinite(t)&&t<cutoff(30);}
function parseResultDate(r){for(const v of [r?.updatedAt,r?.published,r?.date,r?.page_age,r?.age]){if(!v)continue;const t=Date.parse(v);if(Number.isFinite(t))return t;}return null;}
function freshEnough(r,days=30){const t=parseResultDate(r);if(t!==null)return t>=cutoff(days);if(explicitOldDate(r?.url||''))return false;return true;}

class Budget{constructor(limit=MAX_SUBREQUEST_BUDGET){this.limit=limit;this.used=0;}canUse(n=1){return this.used+n<=this.limit;}take(){if(!this.canUse())throw new Error('hunt subrequest budget exhausted');this.used++;}}
async function timedFetch(url,options={},timeoutMs=FETCH_TIMEOUT_MS){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);try{return await fetch(url,{...options,signal:c.signal});}finally{clearTimeout(t);}}

function safePlaylistUrl(raw=''){
  const u=new URL(raw);
  if(!/^https?:$/.test(u.protocol))throw new Error('Only http/https playlist URLs are allowed');
  const h=u.hostname.toLowerCase();
  if(h==='localhost'||h==='0.0.0.0'||h==='::1'||h.endsWith('.local')||h==='169.254.169.254')throw new Error('Private/local targets are not allowed');
  const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(m){const a=+m[1],b=+m[2];if(a===10||a===127||a===0||(a===169&&b===254)||(a===192&&b===168)||(a===172&&b>=16&&b<=31))throw new Error('Private IP targets are not allowed');}
  return u;
}
async function proxyPlaylist(raw){
  let target;try{target=safePlaylistUrl(raw);}catch(error){return json({error:error.message},400);}
  try{
    const r=await timedFetch(target,{redirect:'follow',headers:{'user-agent':`Mozilla/5.0 WebTV-PlaylistProxy/${VERSION}`,accept:'text/plain,application/x-mpegURL,application/vnd.apple.mpegurl,*/*'}},10000);
    if(!r.ok)return json({error:`Playlist upstream HTTP ${r.status}`},502);
    const text=(await r.text()).slice(0,PLAYLIST_PROXY_MAX_BYTES);
    if(!/#EXTINF:/i.test(text))return json({error:'Upstream response is not an M3U playlist'},422);
    return new Response(text,{status:200,headers:{...cors(),'content-type':'audio/x-mpegurl;charset=utf-8','cache-control':'no-store','x-webtv-proxy':'playlist'}});
  }catch(error){return json({error:error?.name==='AbortError'?'Playlist upstream timeout':error?.message||String(error)},504);}
}

function classifyEntry(extinf='',url='',channel=''){
  const p=profile(channel),title=entryTitle(extinf),titleNorm=normalize(title),all=`${extinf} ${url}`;
  if(REJECT_VARIANTS.test(all))return false;
  if(channel==='ANT1'&&ANT1_SUBCHANNELS.test(all))return false;
  if(/\b\d{2,3}[.,]\d\b/.test(all)||/listen\.pls|netradio/i.test(all))return false;
  if(!relevant(`${title} ${extinf}`,channel))return false;
  return p.mainNames.some(n=>titleNorm===normalize(n)||titleNorm.startsWith(`${normalize(n)} `))||p.aliases.some(a=>titleNorm.includes(normalize(a)));
}
function parseM3u(text='',channel=''){const lines=String(text).replace(/\r/g,'').split('\n'),out=[];for(let i=0;i<lines.length;i++){const extinf=lines[i].trim();if(!/^#EXTINF:/i.test(extinf)||!relevant(extinf,channel))continue;let stream='';for(let j=i+1;j<Math.min(lines.length,i+10);j++){const next=lines[j].trim();if(!next||next.startsWith('#'))continue;if(/^https?:\/\//i.test(next))stream=cleanUrl(next);break;}if(stream&&classifyEntry(extinf,stream,channel))out.push({url:stream,extinf:extinf.slice(0,500)});}return out;}
function extractLive(text=''){return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd)(?:\?[^\s"'<>]*)?/gi)||[]).map(cleanUrl))].filter(isLiveUrl);}
function extractUsefulLinks(text=''){return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+/gi)||[]).map(cleanUrl))].filter(u=>/github\.com|gist\.github\.com|raw\.githubusercontent\.com|\.m3u(?:\?|$)|iptv|playlist/i.test(u));}
function toRawGithubUrl(input=''){try{const u=new URL(input);if(u.hostname==='github.com'){const p=u.pathname.split('/').filter(Boolean);if(p[2]==='blob'&&p.length>=5)return `https://raw.githubusercontent.com/${p[0]}/${p[1]}/${p[3]}/${p.slice(4).join('/')}`;}if(u.hostname==='gist.github.com'&&!u.pathname.endsWith('/raw'))return `${u.origin}${u.pathname}/raw`;}catch{}return input;}
function urlCarriesChannel(url,channel){return relevant(url,channel);}

async function fetchText(url,budget){budget.take();try{const r=await timedFetch(url,{redirect:'follow',headers:{'user-agent':`Mozilla/5.0 WebTV-SourceHunt/${VERSION}`,accept:'text/plain,text/html,application/json,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'}},FETCH_TIMEOUT_MS);if(!r.ok)return{ok:false,status:r.status,text:'',type:r.headers.get('content-type')||''};return{ok:true,status:r.status,text:(await r.text()).slice(0,MAX_FETCH_BYTES),type:r.headers.get('content-type')||''};}catch(error){return{ok:false,status:error?.name==='AbortError'?408:0,text:'',type:'',error:error?.message||String(error)};}}
async function resolveStrm(url,budget){if(!isStrm(url)||!budget.canUse())return null;const f=await fetchText(toRawGithubUrl(url),budget);if(!f.ok)return null;return extractLive(f.text)[0]||null;}
async function brave(env,q,budget,count=8){if(!env.BRAVE_API_KEY)throw new Error('BRAVE_API_KEY is not configured');budget.take();const u=new URL('https://api.search.brave.com/res/v1/web/search');u.searchParams.set('q',q);u.searchParams.set('count',String(count));u.searchParams.set('freshness','pm');u.searchParams.set('text_decorations','false');u.searchParams.set('search_lang','en');const r=await timedFetch(u,{headers:{Accept:'application/json','X-Subscription-Token':env.BRAVE_API_KEY}},BRAVE_TIMEOUT_MS);if(!r.ok)throw new Error(`Brave ${r.status}`);const j=await r.json();return j?.web?.results||[];}
async function redditSearch(channel,budget){if(!budget.canUse())return[];budget.take();const p=profile(channel),q=`${p.searches[0]||channel} m3u8 IPTV stream playlist`;const u=new URL('https://www.reddit.com/search.json');u.searchParams.set('q',q);u.searchParams.set('sort','new');u.searchParams.set('t','month');u.searchParams.set('limit','15');u.searchParams.set('raw_json','1');try{const r=await timedFetch(u,{headers:{'user-agent':`WebTV-SourceHunt/${VERSION} (+public stream discovery)`}},BRAVE_TIMEOUT_MS);if(!r.ok)return[];const j=await r.json();return(j?.data?.children||[]).map(x=>x?.data).filter(Boolean).map(d=>({title:d.title||'',description:d.selftext||'',url:d.url_overridden_by_dest||`https://www.reddit.com${d.permalink||''}`,permalink:d.permalink?`https://www.reddit.com${d.permalink}`:'',updatedAt:d.created_utc?new Date(d.created_utc*1000).toISOString():null,_kind:'forum',_reddit:true})).filter(r=>freshEnough(r,30));}catch{return[];}}
function candidate(url,kind,origin,source,extra={}){return{url,kind,origin,title:source?.title||source?.name||'',source:source?.url||'',snippet:(source?.description||'').slice(0,280),updatedAt:source?.updatedAt||null,...extra};}
function lead(url,kind,origin,source,extra={}){return{url,kind,origin,title:source?.title||'',snippet:(source?.description||'').slice(0,280),updatedAt:source?.updatedAt||null,...extra};}
async function scanSeed(seed,channel,budget,debug){const out=[],report={type:'seed',name:seed.name,status:null,accepted:0};if(!budget.canUse())return out;const f=await fetchText(seed.url,budget);report.status=f.status;if(f.ok)for(const e of parseM3u(f.text,channel)){let u=e.url,method='extinf-seed';if(isStrm(u)){const rr=await resolveStrm(u,budget);if(!rr)continue;u=rr;method='extinf-seed-strm';}if(isLiveUrl(u))addUnique(out,candidate(u,'seed','Known Greek M3U seed',seed,{method,extinf:e.extinf}));}report.accepted=out.length;if(debug)debug.push(report);return out;}
function resultKind(r){if(r?._kind==='forum')return'forum';if(r?._kind==='web')return'web';const h=hostOf(r.url||'');return/reddit\.com$/.test(h)||/forum|thread|linuxsat/i.test(`${r.url||''} ${r.title||''}`)?'forum':'web';}
function rank(r,channel){const h=hostOf(r.url||'');if(BLOCKED_RESULT_HOSTS.test(h)||LOW_TRUST_HOSTS.test(h))return-100;if(!freshEnough(r,30))return-100;const ctx=`${r.title||''} ${r.description||''} ${r.url||''}`;let s=0;if(relevant(ctx,channel))s+=10;if(/m3u8|iptv|playlist|hls|stream|live tv|television|channel/i.test(ctx))s+=7;if(/github|gist|raw\.githubusercontent/i.test(r.url||''))s+=4;if(/reddit|forum|thread|linuxsat/i.test(ctx))s+=3;if(REJECT_VARIANTS.test(ctx)||/wikipedia|tiktok|celebrity|actress|actor/i.test(ctx))s-=10;return s;}
function tvEvidence(context,channel){return relevant(context,channel)&&/(m3u8|iptv|hls|stream|live tv|television|channel|skai\.gr|ert\.gr|ant1\.gr|alphatv|megatv|star\.gr|open)/i.test(context);}
async function inspectResult(r,channel,budget,debug,{strict=false}={}){const candidates=[],leads=[],kind=resultKind(r),origin=kind==='forum'?'Forums / Reddit':'Fresh Web',context=`${r.title||''}\n${r.description||''}\n${r.url||''}`;const report={type:kind,title:(r.title||'').slice(0,100),status:null,accepted:0,leads:0};if(!freshEnough(r,30)){report.rejected='stale';if(debug)debug.push(report);return{candidates,leads};}for(const u of extractLive(context)){const proven=urlCarriesChannel(u,channel)||(!strict&&tvEvidence(`${context} ${u}`,channel));if(proven&&!REJECT_VARIANTS.test(`${context} ${u}`)&&!(channel==='ANT1'&&ANT1_SUBCHANNELS.test(context)))addUnique(candidates,candidate(u,kind,origin,r,{method:'snippet',provenance:urlCarriesChannel(u,channel)?'channel-in-url':'page-context'}));}for(const u of extractUsefulLinks(context))if(!isLiveUrl(u)&&!explicitOldDate(u))addUnique(leads,lead(u,kind,origin,r,{method:'linked-lead'}));if(!candidates.length&&r.url&&relevant(context,channel)&&!LOW_TRUST_HOSTS.test(hostOf(r.url)))addUnique(leads,lead(r.permalink||r.url,kind,origin,r,{method:r._reddit?'reddit-post':'source-page'}));if(!candidates.length&&r.url&&budget.canUse()){const f=await fetchText(toRawGithubUrl(r.url),budget);report.status=f.status;if(f.ok){for(const e of parseM3u(f.text,channel)){let u=e.url;if(isStrm(u)){const rr=await resolveStrm(u,budget);if(!rr)continue;u=rr;}if(isLiveUrl(u))addUnique(candidates,candidate(u,kind,origin,r,{method:'extinf-page',extinf:e.extinf,provenance:'exact-extinf'}));}for(const u of extractLive(f.text)){if(candidates.some(x=>x.url===u))continue;const idx=f.text.indexOf(u),near=idx>=0?f.text.slice(Math.max(0,idx-500),Math.min(f.text.length,idx+u.length+500)):'';const proven=urlCarriesChannel(u,channel)||(!strict&&tvEvidence(`${context} ${near} ${u}`,channel));if(proven&&!REJECT_VARIANTS.test(`${context} ${near} ${u}`)&&!(channel==='ANT1'&&ANT1_SUBCHANNELS.test(`${context} ${near}`)))addUnique(candidates,candidate(u,kind,origin,r,{method:'nearby',provenance:urlCarriesChannel(u,channel)?'channel-in-url':'nearby-context'}));}for(const u of extractUsefulLinks(f.text))if(!isLiveUrl(u)&&!explicitOldDate(u))addUnique(leads,lead(u,kind,origin,r,{method:'page-lead'}));}}report.accepted=candidates.length;report.leads=leads.length;if(debug)debug.push(report);return{candidates,leads};}
function buildQueries(channel){const p=profile(channel),primary=p.searches[0]||channel,alt=p.searches[1]||primary;return[{kind:'web',q:`"${primary}" m3u8 live ${NEG}`},{kind:'web',q:`"${alt}" IPTV playlist ${NEG}`},{kind:'forum',q:`"${primary}" IPTV forum stream ${NEG}`}];}
async function inspectLead(url,channel){const budget=new Budget(5),source={title:'Lead inspection',url,description:'',updatedAt:new Date().toISOString()};const r=await inspectResult({...source,_kind:/reddit\.com|forum|thread/i.test(url)?'forum':'web'},channel,budget,null,{strict:true});return{version:VERSION,channel,url,candidates:r.candidates,leads:r.leads,subrequestsUsed:budget.used};}
async function runHunt(env,channel,days,wantDebug=false){const started=Date.now(),budget=new Budget(),debug=[],seed=[],web=[],forum=[],webLeads=[],forumLeads=[];const seedRuns=await Promise.all(SEEDS.map(s=>scanSeed(s,channel,budget,wantDebug?debug:null)));for(const rows of seedRuns)for(const c of rows)addUnique(seed,c);const queries=buildQueries(channel);const tasks=[...queries.map(x=>brave(env,x.q,budget,8).then(rows=>({x,rows:rows.filter(r=>freshEnough(r,days))})).catch(error=>({x,rows:[],error}))),redditSearch(channel,budget).then(rows=>({x:{kind:'forum',q:'reddit-json'},rows}))];const queryRuns=await Promise.all(tasks),merged=[];let searches=0;for(const q of queryRuns){if(q.rows.length)searches++;if(q.error&&wantDebug)debug.push({type:'query',query:q.x.q,error:q.error?.message||String(q.error)});for(const r of q.rows)merged.push({...r,_kind:r._kind||q.x.kind});}const ranked=[...new Map(merged.filter(r=>r?.url).map(r=>[`${r._kind}:${r.url}`,r])).values()].map(r=>({r,score:rank(r,channel)})).filter(x=>x.score>=5).sort((a,b)=>b.score-a.score).slice(0,MAX_PAGE_SCANS);const pageRuns=await Promise.all(ranked.map(({r})=>inspectResult(r,channel,budget,wantDebug?debug:null)));for(const res of pageRuns){for(const c of res.candidates){if(c.kind==='forum')addUnique(forum,c);else addUnique(web,c);}for(const l of res.leads){if(l.kind==='forum')addUnique(forumLeads,l);else addUnique(webLeads,l);}}const groups={seed:seed.slice(0,6),web:web.slice(0,6),forums:forum.slice(0,6),webLeads:webLeads.slice(0,MAX_LEADS),forumLeads:forumLeads.slice(0,MAX_LEADS)};const flat=[...groups.seed,...groups.web,...groups.forums].slice(0,MAX_RESULTS);return{version:VERSION,channel,days,candidates:flat,groups,counts:{seed:groups.seed.length,web:groups.web.length,forums:groups.forums.length,webLeads:groups.webLeads.length,forumLeads:groups.forumLeads.length,total:flat.length},freshSearchesRun:searches,resultsScanned:ranked.length,subrequestsUsed:budget.used,subrequestBudget:budget.limit,elapsedMs:Date.now()-started,debug:wantDebug?debug:undefined};}
async function cacheGet(requestUrl){try{const u=new URL(requestUrl);u.searchParams.delete('debug');u.searchParams.set('_v',VERSION);return await caches.default.match(new Request(u.toString(),{method:'GET'}));}catch{return null;}}
async function cachePut(requestUrl,payload){try{const u=new URL(requestUrl);u.searchParams.delete('debug');u.searchParams.set('_v',VERSION);const r=json(payload,200,{'cache-control':`public,max-age=${CACHE_TTL_SECONDS}`});await caches.default.put(new Request(u.toString(),{method:'GET'}),r.clone());}catch{}}

export default{async fetch(request,env){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
  const url=new URL(request.url);
  if(url.pathname==='/playlist-proxy'){const target=(url.searchParams.get('url')||'').trim();if(!target)return json({error:'url is required'},400);return await proxyPlaylist(target);}
  if(url.pathname==='/inspect'){const channel=(url.searchParams.get('channel')||'').trim(),target=(url.searchParams.get('url')||'').trim();if(!channel||!target)return json({error:'channel and url are required'},400);try{return json(await inspectLead(target,channel));}catch(error){return json({error:error?.message||String(error),channel,url:target},500);}}
  if(url.pathname!=='/hunt')return json({ok:true,service:'WebTV Source Hunt Worker',version:VERSION,features:['safe playlist proxy','provenance guard','strict inspect','stale lead rejection','direct Reddit JSON search','Web/Forum leads','strict ANT1 filter','parallel discovery','15m cache'],endpoints:['/hunt?channel=SKAI&days=30','/inspect?channel=SKAI&url=...','/playlist-proxy?url=...']});
  const channel=(url.searchParams.get('channel')||'').trim();const days=Math.min(30,Math.max(1,Number(url.searchParams.get('days')||30)));const wantDebug=url.searchParams.get('debug')==='1';if(!channel)return json({error:'channel is required'},400);
  if(!wantDebug){const hit=await cacheGet(request.url);if(hit){const data=await hit.json();return json({...data,cached:true,elapsedMs:0},200,{'cache-control':'no-store','x-source-hunt-cache':'HIT'});}}
  try{const payload=await runHunt(env,channel,days,wantDebug);payload.cached=false;if(!wantDebug)await cachePut(request.url,payload);return json(payload,200,{'cache-control':'no-store','x-source-hunt-cache':'MISS'});}catch(error){return json({error:error?.message||String(error),channel,days},500);}
}};
