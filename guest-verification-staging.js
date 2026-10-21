/* Tokens remain in this page's memory and the fixed app callback only. */
(() => {
  'use strict';
  const RETURN = 'dailyknowledge-staging://guest-verification';
  const PAGE = 'https://alsurokjoji-privacy.vercel.app/guest-verification-staging.html';
  const start = document.getElementById('start');
  const cancel = document.getElementById('cancel');
  const status = document.getElementById('status');
  const widget = document.getElementById('turnstile-widget');
  const sitekey = widget.dataset.sitekey;
  let state = null;
  let finished = false;
  let loading = false;
  let generation = 0;
  let widgetId = null;
  let deadline = null;
  let script = null;

  function dispose(closePage = false) {
    generation++;
    if (closePage && deadline !== null) {
      clearTimeout(deadline);
      deadline = null;
    }
    if (widgetId !== null && window.turnstile) {
      try { window.turnstile.remove(widgetId); } catch { /* Already removed. */ }
    }
    widgetId = null;
  }
  function back(key, value) {
    if (!state || finished) return;
    const returnState = state;
    state = null;
    finished = true;
    dispose(true);
    start.disabled = true;
    cancel.disabled = true;
    status.textContent = '앱으로 돌아가고 있어요. 돌아가지 않으면 이 창을 닫아 주세요.';
    const fragment = new URLSearchParams({ state: returnState, [key]: value });
    // A caller-supplied redirect URL is never accepted.
    window.location.replace(`${RETURN}#${fragment.toString()}`);
  }
  function unavailable() {
    if (finished) return;
    loading = false;
    dispose();
    status.textContent = '확인을 완료하지 못했어요. 다시 시도하거나 앱으로 돌아가 주세요.';
    start.textContent = '다시 시도';
    start.disabled = false;
  }
  function render() {
    if (finished || !state || !window.turnstile) return unavailable();
    const captured = ++generation;
    try {
      widgetId = window.turnstile.render(widget, {
        sitekey, theme: 'light', size: 'flexible', language: 'ko',
        'response-field': false, retry: 'never', 'refresh-expired': 'manual',
        callback(token) {
          if (finished || captured !== generation) return;
          if (typeof token !== 'string' || !/^[\x21-\x7e]{1,2048}$/.test(token)) return unavailable();
          back('captcha_token', token);
        },
        'error-callback': () => { if (captured === generation) unavailable(); },
        'expired-callback': () => { if (captured === generation) unavailable(); },
        'timeout-callback': () => { if (captured === generation) unavailable(); },
      });
      loading = false;
      status.textContent = '아래 확인을 마치면 앱으로 돌아가요.';
    } catch { unavailable(); }
  }
  start.addEventListener('click', () => {
    if (!state || finished || loading || start.disabled) return;
    loading = true;
    start.disabled = true;
    status.textContent = '사람 확인을 준비하고 있어요…';
    if (window.turnstile) return render();
    if (script) script.remove();
    const created = document.createElement('script');
    script = created;
    created.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    created.async = true;
    created.referrerPolicy = 'no-referrer';
    created.onload = () => { if (script === created && !finished && loading) render(); };
    created.onerror = () => { if (script === created && !finished && loading) unavailable(); };
    document.head.appendChild(created);
  });
  cancel.addEventListener('click', () => back('error', 'cancelled'));
  window.addEventListener('pagehide', () => { finished = true; state = null; dispose(true); });

  try {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (`${url.origin}${url.pathname}` !== PAGE || url.search || url.username || url.password
      || [...fragment.keys()].length !== 1 || !/^[0-9a-f]{64}$/.test(fragment.get('state') || '')) throw Error();
    state = fragment.get('state');
    // Fragments never reach the host; remove the nonce from local history too.
    window.history.replaceState(null, '', PAGE);
    cancel.disabled = false;
    deadline = setTimeout(() => back('error', 'expired'), 180_000);
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(sitekey) || sitekey.startsWith('REPLACE_')) {
      status.textContent = '연결 확인을 준비 중이에요. 앱으로 돌아가 주세요.';
      return;
    }
    status.textContent = '안내를 확인한 뒤 사람 확인을 시작해 주세요.';
    start.disabled = false;
  } catch {
    status.textContent = '앱의 연결 요청이 없거나 만료됐어요. 이 창을 닫고 앱에서 다시 시도해 주세요.';
  }
})();
