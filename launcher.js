(() => {
  'use strict';
  const CDN = 'https://cdn.jsdelivr.net/gh/StaticQuasar931/Vice-City@main/';
  const button = document.querySelector('#launchButton');
  const status = document.querySelector('#launchStatus');
  const slides = [...document.querySelectorAll('.backdrop-slide')];
  let slide = 0;
  setInterval(() => { slides[slide].classList.remove('active'); slide=(slide+1)%slides.length; slides[slide].classList.add('active'); }, 7000);

  async function launch() {
    const gameWindow = window.open('about:blank', '_blank');
    if (!gameWindow) { status.textContent='Pop-ups are blocked. Allow pop-ups for this page, then try again.'; return; }
    gameWindow.document.open();
    gameWindow.document.write('<!doctype html><title>Opening Vice City…</title><style>body{margin:0;display:grid;place-items:center;height:100vh;background:#090316;color:#fff;font:700 18px system-ui}b{color:#4fe6ff}</style><b>Opening Vice City…</b>');
    gameWindow.document.close();
    button.disabled=true; status.textContent='Building the clean game tab…';
    try {
      const response=await fetch(new URL('game.html',CDN),{cache:'no-store'});
      if(!response.ok) throw new Error(`Game page returned HTTP ${response.status}`);
      const html=await response.text();
      if(!html.toLowerCase().includes('<!doctype html')) throw new Error('The CDN returned an invalid game page.');
      gameWindow.document.open(); gameWindow.document.write(html); gameWindow.document.close(); gameWindow.focus();
      status.textContent='Vice City opened in a new tab.';
    } catch(error) {
      gameWindow.document.body.innerHTML=`<main style="max-width:620px;margin:15vh auto;padding:24px;color:white;font:16px system-ui"><h1>Vice City could not open</h1><p>${String(error.message).replace(/[<>&]/g,'')}</p><p>Refresh the launcher after the latest repository update reaches jsDelivr.</p></main>`;
      status.textContent=`Could not launch: ${error.message}`;
    } finally { button.disabled=false; }
  }
  button.addEventListener('click',launch);
  if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Optional cache worker was not registered:',error));
})();
