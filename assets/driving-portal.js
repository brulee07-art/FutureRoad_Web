(() => {
  'use strict';
  const appOrigin = 'https://futureroad-track-scoring-2026.brulee07.chatgpt.site';
  const frame = document.querySelector('#scoring-frame');
  const links = [...document.querySelectorAll('[data-view]')];
  const loading = document.querySelector('.portal-loading');
  const message = document.querySelector('.portal-status');
  let mode = new URLSearchParams(location.search).get('mode') === 'practice' ? 'practice' : 'official';
  let view = document.body.dataset.view;
  const pagePath = next => next === 'display' ? '/driving-display.html' : '/driving.html';
  const updateNavigation = () => {
    const query = mode === 'practice' ? '?mode=practice' : '';
    for (const link of links) {
      link.href = pagePath(link.dataset.view) + query;
      if (link.dataset.view === (view === 'display' ? 'display' : 'judge')) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.title = (view === 'display' ? '실시간 순위 · 전광판' : '주행 채점 · 심사위원') + ' | 퓨처로드';
    history.replaceState(null, '', pagePath(view) + query);
  };
  window.addEventListener('message', event => {
    if (event.origin !== appOrigin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'futureroad:state' || !['judge','rankings','display'].includes(data.view) || !['official','practice'].includes(data.mode)) return;
    mode = data.mode;
    view = data.view;
    updateNavigation();
  });
  frame.addEventListener('load', () => { loading.hidden = true; });
  // The production iframe is preloaded from HTML; change it only for practice mode.
  if (mode === 'practice') {
    const url = new URL(frame.src);
    url.searchParams.set('mode', 'practice');
    frame.src = url.toString();
  }
  updateNavigation();
  document.querySelector('.portal-fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else throw new Error('unsupported');
    } catch {
      message.textContent = '이 브라우저에서는 전체화면 버튼을 사용할 수 없습니다. PC에서는 F11을 눌러 주세요.';
      message.hidden = false;
      window.setTimeout(() => { message.hidden = true; }, 7000);
    }
  });
})();
