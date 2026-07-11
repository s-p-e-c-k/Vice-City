(() => {
  'use strict';

  const REPO_BASE = 'https://cdn.jsdelivr.net/gh/StaticQuasar931/Vice-City@main/';
  const CACHE_NAME = 'vice-city-staticquasar931-v5';
  const DB_NAME = CACHE_NAME;
  const STORE_NAME = 'files';
  const MANIFEST = [
    ['index.data', [20866662,20866662,20866662,20866662,20866662,20866662,10155139]],
    ['audio/emotion.adf', [20866662,20866662,15015921]],
    ['audio/espant.adf', [20866662,20866662,17438412]],
    ['audio/fever.adf', [20866662,20866662,18957694]],
    ['audio/flash.adf', [20866662,20866662,15672117]],
    ['audio/kchat.adf', [20866662,20866662,8152021]],
    ['audio/vcpr.adf', [20866662,20607355]],
    ['audio/vrock.adf', [20866662,20866662,20866662,11707724]],
    ['audio/wave.adf', [20866662,20866662,20866662,868370]],
    ['audio/wild.adf', [20866662,20866662,20866662,3115319]]
  ];
  const SCRIPT_ORDER = ['GamepadEmulator.js', 'idbfs.js', 'game.js'];
  const WASM_SIZE = 7625729;
  const totalBytes = WASM_SIZE + MANIFEST.reduce((sum, [, sizes]) => sum + sizes.reduce((a,b) => a+b, 0), 0);
  const blobUrls = new Map();
  let completedBytes = 0;
  let currentError = '';

  const ui = {
    loader: document.querySelector('#loader'), fill: document.querySelector('#progressFill'), percent: document.querySelector('#progressPercent'),
    bytes: document.querySelector('#progressBytes'), stage: document.querySelector('#loadingStage'), asset: document.querySelector('#loadingAsset'),
    panel: document.querySelector('#errorPanel'), message: document.querySelector('#errorMessage'), play: document.querySelector('#playNowButton')
  };

  function formatMB(bytes) { return `${(bytes / 1048576).toFixed(1)} MB`; }
  function updateProgress(extra = 0) {
    const loaded = Math.min(completedBytes + extra, totalBytes);
    const pct = Math.min(100, Math.round(loaded / totalBytes * 100));
    ui.fill.style.width = `${pct}%`; ui.percent.textContent = `${pct}%`; ui.bytes.textContent = `${formatMB(loaded)} / ${formatMB(totalBytes)}`;
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  async function dbRequest(mode, action) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode); const request = action(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => { const value=request?.result; db.close(); resolve(value); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Browser storage transaction was aborted.')); };
    });
  }
  const readCache = key => dbRequest('readonly', store => store.get(key));
  const writeCache = record => dbRequest('readwrite', store => store.put(record));

  function validateBytes(bytes, expected, url) {
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength !== expected) throw new Error(`Invalid size for ${url}. Expected ${expected} bytes, received ${bytes?.byteLength ?? 0}.`);
    const head = new TextDecoder().decode(new Uint8Array(bytes, 0, Math.min(128, bytes.byteLength))).toLowerCase();
    if (head.includes('<!doctype') || head.includes('<html') || head.includes('failed to fetch') || head.includes('couldn\'t find the requested file')) throw new Error(`The CDN returned an error page instead of ${url}.`);
  }
  async function fetchPart(path, expected) {
    const url = new URL(path, REPO_BASE).href; const cached = await readCache(path).catch(() => null);
    if (cached && cached.version === CACHE_NAME && cached.url === url && cached.size === expected && cached.data?.byteLength === expected) { completedBytes += expected; updateProgress(); ui.stage.textContent = 'Using verified cache'; return cached.data; }
    ui.stage.textContent = 'Downloading from StaticQuasar931/Vice-City'; let received = 0;
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (type.includes('text/html')) throw new Error(`HTML was returned instead of a game file: ${url}`);
    const reader = response.body?.getReader(); let data;
    if (reader) { const chunks=[]; while (true) { const {done,value}=await reader.read(); if(done) break; chunks.push(value); received += value.byteLength; updateProgress(received); } data=new Uint8Array(received); let offset=0; for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;} data=data.buffer; }
    else data = await response.arrayBuffer();
    validateBytes(data, expected, url); await writeCache({ key:path, url, version:CACHE_NAME, size:expected, timestamp:Date.now(), data }); completedBytes += expected; updateProgress(); return data;
  }
  async function mergeAsset(basePath, sizes) {
    const buffers=[]; for(let i=0;i<sizes.length;i++){ const part=`${basePath}.part${i+1}`; ui.asset.textContent=`${basePath} • part ${i+1} of ${sizes.length}`; buffers.push(await fetchPart(part,sizes[i])); }
    ui.stage.textContent = `Merging ${basePath}`; const url=URL.createObjectURL(new Blob(buffers)); blobUrls.set(basePath.toLowerCase(),url);
  }
  function knownAssetPath(input) {
    const raw = input instanceof Request ? input.url : input instanceof URL ? input.href : String(input); if (raw.startsWith('blob:')) return null;
    let pathname; try { pathname = new URL(raw, location.href).pathname; } catch { return null; }
    pathname = decodeURIComponent(pathname).replace(/^\/+/, '').toLowerCase();
    for (const key of blobUrls.keys()) if (pathname === key || pathname.endsWith(`/${key}`)) return key; return null;
  }
  function installRemapping() {
    const nativeFetch=window.fetch.bind(window); window.fetch=(input,init)=>{ const key=knownAssetPath(input); if(!key) return nativeFetch(input,init); const mapped=blobUrls.get(key); if(input instanceof Request) return nativeFetch(new Request(mapped,input),init); return nativeFetch(mapped,init); };
    const nativeOpen=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(method,url,...rest){const key=knownAssetPath(url);return nativeOpen.call(this,method,key?blobUrls.get(key):url,...rest);};
  }
  async function loadScript(path) {
    ui.asset.textContent=path;
    const sourceUrl=new URL(path,REPO_BASE).href;
    const coreCache=await caches.open(`${CACHE_NAME}-core`);
    let response=await coreCache.match(sourceUrl);
    if(!response){response=await fetch(sourceUrl,{cache:'no-cache'});if(response.ok)await coreCache.put(sourceUrl,response.clone());}
    if(!response.ok) throw new Error(`HTTP ${response.status} while loading ${sourceUrl}`);
    const source=await response.text();
    const sample=source.slice(0,300).toLowerCase();
    if(source.length<500||sample.includes('<!doctype')||sample.includes('<html')||sample.includes("couldn't find the requested file")) throw new Error(`Invalid JavaScript returned for ${sourceUrl}`);
    const objectUrl=URL.createObjectURL(new Blob([`${source}\n//# sourceURL=${sourceUrl}`],{type:'text/javascript'}));
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=objectUrl;script.onload=resolve;script.onerror=()=>reject(new Error(`Failed to execute ${sourceUrl}`));document.body.appendChild(script);});
    URL.revokeObjectURL(objectUrl);
  }
  window.__loadVerifiedViceCityScript=loadScript;
  async function clearCache() { for(const url of blobUrls.values()) URL.revokeObjectURL(url); blobUrls.clear(); await caches.delete(`${CACHE_NAME}-core`); await new Promise(resolve=>{const req=indexedDB.deleteDatabase(DB_NAME);req.onsuccess=req.onerror=req.onblocked=resolve;}); }
  function showError(error) { currentError=`${error?.stack || error}`; console.error('[Vice City loader]',error); ui.panel.hidden=false; ui.message.textContent=error?.message||String(error); ui.stage.textContent='Load failed'; }
  function verifyWebGL() {
    const probe=document.createElement('canvas');
    const gl=probe.getContext('webgl2',{alpha:false,depth:true,stencil:true,antialias:true})||probe.getContext('webgl',{alpha:false,depth:true,stencil:true,antialias:true});
    if(!gl) throw new Error('WebGL is unavailable. Enable hardware acceleration or try Firefox, then reload.');
    const extension=gl.getExtension('WEBGL_lose_context'); if(extension) extension.loseContext();
  }
  async function start() { try { ui.panel.hidden=true; completedBytes=0; updateProgress(); verifyWebGL(); for(const [path,sizes] of MANIFEST) await mergeAsset(path,sizes); ui.asset.textContent='index.wasm'; const wasm=await fetchPart('index.wasm',WASM_SIZE); blobUrls.set('index.wasm',URL.createObjectURL(new Blob([wasm],{type:'application/wasm'}))); installRemapping(); ui.stage.textContent='Initializing game engine'; for(const script of SCRIPT_ORDER) await loadScript(script); ui.stage.textContent='Ready for your arrival'; ui.asset.textContent='Click Enter Vice City to create the graphics and audio context.'; ui.play.hidden=false; } catch(error){showError(error);} }

  document.querySelector('#retryButton').onclick=()=>location.reload();
  document.querySelector('#clearCacheButton').onclick=async()=>{await clearCache();location.reload();};
  document.querySelector('#copyErrorButton').onclick=()=>navigator.clipboard.writeText(currentError).catch(()=>{});
  ui.play.onclick=()=>{ui.play.disabled=true;ui.play.textContent='Entering Vice City…';requestAnimationFrame(()=>{ui.loader.classList.add('loader-complete');setTimeout(()=>ui.loader.remove(),520);});};
  document.querySelector('#closeStaticMenu').onclick=()=>document.querySelector('#staticMenu').classList.add('menu-hidden');
  const rotator=[
    ['https://sites.google.com/view/staticquasar931/google-form',new URL('assets/launcher/google-form.png',REPO_BASE).href,'Google Form'],
    ['https://discord.gg/DP2hM7RRhR',new URL('assets/launcher/discord.png',REPO_BASE).href,'Discord'],
    ['https://www.instagram.com/freeschoolgamepage/',new URL('assets/launcher/instagram.png',REPO_BASE).href,'Instagram']
  ]; let rotateIndex=0; const rotate=()=>{const [href,src,alt]=rotator[rotateIndex++%rotator.length];document.querySelector('#staticSlideLink').href=href;const img=document.querySelector('#staticSlideImg');img.src=src;img.alt=alt;}; rotate(); setInterval(rotate,8000);
  document.querySelectorAll('.activity-tabs button').forEach(button=>button.onclick=()=>{document.querySelectorAll('.activity-tabs button,.activity-panel').forEach(node=>node.classList.remove('active'));button.classList.add('active');document.querySelector(`#${button.dataset.panel}`).classList.add('active');});
  const questions=[
    {q:'Which decade inspires Vice City?',a:['The 1980s','The 1960s','The 2000s'],c:0,f:'Neon, pastel suits, and 1980s excess.'},
    {q:'What is the playable protagonist called?',a:['Tommy Vercetti','Claude Speed','Carl Johnson'],c:0,f:'Tommy arrives in Vice City after fifteen years in prison.'},
    {q:'Which real city inspired Vice City?',a:['Miami','Las Vegas','New Orleans'],c:0,f:'Vice City borrows its beaches, palms, and neon from Miami.'},
    {q:'Which station plays new wave music?',a:['Wave 103','K-Chat','VCPR'],c:0,f:'Wave 103 is the city’s new wave station.'},
    {q:'What color is central to the classic Vice City logo?',a:['Pink','Green','Orange'],c:0,f:'Its pink script became one of the game’s signatures.'}
  ]; let questionIndex=0,score=0;
  function showQuestion(){const item=questions[questionIndex%questions.length];document.querySelector('#triviaQuestion').textContent=item.q;document.querySelector('#triviaResult').textContent='';const box=document.querySelector('#triviaAnswers');box.innerHTML='';item.a.forEach((answer,index)=>{const button=document.createElement('button');button.textContent=answer;button.onclick=()=>{[...box.children].forEach(child=>child.disabled=true);const correct=index===item.c;button.classList.add(correct?'correct':'wrong');box.children[item.c].classList.add('correct');if(correct){score++;document.querySelector('#triviaScore').textContent=score;}document.querySelector('#triviaResult').textContent=(correct?'Correct. ':'Not quite. ')+item.f;setTimeout(()=>{questionIndex++;showQuestion();},2600);};box.appendChild(button);});} showQuestion();
  const slides=[...document.querySelectorAll('.load-slide')],rails=[...document.querySelectorAll('.slide-rail i')];let slideIndex=0;setInterval(()=>{slides[slideIndex].classList.remove('active');rails[slideIndex].classList.remove('active');slideIndex=(slideIndex+1)%slides.length;slides[slideIndex].classList.add('active');rails[slideIndex].classList.add('active');},7200);
  let sequence=''; addEventListener('keydown',event=>{sequence=(sequence+event.key.toLowerCase()).slice(-3);if(sequence==='yui'){document.querySelector('#staticMenu').classList.toggle('menu-hidden');document.querySelector('#staticSlideMenu').classList.toggle('menu-hidden');sequence='';}});
  addEventListener('beforeunload',()=>{for(const url of blobUrls.values()) URL.revokeObjectURL(url);});
  start();
})();
