/**
 * Veda live-chat widget for Shreevan Wellness.
 *
 * Embed on the marketing site with a single tag:
 *   <script src="https://crm.shreevanwellness.com/veda-widget.js"
 *           data-api="https://api.shreevanwellness.com/api/v1" defer></script>
 *
 * Self-contained: renders inside a Shadow DOM so it never clashes with the host
 * site's CSS. Talks to the public /chat/message endpoint; Veda replies live.
 */
(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-api]');
  var cfg = window.VEDA_CHAT || {};
  var API = (cfg.apiUrl || (script && script.getAttribute('data-api')) || 'https://api.shreevanwellness.com/api/v1').replace(/\/$/, '');
  var GREETING = cfg.greeting || 'Namaste 🌿 I’m Veda from Shreevan Wellness. How can I help you find your retreat today?';

  // Stable per-visitor session id.
  var KEY = 'veda_chat_session';
  var sessionId = localStorage.getItem(KEY);
  if (!sessionId) {
    sessionId = (crypto && crypto.randomUUID ? crypto.randomUUID() : 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem(KEY, sessionId);
  }

  var FOREST = '#173D32', SAND = '#F7F4EC', INK = '#21302B', GOLD = '#C7A45A';

  // --- Mount point + shadow root -------------------------------------------
  var host = document.createElement('div');
  host.id = 'veda-chat-root';
  host.style.cssText = 'position:fixed;z-index:2147483000;bottom:0;right:0;';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML =
    '<style>' +
    ':host,*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
    '.launch{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:' + FOREST + ';color:#fff;box-shadow:0 8px 24px rgba(23,61,50,.4);display:flex;align-items:center;justify-content:center;transition:transform .15s}' +
    '.launch:hover{transform:scale(1.05)}' +
    '.panel{position:fixed;bottom:96px;right:24px;width:370px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 130px);background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden}' +
    '.panel.open{display:flex}' +
    '.hd{background:' + FOREST + ';padding:16px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0}' +
    '.hd .ttl{font-weight:700;font-size:16px;color:#fff}' +
    '.hd .sub{font-size:11.5px;color:rgba(255,255,255,.6)}' +
    '.hd .dot{width:7px;height:7px;border-radius:50%;background:#7fd6a8;display:inline-block;margin-right:5px}' +
    '.hd .x{margin-left:auto;background:transparent;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:20px;line-height:1}' +
    '.body{flex:1;overflow-y:auto;padding:16px;background:' + SAND + ';display:flex;flex-direction:column;gap:10px}' +
    '.row{display:flex;max-width:85%}' +
    '.row.me{align-self:flex-end;justify-content:flex-end}' +
    '.row.veda{align-self:flex-start}' +
    '.bub{padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}' +
    '.veda .bub{background:#fff;color:' + INK + ';border:1px solid #e7e1d3;border-bottom-left-radius:4px}' +
    '.me .bub{background:' + FOREST + ';color:#fff;border-bottom-right-radius:4px}' +
    '.typing .bub{color:#8a948f;font-style:italic}' +
    '.ft{flex-shrink:0;border-top:1px solid #eee;padding:10px;display:flex;gap:8px;background:#fff}' +
    '.ft input{flex:1;border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:14px;outline:none}' +
    '.ft input:focus{border-color:' + FOREST + '}' +
    '.ft button{border:none;background:' + FOREST + ';color:#fff;border-radius:10px;padding:0 16px;font-size:14px;font-weight:600;cursor:pointer}' +
    '.brand{font-size:10.5px;color:#9aa39d;text-align:center;padding:0 0 8px;background:#fff}' +
    '</style>' +
    '<button class="launch" aria-label="Chat with Veda">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    '</button>' +
    '<div class="panel" role="dialog" aria-label="Veda chat">' +
      '<div class="hd"><div><div class="ttl">Veda</div><div class="sub"><span class="dot"></span>Shreevan Wellness</div></div><button class="x" aria-label="Close">×</button></div>' +
      '<div class="body"></div>' +
      '<div class="brand">Powered by Veda · Shreevan Wellness</div>' +
      '<form class="ft"><input type="text" placeholder="Type your message…" autocomplete="off"/><button type="submit">Send</button></form>' +
    '</div>';

  var launch = root.querySelector('.launch');
  var panel = root.querySelector('.panel');
  var bodyEl = root.querySelector('.body');
  var form = root.querySelector('.ft');
  var input = root.querySelector('.ft input');
  var closeBtn = root.querySelector('.x');
  var greeted = false;

  function addMsg(text, who, extraClass) {
    var row = document.createElement('div');
    row.className = 'row ' + who + (extraClass ? ' ' + extraClass : '');
    var bub = document.createElement('div');
    bub.className = 'bub';
    bub.textContent = text;
    row.appendChild(bub);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return row;
  }

  launch.addEventListener('click', function () { toggle(!panel.classList.contains('open')); });
  closeBtn.addEventListener('click', function () { toggle(false); });

  // Outbound (Veda + human-agent) messages are rendered via polling, keyed by id
  // so nothing shows twice. lastSeen starts at "now" so we don't replay history.
  var seen = {};
  var lastSeen = new Date().toISOString();
  var pollTimer = null;

  function drainNew() {
    return fetch(API + '/chat/messages?sessionId=' + encodeURIComponent(sessionId) + '&since=' + encodeURIComponent(lastSeen))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var msgs = (data && data.messages) || [];
        msgs.forEach(function (m) {
          if (seen[m.id]) return;
          seen[m.id] = true;
          addMsg(m.body, 'veda');
          lastSeen = m.occurredAt;
        });
      })
      .catch(function () {});
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'me');
    var typing = addMsg('Veda is typing…', 'veda', 'typing');

    fetch(API + '/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        typing.remove();
        return drainNew(); // pulls Veda's (or the agent's) reply, deduped by id
      })
      .catch(function () {
        typing.remove();
        addMsg('Sorry, I couldn’t connect just now. Please try again in a moment.', 'veda');
      });
  });

  function toggle(open) {
    panel.classList.toggle('open', open);
    if (open && !greeted) { greeted = true; addMsg(GREETING, 'veda'); }
    if (open) setTimeout(function () { input.focus(); }, 50);
    // Poll for agent/Veda replies only while the panel is open.
    if (open && !pollTimer) pollTimer = setInterval(drainNew, 5000);
    if (!open && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
})();
