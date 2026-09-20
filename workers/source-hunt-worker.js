const ALLOWED_ORIGIN = '*';
const MAX_RESULTS = 12;
const MAX_DEBUG = 30;

const PROFILES = {
  'ERT1': {
    aliases: ['ert1','ert 1','ert1.gr','ερτ1'],
    searches: ['ERT1 Greece','ERT 1 Greece','ERT1.gr','ΕΡΤ1'],
  },
  'ERT2': {
    aliases: ['ert2','ert 2','ert2.gr','ερτ2'],
    searches: ['ERT2 Greece','ERT 2 Greece','ERT2.gr','ΕΡΤ2'],
  },
  'ERT3': {
    aliases: ['ert3','ert 3','ert3.gr','ερτ3'],
    searches: ['ERT3 Greece','ERT 3 Greece','ERT3.gr','ΕΡΤ3'],
  },
  'ERT News': {
    aliases: ['ertnews','ert news','ert_news','ert-news','ertnews.gr','ερτnews'],
    searches: ['ERT News Greece','ERTNEWS Greece','ERTNEWS.gr','ΕΡΤ NEWS'],
  },
  'ANT1': {
    aliases: ['ant1','antenna1','ant1.gr','antenna','ant1 hd'],
    searches: ['ANT1 TV Greece','Antenna Greece TV','ANT1.gr live','ANT1 HD Greece'],
  },
  'Alpha TV': {
    aliases: ['alpha tv','alphatv','alpha.gr','alpha hd'],
    searches: ['Alpha TV Greece','AlphaTV Greece','Alpha.gr live','Alpha HD Greece'],
  },
  'SKAI': {
    aliases: ['skai','skaitv','skai tv','skai.gr','skai hd','σκαι','σκαϊ'],
    searches: ['SKAI TV Greece','SKAI.gr live TV','SkaiTV.gr','ΣΚΑΪ τηλεόραση','SKAI HD Greece'],
  },
  'Open TV': {
    aliases: ['open tv','opentv','open beyond','open.gr','open hd'],
    searches: ['OPEN TV Greece','OPEN Beyond Greece','OPEN.gr live TV','OPEN HD Greece'],
  },
  'MEGA': {
    aliases: ['mega tv','megatv','mega channel','mega.gr','mega hd'],
    searches: ['MEGA TV Greece','Mega Channel Greece','MEGA.gr live','MEGA HD Greece'],
  },
  'Star TV': {
    aliases: ['star tv','startv','star channel','star.gr','star hd'],
    searches: ['STAR TV Greece','Star Channel Greece','STAR.gr live','STAR HD Greece'],
  },
  'Action 24': {
    aliases: ['action 24','action24','action tv','action24.gr'],
    searches: ['Action 24 Greece','Action24 TV Greece','Action24.gr live'],
  },
  'Kontra': {
    aliases: ['kontra','kontra channel','kontra tv','kontrachannel'],
    searches: ['Kontra Channel Greece','Kontra TV Greece','Kontra live Greece'],
  },
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
    headers:{
      ...cors(),
      'content-type':'application/json;charset=utf-8',
      'cache-control':'no-store'
    }
  });
}

function normalize(s=''){
  return String(s).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi,' ');
}

function profile(channel){
  return PROFILES[channel] || {
    aliases:[String(channel||'').toLowerCase()],
    searches:[String(channel||'')]
  };
}

function relevant(text,channel){
  const h=normalize(text);
  return profile(channel).aliases.some(a=>h.includes(normalize(a).trim()));
}

function extractDirectStreams(text=''){
  return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd|mp4|webm)(?:\?[^\s"'<>]*)?/gi)||[])
    .map(x=>x.replace(/[),.;]+$/g,'')))];
}

function extractPlaylistLinks(text=''){
  return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.m3u(?:8)?(?:\?[^\s"'<>]*)?/gi)||[])
    .map(x=>x.replace(/[),.;]+$/g,'')))];
}

function parseM3uEntries(text='',channel=''){
  const lines=String(text).replace(/\r/g,'').split('\n');
  const out=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!/^#EXTINF:/i.test(line)) continue;
    if(!relevant(line,channel)) continue;

    let url='';
    for(let j=i+1;j<Math.min(lines.length,i+8);j++){
      const next=lines[j].trim();
      if(!next) continue;
      if(next.startsWith('#')) continue;
      if(/^https?:\/\//i.test(next)) url=next;
      break;
    }

    if(url){
      out.push({
        url:url.replace(/[),.;]+$/g,''),
        extinf:line.slice(0,500)
      });
    }
  }
  return out;
}

function toRawGithubUrl(input=''){
  try{
    const u=new URL(input);
    if(u.hostname==='github.com'){
      const parts=u.pathname.split('/').filter(Boolean);
      if(parts[2]==='blob' && parts.length>=5){
        return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts[3]}/${parts.slice(4).join('/')}`;
      }
    }
    if(u.hostname==='gist.github.com'){
      const parts=u.pathname.split('/').filter(Boolean);
      if(parts.length>=2 && !u.pathname.endsWith('/raw')){
        return `${u.origin}${u.pathname}/raw`;
      }
    }
  }catch{}
  return input;
}

function isInterestingUrl(url=''){
  return /github\.com|gist\.github\.com|raw\.githubusercontent\.com|reddit\.com|linuxsat-support\.com|iptv|m3u|playlist|stream|forum/i.test(url);
}

async function braveSearch(env,q,count=12){
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

async function inspectResult(result,channel,origin,debug){
  const report={
    title:(result.title||'').slice(0,140),
    resultUrl:result.url||'',
    fetchUrl:'',
    status:null,
    contentType:'',
    directFound:0,
    m3uEntriesFound:0,
    accepted:0,
    reason:''
  };

  const out=[];
  const context=`${result.title||''}\n${result.description||''}\n${result.url||''}`;

  for(const url of extractDirectStreams(context)){
    if(relevant(`${context} ${url}`,channel)){
      out.push(candidate(url,origin,result,{method:'brave-snippet'}));
    }
  }
  if(out.length){
    report.directFound=out.length;
    report.accepted=out.length;
    report.reason='direct stream in Brave result';
    if(debug) debug.push(report);
    return out;
  }

  if(!result.url){
    report.reason='missing URL';
    if(debug) debug.push(report);
    return out;
  }

  if(!relevant(context,channel) && !isInterestingUrl(result.url)){
    report.reason='not channel-relevant';
    if(debug) debug.push(report);
    return out;
  }

  const fetchUrl=toRawGithubUrl(result.url);
  report.fetchUrl=fetchUrl;

  try{
    const r=await fetch(fetchUrl,{
      redirect:'follow',
      headers:{
        'user-agent':'Mozilla/5.0 WebTV-SourceHunt/1.3',
        accept:'text/plain,text/html,application/json,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'
      }
    });
    report.status=r.status;
    report.contentType=r.headers.get('content-type')||'';
    if(!r.ok){
      report.reason=`fetch failed ${r.status}`;
      if(debug) debug.push(report);
      return out;
    }

    const text=(await r.text()).slice(0,2000000);

    const m3uEntries=parseM3uEntries(text,channel);
    report.m3uEntriesFound=m3uEntries.length;
    for(const e of m3uEntries){
      out.push(candidate(e.url,origin,result,{method:'extinf',extinf:e.extinf}));
    }

    const direct=extractDirectStreams(text);
    report.directFound=direct.length;
    for(const url of direct){
      if(out.some(x=>x.url===url)) continue;
      const idx=text.indexOf(url);
      const nearby=idx>=0
        ? text.slice(Math.max(0,idx-700),Math.min(text.length,idx+url.length+700))
        : text.slice(0,1500);
      if(relevant(`${nearby} ${url} ${context}`,channel)){
        out.push(candidate(url,origin,result,{method:'nearby'}));
      }
    }

    report.accepted=out.length;
    report.reason=out.length
      ? 'accepted EXTINF/direct candidates'
      : 'page fetched, no matching stream';
  }catch(error){
    report.reason=`fetch exception: ${error?.message||String(error)}`;
  }

  if(debug) debug.push(report);
  return out;
}

function buildQueries(channel){
  const p=profile(channel);
  const names=p.searches.slice(0,4);
  const q=[];

  for(const name of names){
    q.push(`"${name}" m3u8 ${NEGATIVE_TERMS}`);
    q.push(`"${name}" "#EXTINF" m3u ${NEGATIVE_TERMS}`);
  }

  const primary=names[0]||channel;
  q.push(`"${primary}" IPTV playlist Greece ${NEGATIVE_TERMS}`);
  q.push(`"${primary}" site:github.com "#EXTINF" ${NEGATIVE_TERMS}`);
  q.push(`"${primary}" site:gist.github.com m3u ${NEGATIVE_TERMS}`);
  q.push(`"${primary}" site:reddit.com IPTV stream ${NEGATIVE_TERMS}`);
  q.push(`"${primary}" site:linuxsat-support.com IPTV ${NEGATIVE_TERMS}`);

  return [...new Set(q)].slice(0,12);
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

  const uniqueResults=[...new Map(merged.filter(r=>r?.url).map(r=>[r.url,r])).values()].slice(0,60);
  const candidates=[];
  const pageDebug=[];

  for(let i=0;i<uniqueResults.length;i+=5){
    const group=uniqueResults.slice(i,i+5);
    const found=await Promise.all(group.map(r=>{
      const origin=/reddit\.com/i.test(r.url||'') ? 'Reddit/Web search'
        : /linuxsat-support|forum|thread/i.test(`${r.url} ${r.title}`) ? 'Forum/Web search'
        : /github|gist|raw\.githubusercontent/i.test(r.url||'') ? 'GitHub/Web search'
        : 'Web search';
      return inspectResult(r,channel,origin,wantDebug && pageDebug.length<MAX_DEBUG ? pageDebug : null);
    }));
    candidates.push(...found.flat());
    if(candidates.length>=MAX_RESULTS*3) break;
  }

  const seen=new Set();
  const deduped=candidates.filter(x=>x.url&&!seen.has(x.url)&&seen.add(x.url));

  const result={
    candidates:deduped.slice(0,MAX_RESULTS),
    searched:queries.length,
    resultsScanned:uniqueResults.length
  };
  if(wantDebug){
    result.debug={queries:queryDebug,pages:pageDebug.slice(0,MAX_DEBUG)};
  }
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
        version:'1.3',
        features:['channel profiles','m3u discovery','EXTINF pairing','direct streams'],
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
