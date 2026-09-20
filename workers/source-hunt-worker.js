const ALLOWED_ORIGIN = '*';
const MAX_RESULTS = 12;

const FINGERPRINTS = {
  'ERT1':['ert1','ert 1','ert1.gr'], 'ERT2':['ert2','ert 2','ert2.gr'], 'ERT3':['ert3','ert 3','ert3.gr'],
  'ERT News':['ertnews','ert news','ert_news'], 'ANT1':['ant1','antenna1','ant1.gr'], 'Alpha TV':['alpha tv','alphatv','alpha.gr'],
  'SKAI':['skai','skaitv','skai tv'], 'Open TV':['open tv','opentv','open beyond'], 'MEGA':['mega tv','megatv','mega channel'],
  'Star TV':['star tv','startv','star channel'], 'Action 24':['action 24','action24','action tv'], 'Kontra':['kontra','kontra channel']
};

function cors(){ return {'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'}; }
function json(data,status=200){ return new Response(JSON.stringify(data),{status,headers:{...cors(),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}}); }
function normalize(s=''){ return String(s).toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/gi,' '); }
function aliases(channel){ return FINGERPRINTS[channel] || [String(channel||'').toLowerCase()]; }
function relevant(text,channel){ const h=normalize(text); return aliases(channel).some(a=>h.includes(normalize(a).trim())); }
function extractM3u8(text=''){ return [...new Set((String(text).match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/gi)||[]).map(x=>x.replace(/[),.;]+$/g,'')))]; }

async function braveSearch(env,q,count=20){
  if(!env.BRAVE_API_KEY) throw new Error('BRAVE_API_KEY is not configured');
  const u=new URL('https://api.search.brave.com/res/v1/web/search'); u.searchParams.set('q',q); u.searchParams.set('count',String(count)); u.searchParams.set('freshness','pm'); u.searchParams.set('text_decorations','false'); u.searchParams.set('search_lang','en');
  const r=await fetch(u,{headers:{Accept:'application/json','X-Subscription-Token':env.BRAVE_API_KEY}}); if(!r.ok) throw new Error(`Brave ${r.status}`); const j=await r.json(); return j?.web?.results||[];
}

async function pageCandidates(result,channel,origin){
  const context=`${result.title||''}\n${result.description||''}\n${result.url||''}`; const out=[];
  for(const url of extractM3u8(context)) if(relevant(`${context} ${url}`,channel)) out.push({url,origin,title:result.title||'',source:result.url||'',snippet:result.description||'',updatedAt:null});
  if(out.length) return out;
  if(!result.url || !relevant(context,channel)) return out;
  try{
    const r=await fetch(result.url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 WebTV-SourceHunt/1.0','accept':'text/html,text/plain,application/json,*/*'}}); if(!r.ok) return out; const type=r.headers.get('content-type')||''; if(!/(text|json|javascript|mpegurl|m3u)/i.test(type)) return out; const text=(await r.text()).slice(0,1500000);
    if(!relevant(text,channel) && !relevant(result.url,channel)) return out;
    for(const url of extractM3u8(text)){
      const idx=text.indexOf(url); const nearby=idx>=0?text.slice(Math.max(0,idx-500),Math.min(text.length,idx+url.length+500)):text;
      if(!relevant(`${nearby} ${url}`,channel)) continue;
      out.push({url,origin,title:result.title||'',source:result.url||'',snippet:(result.description||'').slice(0,300),updatedAt:null});
    }
  }catch{}
  return out;
}

async function hunt(env,channel,days){
  const primary=aliases(channel)[0]||channel;
  const queries=[
    `"${primary}" (m3u8 OR HLS OR playlist.m3u8) Greece`,
    `"${primary}" m3u8 IPTV Greece`,
    `"${primary}" m3u8 (forum OR thread OR IPTV)`,
    `"${primary}" m3u8 site:reddit.com OR site:linuxsat-support.com OR site:github.com`
  ];
  const groups=await Promise.allSettled(queries.map(q=>braveSearch(env,q,15)));
  const merged=[]; for(const g of groups) if(g.status==='fulfilled') merged.push(...g.value);
  const uniqueResults=[...new Map(merged.map(r=>[r.url,r])).values()].slice(0,24);
  const batches=[];
  for(let i=0;i<uniqueResults.length;i+=6){ batches.push(...(await Promise.all(uniqueResults.slice(i,i+6).map(r=>pageCandidates(r,channel,/reddit|linuxsat|forum|thread/i.test(`${r.url} ${r.title}`)?'Forum/Web search':'Web search')))).flat()); }
  const seen=new Set(); return batches.filter(x=>x.url&&!seen.has(x.url)&&seen.add(x.url)).slice(0,MAX_RESULTS);
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors()});
    const url=new URL(request.url); if(url.pathname!=='/hunt') return json({ok:true,service:'WebTV Source Hunt Worker',endpoint:'/hunt?channel=SKAI&days=30'});
    const channel=(url.searchParams.get('channel')||'').trim(); const days=Math.min(30,Math.max(1,Number(url.searchParams.get('days')||30))); if(!channel) return json({error:'channel is required'},400);
    try{ const candidates=await hunt(env,channel,days); return json({channel,days,candidates,count:candidates.length}); }
    catch(error){ return json({error:error.message||String(error),channel,days},500); }
  }
};
