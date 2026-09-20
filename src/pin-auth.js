const BUILD_ID='20260920-1845';
const DEFAULT_REGISTRY='https://webtv-registry.atonis.workers.dev';
const URL_KEY='webtv_v2_registry_url';
const TOKEN_KEY='webtv_v2_registry_token';
const $=id=>document.getElementById(id);

if(!(localStorage.getItem(URL_KEY)||'').trim())localStorage.setItem(URL_KEY,DEFAULT_REGISTRY);

function base(){return(localStorage.getItem(URL_KEY)||DEFAULT_REGISTRY).trim().replace(/\/$/,'');}
function session(){return localStorage.getItem(TOKEN_KEY)||'';}
function setState(text,online='0'){const el=$('registry-state');if(el){el.textContent=text;el.dataset.online=online;}}
function setStatus(text,tone='idle'){const el=$('playlist-manager-status');if(el){el.textContent=text;el.dataset.tone=tone;}}
async function request(path,options={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);try{return await fetch(`${base()}${path}`,{cache:'no-store',signal:c.signal,...options});}finally{clearTimeout(t);}}
async function validateSession(){
  const token=session();if(!token){setState('PIN locked');return false;}
  try{const r=await request('/api/session',{headers:{authorization:`Bearer ${token}`}});if(r.ok){setState('Unlocked ✓','1');return true;}}
  catch{}
  localStorage.removeItem(TOKEN_KEY);setState('PIN locked');return false;
}
async function login(pin){
  if(!/^\d{6}$/.test(pin))throw new Error('Το PIN πρέπει να έχει ακριβώς 6 αριθμούς');
  const r=await request('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});let j={};try{j=await r.json();}catch{}
  if(!r.ok)throw new Error(j.error||`Login HTTP ${r.status}`);
  if(!j.token)throw new Error('Ο Worker δεν επέστρεψε session');
  localStorage.setItem(TOKEN_KEY,j.token);return j;
}

function enhance(){
  const input=$('registry-token'),save=$('registry-save');if(!input||!save||input.dataset.pinEnhanced==='1')return false;
  input.dataset.pinEnhanced='1';input.type='password';input.placeholder='6-digit PIN';input.maxLength=6;input.inputMode='numeric';input.autocomplete='one-time-code';input.pattern='[0-9]{6}';
  const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  if(descriptor?.get&&descriptor?.set){Object.defineProperty(input,'value',{configurable:true,get(){return descriptor.get.call(this);},set(v){const s=String(v??'');descriptor.set.call(this,s.length>12?'':s.replace(/\D/g,'').slice(0,6));}});}
  input.value='';
  save.textContent='Unlock PIN';
  save.addEventListener('click',async event=>{
    event.preventDefault();event.stopImmediatePropagation();
    const url=$('registry-url')?.value.trim()||DEFAULT_REGISTRY;localStorage.setItem(URL_KEY,url.replace(/\/$/,''));
    const pin=input.value.replace(/\D/g,'');
    if(!pin&&await validateSession()){setStatus('Registry already unlocked','ok');return;}
    try{setState('Unlocking…');setStatus('Checking PIN…','busy');const j=await login(pin);input.value='';setState(`Unlocked ✓ · ${j.days||30}d session`,'1');setStatus('PIN accepted · D1 unlocked','ok');setTimeout(()=>$('registry-sync-down')?.click(),80);}
    catch(error){input.value='';setState('PIN locked');setStatus(error.message,'error');}
  },true);
  input.addEventListener('input',()=>{const clean=input.value.replace(/\D/g,'').slice(0,6);if(input.value!==clean)input.value=clean;});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save.click();}});
  const actions=save.parentElement;
  if(actions&&!$('registry-lock')){const lock=document.createElement('button');lock.id='registry-lock';lock.type='button';lock.className='button ghost';lock.textContent='Lock';lock.addEventListener('click',()=>{localStorage.removeItem(TOKEN_KEY);input.value='';setState('PIN locked');setStatus('D1 write access locked','idle');});actions.insertBefore(lock,save.nextSibling);}
  validateSession();
  return true;
}

if(!enhance()){
  const observer=new MutationObserver(()=>{if(enhance())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});
}
console.log(`WebTV PIN auth loaded · build ${BUILD_ID}`);
