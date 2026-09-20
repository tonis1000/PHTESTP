const ALLOWED_ORIGIN = '*';
const MAX_RESULTS = 12;
const MAX_DEBUG = 40;
const MAX_PLAYLIST_LINKS_PER_PAGE = 5;
const MAX_FETCH_BYTES = 2000000;

const PROFILES = {
  'ERT1': { aliases:['ert1','ert 1','ert1.gr','ερτ1'], searches:['ERT1','ERT 1','ERT1 Greece','ΕΡΤ1'] },
  'ERT2': { aliases:['ert2','ert 2','ert2.gr','ερτ2'], searches:['ERT2','ERT 2','ERT2 Greece','ΕΡΤ2'] },
  'ERT3': { aliases:['ert3','ert 3','ert3.gr','ερτ3'], searches:['ERT3','ERT 3','ERT3 Greece','ΕΡΤ3'] },
  'ERT News': { aliases:['ertnews','ert news','ert_news','ert-news','ertnews.gr','ερτ news'], searches:['ERT News','ERTNEWS','ERTNEWS Greece','ΕΡΤ NEWS'] },
  'ANT1': { aliases:['ant1','antenna1','ant1.gr','antenna','ant1 hd'], searches:['ANT1','ANT1 TV','Antenna Greece','ANT1 Greece'] },
  'Alpha TV': { aliases:['alpha tv','alphatv','alpha.gr','alpha hd'], searches:['Alpha TV','AlphaTV','Alpha Greece','Alpha TV Greece'] },
  'SKAI': { aliases:['skai','skaitv','skai tv','skai.gr','skai hd','σκαι','σκαϊ'], searches:['SKAI','SKAI TV','SKAI Greece','ΣΚΑΪ'] },
  'Open TV': { aliases:['open tv','opentv','open beyond','open.gr','open hd'], searches:['OPEN TV','OPEN Beyond','OPEN Greece','OPEN TV Greece'] },
  'MEGA': { aliases:['mega tv','megatv','mega channel','mega.gr','mega hd'], searches:['MEGA TV','Mega Channel','MEGA Greece','MEGA TV Greece'] },
  'Star TV': { aliases:['star tv','startv','star channel','star.gr','star hd'], searches:['STAR TV','Star Channel Greece','STAR Greece','STAR TV Greece'] },
  'Action 24': { aliases:['action 24','action24','action tv','action24.gr'], searches:['Action 24','Action24','Action 24 Greece'] },
  'Kontra': { aliases:['kontra','kontra channel','kontra tv','kontrachannel'], searches:['Kontra','Kontra Channel','Kontra TV Greece'] },
};

const NEGATIVE_TERMS = '-crypto -coin -token -restaurant -tiktok -music -lyrics -celebrity -game -gaming';

function cors(){
  return {
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}
  });
}

function normalize(s=''){
  return String(s).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi,' ');
}

function profile(channel){
  return PROFILES[channel] || { aliases:[String(channel||'').toLowerCase()], searches:[String(channel||'')] };
}

function relevant(text,channel){
  const h=normalize(text);
  return profile(channel).aliases.some(a=>h.includes(normalize(a).trim()));
}

function cleanUrl(url=''){
  return String(url).replace(/&amp;/g,'&').replace(/\\\//g,'/').replace(/[),.;]+$/g,'');
}

function extractDirectStreams(text=''){
  return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd|mp4|webm)(?:\?[^\s"'<>]*)?/gi)||[]).map(cleanUrl))];
}

function extractPlaylistLinks(text='',baseUrl=''){
  const found=[];
  const src=String(text).replace(/&amp;/g,'&').replace(/\\\//g,'/');

  for(const m of src.matchAll(/https?:\/\/[^\s"'<>]+?\.m3u(?:\?[^\s"'<>]*)?/gi)) found.push(cleanUrl(m[0]));

  for(const m of src.matchAll(/(?:href|src)\s*=\s*["']([^"']+?\.m3u(?:\?[^"']*)?)["']/gi)){
    try{ found.push(new URL(m[1],baseUrl).href); }catch{}
  }

  return [...new Set(found)];
}

function parseM3uEntries(text='',channel=''){
  const lines=String(text).replace(/\r/g,'').split('\n');
  const out=[];

  for(let i=0;i<lines.length;i++){
    const extinf=lines[i].trim();
    if(!/^#EXTINF:/i.test(extinf)) continue;
    if(!relevant(extinf,channel)) continue;

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

function toRawGithubUrl(input=''){
  try{
    const u=new URL(input);
    if(u.hostname==='github.com'){
      const p=u.pathname.split('/').filter(Boolean);
      if(p[2]==='blob' && p.length>=5) return `https://raw.githubusercontent.com/${p[0]}/${p[1]}/${p[3]}/${p.slice(4).join('/')}`;
    }
    if(u.hostname==='gist.github.com'){
      const p=u.pathname.split('/').filter(Boolean);
      if(p.length>=2 && !u.pathname.endsWith('/raw')) return `${u.origin}${u.pathname}/raw`;
    }
  }catch{}
  return input;
}

function isInterestingUrl(url=''){
  return /github\.com|gist\.github\.com|raw\.githubusercontent\.com|reddit\.com|linuxsat-support\.com|iptv|m3u|playlist|stream|forum/i.test(url);
}

async function braveSearch(env,q,count=10){
  if(!env.BRAVE_API_KEY) throw new Error('BRAVE_API_KEY is not configured');
  const u=new URL('https://api.search.brave.com/res/v1/web/search');
  u.searchParams.set('q',q);
  u.searchParams.set('count',String(count));
  u.searchParams.set('freshness','pm');
  u.searchParams.set('text_decorations','false');
  u.searchParams.set('search_lang','en');
  const r=await fetch(u,{headers:{Accept:'application/json','X-Subscription-Token':env.BRAVE_API_KEY}});
  if(!r.ok) throw new Error(`Brave ${r.status}`);
  const j=await r.json();
  return j?.web?.results||[];
}

async function fetchText(url){
  const r=await fetch(url,{
    redirect:'follow',
    headers:{
      'user-agent':'Mozilla/5.0 WebTV-SourceHunt/1.4',
      accept:'text/plain,text/html,application/json,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'
    }
  });
  const type=r.headers.get('content-type')||'';
  if(!r.ok) return {ok:false,status:r.status,type,text:''};
  const text=(await r.text()).slice(0,MAX_FETCH_BYTES);
  return {ok:true,status:r.status,type,text};
}

function candidate(url,origin,result,extra={}){
  return {
    url,
    origin,
    title:result?.title||'',
    source:result?.url||'',
    snippet:(result?.description||'').slice(0,300),
    updatedAt:null,
    ...extra
  };
}

async function scanPlaylistUrl(url,channel,origin,result,debug,sourceLabel='linked-m3u'){
  const report={type:'playlist',url,status:null,contentType:'',entries:0,accepted:0,reason:''};
  const out=[];

  try{
    const fetched=await fetchText(toRawGithubUrl(url));
    report.status=fetched.status;
    report.contentType=fetched.type;
    if(!fetched.ok){
      report.reason=`playlist fetch failed ${fetched.status}`;
      if(debug) debug.push(report);
      return out;
    }

    const entries=parseM3uEntries(fetched.text,channel);
    report.entries=entries.length;
    for(const e of entries){
      out.push(candidate(e.url,origin,result,{method:'extinf',extinf:e.extinf,playlist:url,sourceLabel}));
    }
    report.accepted=out.length;
    report.reason=out.length?'matching EXTINF entries':'playlist fetched, channel not found';
  }catch(error){
    report.reason=`playlist exception: ${error?.message||String(error)}`;
  }

  if(debug) debug.push(report);
  return out;
}

async function inspectResult(result,channel,origin,debug){
  const report={
    type:'page',
    title:(result.title||'').slice(0,140),
    resultUrl:result.url||'',
    fetchUrl:'',
    status:null,
    contentType:'',
    directFound:0,
    playlistLinksFound:0,
    m3uEntriesFound:0,
    accepted:0,
    reason:''
  };

  const out=[];
  const context=`${result.title||''}\n${result.description||''}\n${result.url||''}`;

  for(const url of extractDirectStreams(context)){
    if(relevant(`${context} ${url}`,channel)) out.push(candidate(url,origin,result,{method:'brave-snippet'}));
  }

  if(!result.url){
    report.accepted=out.length;
    report.reason=out.length?'direct stream in snippet':'missing URL';
    if(debug) debug.push(report);
    return out;
  }

  const pageLooksUseful=relevant(context,channel)||isInterestingUrl(result.url)||/greek|greece|iptv|m3u|playlist/i.test(context);
  if(!pageLooksUseful){
    report.accepted=out.length;
    report.reason=out.length?'direct stream in snippet':'not useful';
    if(debug) debug.push(report);
    return out;
  }

  const fetchUrl=toRawGithubUrl(result.url);
  report.fetchUrl=fetchUrl;

  try{
    const fetched=await fetchText(fetchUrl);
    report.status=fetched.status;
    report.contentType=fetched.type;
    if(!fetched.ok){
      report.accepted=out.length;
      report.reason=`fetch failed ${fetched.status}`;
      if(debug) debug.push(report);
      return out;
    }

    const text=fetched.text;

    const ownEntries=parseM3uEntries(text,channel);
    report.m3uEntriesFound=ownEntries.length;
    for(const e of ownEntries){
      if(!out.some(x=>x.url===e.url)) out.push(candidate(e.url,origin,result,{method:'extinf-page',extinf:e.extinf,playlist:fetchUrl}));
    }

    const playlistLinks=extractPlaylistLinks(text,fetchUrl)
      .filter(u=>!u.toLowerCase().endsWith('.m3u8'))
      .slice(0,MAX_PLAYLIST_LINKS_PER_PAGE);
    report.playlistLinksFound=playlistLinks.length;

    for(const playlistUrl of playlistLinks){
      const found=await scanPlaylistUrl(playlistUrl,channel,origin,result,debug,'page-linked-m3u');
      for(const c of found) if(!out.some(x=>x.url===c.url)) out.push(c);
    }

    const direct=extractDirectStreams(text);
    report.directFound=direct.length;
    for(const url of direct){
      if(out.some(x=>x.url===url)) continue;
      const idx=text.indexOf(url);
      const nearby=idx>=0 ? text.slice(Math.max(0,idx-900),Math.min(text.length,idx+url.length+900)) : text.slice(0,1800);
      if(relevant(`${nearby} ${url} ${context}`,channel)) out.push(candidate(url,origin,result,{method:'nearby'}));
    }

    report.accepted=out.length;
    report.reason=out.length?'accepted candidates':'page fetched, no channel stream';
  }catch(error){
    report.accepted=out.length;
    report.reason=`fetch exception: ${error?.message||String(error)}`;
  }

  if(debug) debug.push(report);
  return out;
}

function buildQueries(channel){
  const p=profile(channel);
  const primary=p.searches[0]||channel;
  const alt=p.searches[1]||primary;

  const broad=[
    `Greek IPTV m3u ${NEGATIVE_TERMS}`,
    `Greece TV m3u playlist ${NEGATIVE_TERMS}`,
    `Greek channels m3u ${NEGATIVE_TERMS}`,
    `Greek IPTV playlist ${NEGATIVE_TERMS}`,
    `site:github.com Greek IPTV m3u ${NEGATIVE_TERMS}`,
    `site:gist.github.com Greek IPTV m3u ${NEGATIVE_TERMS}`
  ];

  const channelSpecific=[
    `"${primary}" m3u ${NEGATIVE_TERMS}`,
    `"${primary}" IPTV ${NEGATIVE_TERMS}`,
    `"${primary}" playlist ${NEGATIVE_TERMS}`,
    `"${primary}" EXTINF ${NEGATIVE_TERMS}`,
    `"${alt}" m3u8 ${NEGATIVE_TERMS}`,
    `"${primary}" site:reddit.com IPTV ${NEGATIVE_TERMS}`
  ];

  return [...new Set([...broad,...channelSpecific])].slice(0,12);
}

async function hunt(env,channel,days,wantDebug=false){
  const queries=buildQueries(channel);
  const groups=await Promise.allSettled(queries.map(q=>braveSearch(env,q,10)));
  const merged=[];
  const queryDebug=[];

  for(let i=0;i<groups.length;i++){
    const g=groups[i];
    if(g.status==='fulfilled'){
      merged.push(...g.value);
      if(wantDebug) queryDebug.push({query:queries[i],results:g.value.length});
    }else if(wantDebug){
      queryDebug.push({query:queries[i],error:g.reason?.message||String(g.reason)});
    }
  }

  const uniqueResults=[...new Map(merged.filter(r=>r?.url).map(r=>[r.url,r])).values()].slice(0,70);
  const candidates=[];
  const scanDebug=[];

  for(let i=0;i<uniqueResults.length;i+=4){
    const group=uniqueResults.slice(i,i+4);
    const found=await Promise.all(group.map(r=>{
      const origin=/reddit\.com/i.test(r.url||'')?'Reddit/Web search'
        :/linuxsat-support|forum|thread/i.test(`${r.url} ${r.title}`)?'Forum/Web search'
        :/github|gist|raw\.githubusercontent/i.test(r.url||'')?'GitHub/Web search':'Web search';
      return inspectResult(r,channel,origin,wantDebug && scanDebug.length<MAX_DEBUG?scanDebug:null);
    }));
    candidates.push(...found.flat());
    if(candidates.length>=MAX_RESULTS*3) break;
  }

  const seen=new Set();
  const deduped=candidates.filter(x=>x.url&&!seen.has(x.url)&&seen.add(x.url));
  const result={candidates:deduped.slice(0,MAX_RESULTS),searched:queries.length,resultsScanned:uniqueResults.length};
  if(wantDebug) result.debug={queries:queryDebug,scans:scanDebug.slice(0,MAX_DEBUG)};
  return result;
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);

    if(url.pathname!=='/hunt'){
      return json({
        ok:true,
        service:'WebTV Source Hunt Worker',
        version:'1.4',
        features:['broad Greek M3U discovery','HTML playlist-link following','exact EXTINF pairing','direct streams','debug scans'],
        endpoint:'/hunt?channel=SKAI&days=30&debug=1'
      });
    }

    const channel=(url.searchParams.get('channel')||'').trim();
    const days=Math.min(30,Math.max(1,Number(url.searchParams.get('days')||30)));
    const wantDebug=url.searchParams.get('debug')==='1';
    if(!channel) return json({error:'channel is required'},400);

    try{
      const result=await hunt(env,channel,days,wantDebug);
      return json({channel,days,...result,count:result.candidates.length});
    }catch(error){
      return json({error:error.message||String(error),channel,days},500);
    }
  }
};
