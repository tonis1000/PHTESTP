const VERSION = '1.3';
const SESSION_DAYS = 30;
const MAX_PIN_FAILURES = 5;
const PIN_BLOCK_MINUTES = 15;

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
async function readJson(request){try{return await request.json();}catch{throw new Error('Invalid JSON body');}}

function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64urlText(textValue){return b64url(new TextEncoder().encode(textValue));}
function fromB64url(value){const s=value.replace(/-/g,'+').replace(/_/g,'/');const pad=s+'='.repeat((4-s.length%4)%4);return Uint8Array.from(atob(pad),c=>c.charCodeAt(0));}
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)));}
function safeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0;}
async function createSession(env){const now=Math.floor(Date.now()/1000);const payload=b64urlText(JSON.stringify({v:1,iat:now,exp:now+SESSION_DAYS*86400}));const sig=b64url(await hmac(env.ADMIN_TOKEN,payload));return `${payload}.${sig}`;}
async function verifySession(token,env){
  if(!token||!env.ADMIN_TOKEN)return false;
  if(token===env.ADMIN_TOKEN)return true; // legacy emergency access; never exposed by the UI
  const parts=token.split('.');if(parts.length!==2)return false;
  try{
    const expected=await hmac(env.ADMIN_TOKEN,parts[0]);const supplied=fromB64url(parts[1]);if(!safeEqual(expected,supplied))return false;
    const payload=JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));return payload?.v===1&&Number(payload.exp)>Math.floor(Date.now()/1000);
  }catch{return false;}
}
async function requireAdmin(request,env){
  const origin=requestOrigin(request,env);
  if(!env.ADMIN_TOKEN)return{ok:false,response:json({error:'ADMIN_TOKEN signing secret is not configured'},503,origin)};
  const auth=request.headers.get('authorization')||'';const token=auth.replace(/^Bearer\s+/i,'').trim();
  if(!await verifySession(token,env))return{ok:false,response:json({error:'Locked. Enter the 6-digit PIN.'},401,origin)};
  return{ok:true};
}

async function ensurePinTable(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS pin_attempts (client_key TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, blocked_until INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
}
async function clientKey(request,env){const ip=request.headers.get('cf-connecting-ip')||'unknown';const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${env.ADMIN_TOKEN||'registry'}:${ip}`));return b64url(new Uint8Array(digest)).slice(0,32);}
async function pinLogin(request,env,origin){
  if(!env.ADMIN_PIN||!/^\d{6}$/.test(env.ADMIN_PIN))return json({error:'ADMIN_PIN must be configured as a 6-digit Cloudflare secret'},503,origin);
  if(!env.ADMIN_TOKEN)return json({error:'ADMIN_TOKEN signing secret is not configured'},503,origin);
  await ensurePinTable(env);
  const key=await clientKey(request,env),now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare(`SELECT failures,blocked_until AS blockedUntil FROM pin_attempts WHERE client_key=?`).bind(key).first();
  if(Number(row?.blockedUntil||0)>now){return json({error:'Too many wrong PIN attempts. Try again later.',retryAfter:Number(row.blockedUntil)-now},429,origin);}
  const body=await readJson(request),pin=clean(body.pin);
  const supplied=new TextEncoder().encode(pin),expected=new TextEncoder().encode(env.ADMIN_PIN);
  const good=/^\d{6}$/.test(pin)&&safeEqual(supplied,expected);
  if(!good){
    const failures=Number(row?.failures||0)+1,blockedUntil=failures>=MAX_PIN_FAILURES?now+PIN_BLOCK_MINUTES*60:0;
    await env.DB.prepare(`INSERT INTO pin_attempts(client_key,failures,blocked_until,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(client_key) DO UPDATE SET failures=excluded.failures,blocked_until=excluded.blocked_until,updated_at=CURRENT_TIMESTAMP`).bind(key,blockedUntil?0:failures,blockedUntil).run();
    return json({error:blockedUntil?'Too many wrong PIN attempts. Locked for 15 minutes.':'Wrong PIN',remaining:blockedUntil?0:Math.max(0,MAX_PIN_FAILURES-failures)},401,origin);
  }
  await env.DB.prepare(`DELETE FROM pin_attempts WHERE client_key=?`).bind(key).run();
  return json({ok:true,token:await createSession(env),expiresIn:SESSION_DAYS*86400,days:SESSION_DAYS},200,origin);
}

async function listPlaylists(env){const r=await env.DB.prepare(`SELECT id,name,kind,source_url AS sourceUrl,channel_count AS channelCount,group_count AS groupCount,created_at AS createdAt,updated_at AS updatedAt FROM playlists ORDER BY updated_at DESC`).all();return r.results||[];}
async function getPlaylist(env,id){return await env.DB.prepare(`SELECT id,name,kind,source_url AS sourceUrl,raw_m3u AS rawM3u,channel_count AS channelCount,group_count AS groupCount,created_at AS createdAt,updated_at AS updatedAt FROM playlists WHERE id=?`).bind(id).first();}
async function upsertSavedPlaylist(env,payload){const id=clean(payload.id)||`pl-${crypto.randomUUID()}`,name=clean(payload.name)||'Saved Playlist',kind=clean(payload.kind)||'saved',sourceUrl=clean(payload.sourceUrl||payload.url),rawM3u=String(payload.rawM3u||payload.text||'');if(!rawM3u.includes('#EXTINF'))throw new Error('rawM3u must contain #EXTINF entries');const channelCount=Math.max(0,Number(payload.channelCount)||0),groupCount=Math.max(0,Number(payload.groupCount)||0);await env.DB.prepare(`INSERT INTO playlists(id,name,kind,source_url,raw_m3u,channel_count,group_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,source_url=excluded.source_url,raw_m3u=excluded.raw_m3u,channel_count=excluded.channel_count,group_count=excluded.group_count,updated_at=CURRENT_TIMESTAMP`).bind(id,name,kind,sourceUrl,rawM3u,channelCount,groupCount).run();return{id,name,kind,sourceUrl,channelCount,groupCount};}

async function myPlaylist(env){const channelsResult=await env.DB.prepare(`SELECT c.id,c.name,c.tvg_id AS tvgId,c.logo,c.group_name AS groupName,c.enabled,m.position,m.added_at AS addedAt FROM my_playlist m JOIN channels c ON c.id=m.channel_id WHERE c.enabled=1 ORDER BY m.position ASC,c.name COLLATE NOCASE ASC`).all();const channels=channelsResult.results||[];if(!channels.length)return[];const ids=channels.map(c=>c.id),placeholders=ids.map(()=>'?').join(',');const sourcesResult=await env.DB.prepare(`SELECT id,channel_id AS channelId,url,origin,priority,enabled,last_success AS lastSuccess,last_failure AS lastFailure,startup_ms AS startupMs,updated_at AS updatedAt FROM channel_sources WHERE enabled=1 AND channel_id IN (${placeholders}) ORDER BY channel_id,priority ASC,id ASC`).bind(...ids).all();const by=new Map();for(const s of sourcesResult.results||[]){if(!by.has(s.channelId))by.set(s.channelId,[]);by.get(s.channelId).push(s);}return channels.map(c=>({...c,sources:by.get(c.id)||[]}));}
async function putMyChannel(env,payload){const name=clean(payload.name);if(!name)throw new Error('Channel name is required');const id=safeId(payload.id||payload.tvgId||name),tvgId=clean(payload.tvgId||payload.originalId||payload.id||name),logo=clean(payload.logo),groupName=clean(payload.groupName||payload.group)||'Other';let sources=Array.isArray(payload.sources)?payload.sources:[];if(!sources.length&&Array.isArray(payload.directUrls))sources=payload.directUrls.map(url=>({url,origin:'playlist'}));sources=sources.map((s,i)=>typeof s==='string'?{url:s,origin:'playlist',priority:100+i}:s).filter(s=>/^https?:\/\//i.test(clean(s?.url)));const position=Number.isFinite(Number(payload.position))?Number(payload.position):999999;const statements=[env.DB.prepare(`INSERT INTO channels(id,name,tvg_id,logo,group_name,enabled,created_at,updated_at) VALUES(?,?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,tvg_id=excluded.tvg_id,logo=excluded.logo,group_name=excluded.group_name,enabled=1,updated_at=CURRENT_TIMESTAMP`).bind(id,name,tvgId,logo,groupName),env.DB.prepare(`INSERT INTO my_playlist(channel_id,position,added_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(channel_id) DO UPDATE SET position=excluded.position`).bind(id,position)];if(payload.replaceSources)statements.push(env.DB.prepare(`DELETE FROM channel_sources WHERE channel_id=?`).bind(id));for(let i=0;i<sources.length;i++){const s=sources[i];statements.push(env.DB.prepare(`INSERT INTO channel_sources(channel_id,url,origin,priority,enabled,created_at,updated_at) VALUES(?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(channel_id,url) DO UPDATE SET origin=excluded.origin,priority=excluded.priority,enabled=1,updated_at=CURRENT_TIMESTAMP`).bind(id,clean(s.url),clean(s.origin)||'playlist',Number.isFinite(Number(s.priority))?Number(s.priority):100+i));}await env.DB.batch(statements);return{id,name,tvgId,logo,groupName,sources:sources.map(s=>clean(s.url))};}
function toM3u(channels){const lines=['#EXTM3U'];for(const c of channels){const sources=(c.sources||[]).filter(s=>/^https?:\/\//i.test(s.url));if(!sources.length){lines.push(`#EXTINF:-1 tvg-id="${escAttr(c.tvgId||c.id)}" tvg-name="${escAttr(c.name)}" tvg-logo="${escAttr(c.logo)}" group-title="${escAttr(c.groupName||'Other')}",${c.name}`);lines.push('');continue;}for(const s of sources){lines.push(`#EXTINF:-1 tvg-id="${escAttr(c.tvgId||c.id)}" tvg-name="${escAttr(c.name)}" tvg-logo="${escAttr(c.logo)}" group-title="${escAttr(c.groupName||'Other')}",${c.name}`);lines.push(s.url);}}return`${lines.join('\n')}\n`;}

export default{async fetch(request,env){
  const origin=requestOrigin(request,env);if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});if(!env.DB)return json({error:'D1 binding DB is not configured'},503,origin);const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';
  try{
    if(path==='/'||path==='/api/status'){const count=await env.DB.prepare(`SELECT COUNT(*) AS n FROM my_playlist`).first();return json({ok:true,service:'WebTV Registry',version:VERSION,d1:true,pinAuth:Boolean(env.ADMIN_PIN),sessionDays:SESSION_DAYS,myPlaylistChannels:Number(count?.n||0),endpoints:['/api/login','/api/session','/api/playlists','/api/my-playlist','/playlist.m3u']},200,origin);}
    if(path==='/api/login'&&request.method==='POST')return await pinLogin(request,env,origin);
    if(path==='/api/session'&&request.method==='GET'){const auth=request.headers.get('authorization')||'',token=auth.replace(/^Bearer\s+/i,'').trim();return json({ok:await verifySession(token,env)},await verifySession(token,env)?200:401,origin);}
    if(path==='/playlist.m3u'&&request.method==='GET')return text(toM3u(await myPlaylist(env)),200,'audio/x-mpegurl;charset=utf-8',origin);
    if(path==='/api/playlists'&&request.method==='GET')return json({playlists:await listPlaylists(env)},200,origin);
    if(path==='/api/playlists'&&request.method==='POST'){const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;return json({ok:true,playlist:await upsertSavedPlaylist(env,await readJson(request))},200,origin);}
    if(path.startsWith('/api/playlists/')&&request.method==='GET'){const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;const id=decodeURIComponent(path.slice('/api/playlists/'.length)),row=await getPlaylist(env,id);return row?json({playlist:row},200,origin):json({error:'Playlist not found'},404,origin);}
    if(path.startsWith('/api/playlists/')&&request.method==='DELETE'){const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;const id=decodeURIComponent(path.slice('/api/playlists/'.length));await env.DB.prepare(`DELETE FROM playlists WHERE id=?`).bind(id).run();return json({ok:true,id},200,origin);}
    if(path==='/api/my-playlist'&&request.method==='GET'){const channels=await myPlaylist(env);return json({channels,count:channels.length,playlistUrl:`${url.origin}/playlist.m3u`},200,origin);}
    if(path==='/api/my-playlist/channel'&&request.method==='PUT'){const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;return json({ok:true,channel:await putMyChannel(env,await readJson(request))},200,origin);}
    if(path.startsWith('/api/my-playlist/channel/')&&request.method==='DELETE'){const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;const id=decodeURIComponent(path.slice('/api/my-playlist/channel/'.length));await env.DB.prepare(`DELETE FROM my_playlist WHERE channel_id=?`).bind(id).run();return json({ok:true,id},200,origin);}
    if(path==='/api/my-playlist/replace'&&request.method==='POST'){const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;const body=await readJson(request);if(!Array.isArray(body.channels))return json({error:'channels array is required'},400,origin);await env.DB.prepare(`DELETE FROM my_playlist`).run();let position=0;for(const channel of body.channels)await putMyChannel(env,{...channel,position:position++,replaceSources:true});return json({ok:true,count:body.channels.length},200,origin);}
    return json({error:'Not found'},404,origin);
  }catch(error){return json({error:error?.message||String(error)},500,origin);}
}};
