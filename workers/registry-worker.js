const VERSION = '1.2';

function cors(origin='*'){
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400'
  };
}
function json(data,status=200,origin='*'){return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}
function text(data,status=200,type='text/plain;charset=utf-8',origin='*'){return new Response(data,{status,headers:{...cors(origin),'content-type':type,'cache-control':'no-store'}});}
function clean(value=''){return String(value??'').trim();}
function escAttr(value=''){return clean(value).replace(/"/g,"'");}
function normalizeId(value=''){return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,160);}
function safeId(value=''){return normalizeId(value)||`ch-${crypto.randomUUID()}`;}
function requestOrigin(request,env){const allowed=clean(env.ALLOWED_ORIGIN);if(!allowed||allowed==='*')return '*';const origin=request.headers.get('origin')||'';return origin===allowed?origin:allowed;}
function requireAdmin(request,env){if(!env.ADMIN_TOKEN)return{ok:false,response:json({error:'ADMIN_TOKEN is not configured'},503,requestOrigin(request,env))};const auth=request.headers.get('authorization')||'';const token=auth.replace(/^Bearer\s+/i,'').trim();if(!token||token!==env.ADMIN_TOKEN)return{ok:false,response:json({error:'Unauthorized'},401,requestOrigin(request,env))};return{ok:true};}
async function readJson(request){try{return await request.json();}catch{throw new Error('Invalid JSON body');}}

async function listPlaylists(env){const r=await env.DB.prepare(`SELECT id,name,kind,source_url AS sourceUrl,channel_count AS channelCount,group_count AS groupCount,created_at AS createdAt,updated_at AS updatedAt FROM playlists ORDER BY updated_at DESC`).all();return r.results||[];}
async function getPlaylist(env,id){return await env.DB.prepare(`SELECT id,name,kind,source_url AS sourceUrl,raw_m3u AS rawM3u,channel_count AS channelCount,group_count AS groupCount,created_at AS createdAt,updated_at AS updatedAt FROM playlists WHERE id=?`).bind(id).first();}
async function upsertSavedPlaylist(env,payload){
  const id=clean(payload.id)||`pl-${crypto.randomUUID()}`;
  const name=clean(payload.name)||'Saved Playlist';
  const kind=clean(payload.kind)||'saved';
  const sourceUrl=clean(payload.sourceUrl||payload.url);
  const rawM3u=String(payload.rawM3u||payload.text||'');
  if(!rawM3u.includes('#EXTINF')) throw new Error('rawM3u must contain #EXTINF entries');
  const channelCount=Math.max(0,Number(payload.channelCount)||0);
  const groupCount=Math.max(0,Number(payload.groupCount)||0);
  await env.DB.prepare(`INSERT INTO playlists(id,name,kind,source_url,raw_m3u,channel_count,group_count,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,source_url=excluded.source_url,raw_m3u=excluded.raw_m3u,channel_count=excluded.channel_count,group_count=excluded.group_count,updated_at=CURRENT_TIMESTAMP`)
    .bind(id,name,kind,sourceUrl,rawM3u,channelCount,groupCount).run();
  return {id,name,kind,sourceUrl,channelCount,groupCount};
}

async function myPlaylist(env){
  const channelsResult=await env.DB.prepare(`SELECT c.id,c.name,c.tvg_id AS tvgId,c.logo,c.group_name AS groupName,c.enabled,m.position,m.added_at AS addedAt
    FROM my_playlist m JOIN channels c ON c.id=m.channel_id
    WHERE c.enabled=1 ORDER BY m.position ASC,c.name COLLATE NOCASE ASC`).all();
  const channels=channelsResult.results||[];
  if(!channels.length)return[];
  const ids=channels.map(c=>c.id),placeholders=ids.map(()=>'?').join(',');
  const sourcesResult=await env.DB.prepare(`SELECT id,channel_id AS channelId,url,origin,priority,enabled,last_success AS lastSuccess,last_failure AS lastFailure,startup_ms AS startupMs,updated_at AS updatedAt
    FROM channel_sources WHERE enabled=1 AND channel_id IN (${placeholders}) ORDER BY channel_id,priority ASC,id ASC`).bind(...ids).all();
  const by=new Map();for(const s of sourcesResult.results||[]){if(!by.has(s.channelId))by.set(s.channelId,[]);by.get(s.channelId).push(s);}
  return channels.map(c=>({...c,sources:by.get(c.id)||[]}));
}

async function putMyChannel(env,payload){
  const name=clean(payload.name);if(!name)throw new Error('Channel name is required');
  const id=safeId(payload.id||payload.tvgId||name);
  const tvgId=clean(payload.tvgId||payload.originalId||payload.id||name);
  const logo=clean(payload.logo),groupName=clean(payload.groupName||payload.group)||'Other';
  let sources=Array.isArray(payload.sources)?payload.sources:[];
  if(!sources.length&&Array.isArray(payload.directUrls))sources=payload.directUrls.map(url=>({url,origin:'playlist'}));
  sources=sources.map((s,i)=>typeof s==='string'?{url:s,origin:'playlist',priority:100+i}:s).filter(s=>/^https?:\/\//i.test(clean(s?.url)));
  const position=Number.isFinite(Number(payload.position))?Number(payload.position):999999;
  const statements=[
    env.DB.prepare(`INSERT INTO channels(id,name,tvg_id,logo,group_name,enabled,created_at,updated_at)
      VALUES(?,?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,tvg_id=excluded.tvg_id,logo=excluded.logo,group_name=excluded.group_name,enabled=1,updated_at=CURRENT_TIMESTAMP`).bind(id,name,tvgId,logo,groupName),
    env.DB.prepare(`INSERT INTO my_playlist(channel_id,position,added_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(channel_id) DO UPDATE SET position=excluded.position`).bind(id,position)
  ];
  if(payload.replaceSources)statements.push(env.DB.prepare(`DELETE FROM channel_sources WHERE channel_id=?`).bind(id));
  for(let i=0;i<sources.length;i++){
    const s=sources[i];
    statements.push(env.DB.prepare(`INSERT INTO channel_sources(channel_id,url,origin,priority,enabled,created_at,updated_at)
      VALUES(?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(channel_id,url) DO UPDATE SET origin=excluded.origin,priority=excluded.priority,enabled=1,updated_at=CURRENT_TIMESTAMP`)
      .bind(id,clean(s.url),clean(s.origin)||'playlist',Number.isFinite(Number(s.priority))?Number(s.priority):100+i));
  }
  await env.DB.batch(statements);
  return{id,name,tvgId,logo,groupName,sources:sources.map(s=>clean(s.url))};
}

function toM3u(channels){
  const lines=['#EXTM3U'];
  for(const c of channels){
    const sources=(c.sources||[]).filter(s=>/^https?:\/\//i.test(s.url));
    if(!sources.length){lines.push(`#EXTINF:-1 tvg-id="${escAttr(c.tvgId||c.id)}" tvg-name="${escAttr(c.name)}" tvg-logo="${escAttr(c.logo)}" group-title="${escAttr(c.groupName||'Other')}",${c.name}`);lines.push('');continue;}
    for(const s of sources){lines.push(`#EXTINF:-1 tvg-id="${escAttr(c.tvgId||c.id)}" tvg-name="${escAttr(c.name)}" tvg-logo="${escAttr(c.logo)}" group-title="${escAttr(c.groupName||'Other')}",${c.name}`);lines.push(s.url);}
  }
  return`${lines.join('\n')}\n`;
}

export default{async fetch(request,env){
  const origin=requestOrigin(request,env);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(!env.DB)return json({error:'D1 binding DB is not configured'},503,origin);
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';
  try{
    if(path==='/'||path==='/api/status'){
      const count=await env.DB.prepare(`SELECT COUNT(*) AS n FROM my_playlist`).first();
      return json({ok:true,service:'WebTV Registry',version:VERSION,d1:true,myPlaylistChannels:Number(count?.n||0),endpoints:['/api/playlists','/api/my-playlist','/playlist.m3u']},200,origin);
    }
    if(path==='/playlist.m3u'&&request.method==='GET')return text(toM3u(await myPlaylist(env)),200,'audio/x-mpegurl;charset=utf-8',origin);

    if(path==='/api/playlists'&&request.method==='GET')return json({playlists:await listPlaylists(env)},200,origin);
    if(path==='/api/playlists'&&request.method==='POST'){
      const auth=requireAdmin(request,env);if(!auth.ok)return auth.response;
      return json({ok:true,playlist:await upsertSavedPlaylist(env,await readJson(request))},200,origin);
    }
    if(path.startsWith('/api/playlists/')&&request.method==='GET'){
      const auth=requireAdmin(request,env);if(!auth.ok)return auth.response;
      const id=decodeURIComponent(path.slice('/api/playlists/'.length));const row=await getPlaylist(env,id);
      return row?json({playlist:row},200,origin):json({error:'Playlist not found'},404,origin);
    }
    if(path.startsWith('/api/playlists/')&&request.method==='DELETE'){
      const auth=requireAdmin(request,env);if(!auth.ok)return auth.response;
      const id=decodeURIComponent(path.slice('/api/playlists/'.length));await env.DB.prepare(`DELETE FROM playlists WHERE id=?`).bind(id).run();return json({ok:true,id},200,origin);
    }

    if(path==='/api/my-playlist'&&request.method==='GET'){
      const channels=await myPlaylist(env);return json({channels,count:channels.length,playlistUrl:`${url.origin}/playlist.m3u`},200,origin);
    }
    if(path==='/api/my-playlist/channel'&&request.method==='PUT'){
      const auth=requireAdmin(request,env);if(!auth.ok)return auth.response;
      return json({ok:true,channel:await putMyChannel(env,await readJson(request))},200,origin);
    }
    if(path.startsWith('/api/my-playlist/channel/')&&request.method==='DELETE'){
      const auth=requireAdmin(request,env);if(!auth.ok)return auth.response;
      const id=decodeURIComponent(path.slice('/api/my-playlist/channel/'.length));await env.DB.prepare(`DELETE FROM my_playlist WHERE channel_id=?`).bind(id).run();return json({ok:true,id},200,origin);
    }
    if(path==='/api/my-playlist/replace'&&request.method==='POST'){
      const auth=requireAdmin(request,env);if(!auth.ok)return auth.response;
      const body=await readJson(request);if(!Array.isArray(body.channels))return json({error:'channels array is required'},400,origin);
      await env.DB.prepare(`DELETE FROM my_playlist`).run();let position=0;for(const channel of body.channels)await putMyChannel(env,{...channel,position:position++,replaceSources:true});return json({ok:true,count:body.channels.length},200,origin);
    }
    return json({error:'Not found'},404,origin);
  }catch(error){return json({error:error?.message||String(error)},500,origin);}
}};
