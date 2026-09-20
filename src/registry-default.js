const DEFAULT_REGISTRY_URL='https://webtv-registry.atonis.workers.dev';
const KEY='webtv_v2_registry_url';
try{
  if(!localStorage.getItem(KEY)) localStorage.setItem(KEY,DEFAULT_REGISTRY_URL);
}catch{}
