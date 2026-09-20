const ALLOWED_ORIGIN = '*';
const MAX_RESULTS = 12;

const FINGERPRINTS = {
  'ERT1':['ert1','ert 1','ert1.gr'],
  'ERT2':['ert2','ert 2','ert2.gr'],
  'ERT3':['ert3','ert 3','ert3.gr'],
  'ERT News':['ertnews','ert news','ert_news','ert-news'],
  'ANT1':['ant1','antenna1','ant1.gr','antenna'],
  'Alpha TV':['alpha tv','alphatv','alpha.gr'],
  'SKAI':['skai','skaitv','skai tv','skai.gr'],
  'Open TV':['open tv','opentv','open beyond','open.gr'],
  'MEGA':['mega tv','megatv','mega channel','mega.gr'],
  'Star TV':['star tv','startv','star channel','star.gr'],
  'Action 24':['action 24','action24','action tv'],
  'Kontra':['kontra','kontra channel']
};

function cors(){
  return {
    'access-control-allow-origin':ALLOWED_ORIGIN,
    'access-control-allow-methods':'GET,OPTIONS',
    'access-control-allow-headers':'content-type'
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
function aliases(channel){ return FINGERPRINTS[channel] || [String(channel||'').toLowerCase()]; }
function relevant(text,channel){
  const h=normalize(text);
  return aliases(channel).some(a=>h.includes(normalize(a).trim()));
}
function extractM3u8(text=''){
  return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/gi)||[])
    .map(x=>x.replace(/[),.;]+$/g,'')))];
}
function isInterestingUrl(url=''){
  return /github\.com|gist\.github\.com|raw\.githubusercontent\.com|reddit\.com|linuxsat-support\.com|iptv|m3u|playlist|stream|forum/i.test(url);
}

async function braveSearch(env,q,count=20){
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

function contextCandidates(result,channel,origin){
  const context=`${result.title||''}\n${result.description||''}\n${result.url||''}`;
  const out=[];
  for(const url of extractM3u8(context)){
    if(relevant(`${context} ${url}`,channel)){
      out.push({url,origin,title:result.title||'',source:result.url||'',snippet:result.description||'',updatedAt:null});
    }
  }
  return out;
}

async function pageCandidates(result,channel,origin){
  const out=contextCandidates(result,channel,origin);
  if(out.length) return out;
  if(!result.url) return out;

  const resultContext=`${result.title||''}\n${result.description||''}\n${result.url||''}`;
  if(!relevant(resultContext,channel) && !isInterestingUrl(result.url)) return out;

  try{
    const r=await fetch(result.url,{
      redirect:'follow',
      headers:{
        'user-agent':'Mozilla/5.0 WebTV-SourceHunt/1.1',
        accept:'text/html,text/plain,application/json,application/vnd.apple.mpegurl,application/x-mpegURL,*/*'
      }
    });
    if(!r.ok) return out;
    const type=r.headers.get('content-type')||'';
    if(!/(text|json|javascript|mpegurl|m3u)/i.test(type)) return out;

    const text=(await r.text()).slice(0,1800000);
    for(const url of extractM3u8(text)){
      const idx=text.indexOf(url);
      const nearby=idx>=0
        ? text.slice(Math.max(0,idx-700),Math.min(text.length,idx+url.length+700))
        : text.slice(0,1500);
      if(!relevant(`${nearby} ${url} ${resultContext}`,channel)) continue;
      out.push({
        url,
        origin,
        title:result.title||'',
        source:result.url||'',
        snippet:(result.description||'').slice(0,300),
        updatedAt:null
      });
    }
  }catch{}
  return out;
}

async function hunt(env,channel,days){
  const names=aliases(channel);
  const primary=names[0]||channel;
  const compact=names.find(x=>!x.includes(' '))||primary;

  const queries=[
    `"${primary}" m3u8`,
    `"${compact}" m3u8`,
    `"${primary}" HLS IPTV Greece`,
    `"${primary}" playlist m3u8`,
    `"${primary}" site:github.com m3u8`,
    `"${primary}" site:raw.githubusercontent.com`,
    `"${primary}" site:gist.github.com m3u8`,
    `"${primary}" site:reddit.com m3u8`,
    `"${primary}" site:linuxsat-support.com`,
    `"${primary}" IPTV forum stream`
  ];

  const groups=await Promise.allSettled(queries.map(q=>braveSearch(env,q,12)));
  const merged=[];
  let searched=0;
  for(const g of groups){
    searched++;
    if(g.status==='fulfilled') merged.push(...g.value);
  }

  const uniqueResults=[...new Map(merged.filter(r=>r?.url).map(r=>[r.url,r])).values()].slice(0,50);
  const candidates=[];

  for(let i=0;i<uniqueResults.length;i+=5){
    const group=uniqueResults.slice(i,i+5);
    const found=await Promise.all(group.map(r=>{
      const origin=/reddit\.com/i.test(r.url||'')?'Reddit/Web search':
        /linuxsat-support|forum|thread/i.test(`${r.url} ${r.title}`)?'Forum/Web search':
        /github|gist|raw\.githubusercontent/i.test(r.url||'')?'GitHub/Web search':'Web search';
      return pageCandidates(r,channel,origin);
    }));
    candidates.push(...found.flat());
    if(candidates.length>=MAX_RESULTS*2) break;
  }

  const seen=new Set();
  const deduped=candidates.filter(x=>x.url&&!seen.has(x.url)&&seen.add(x.url));
  return {candidates:deduped.slice(0,MAX_RESULTS),searched,resultsScanned:uniqueResults.length};
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url);
    if(url.pathname!=='/hunt') return json({ok:true,service:'WebTV Source Hunt Worker',version:'1.1',endpoint:'/hunt?channel=SKAI&days=30'});

    const channel=(url.searchParams.get('channel')||'').trim();
    const days=Math.min(30,Math.max(1,Number(url.searchParams.get('days')||30)));
    if(!channel) return json({error:'channel is required'},400);

    try{
      const result=await hunt(env,channel,days);
      return json({channel,days,...result,count:result.candidates.length});
    }catch(error){
      return json({error:error.message||String(error),channel,days},500);
    }
  }
};
