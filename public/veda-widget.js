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
    '.hd .vbtn{margin-left:auto;background:transparent;border:none;color:rgba(255,255,255,.85);cursor:pointer;padding:3px 7px;border-radius:7px;display:flex;align-items:center}' +
    '.hd .vbtn.on{background:rgba(255,255,255,.22);color:#fff}' +
    '.hd .x{margin-left:6px;background:transparent;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:20px;line-height:1}' +
    '.ft .mic{flex:0 0 auto;background:#eef2f0;color:' + FOREST + ';border:1px solid #dfe7e3;border-radius:10px;padding:0 11px;cursor:pointer;display:flex;align-items:center}' +
    '.ft .mic.live{background:#c0392b;color:#fff;border-color:#c0392b;animation:vpulse 1.2s infinite}' +
    '@keyframes vpulse{0%,100%{opacity:1}50%{opacity:.55}}' +
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
      '<div class="hd"><div><div class="ttl">Veda</div><div class="sub"><span class="dot"></span>Shreevan Wellness</div></div>' +
        '<button class="vbtn" aria-label="Toggle voice" title="Voice replies">' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>' +
        '</button>' +
        '<button class="x" aria-label="Close">×</button></div>' +
      '<div class="body"></div>' +
      '<div class="brand">Powered by Veda · Shreevan Wellness</div>' +
      '<form class="ft">' +
        '<button type="button" class="mic" aria-label="Speak">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4"/></svg>' +
        '</button>' +
        '<input type="text" placeholder="Type or tap the mic…" autocomplete="off"/><button type="submit">Send</button></form>' +
    '</div>';

  var launch = root.querySelector('.launch');
  var panel = root.querySelector('.panel');
  var bodyEl = root.querySelector('.body');
  var form = root.querySelector('.ft');
  var input = root.querySelector('.ft input');
  var closeBtn = root.querySelector('.x');
  var vbtn = root.querySelector('.vbtn');
  var micBtn = root.querySelector('.mic');
  var greeted = false;
  var voiceOn = false;
  var LANG = cfg.lang || 'en-IN';

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

  // --- Voice (speech ↔ speech) ---------------------------------------------
  var audioEl = null;

  function browserSpeak(text) {
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = LANG;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* no TTS available */ }
  }

  // Speak via ElevenLabs (through our backend); fall back to the browser voice.
  function speak(text) {
    fetch(API + '/chat/tts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }),
    })
      .then(function (r) { return r.status === 200 ? r.blob() : null; })
      .then(function (blob) {
        if (blob && blob.size > 0) {
          if (audioEl) { try { audioEl.pause(); } catch (e) {} }
          audioEl = new Audio(URL.createObjectURL(blob));
          audioEl.play().catch(function () { browserSpeak(text); });
        } else {
          browserSpeak(text);
        }
      })
      .catch(function () { browserSpeak(text); });
  }

  function setVoice(on) {
    voiceOn = on;
    vbtn.classList.toggle('on', on);
    if (!on && audioEl) { try { audioEl.pause(); } catch (e) {} }
    if (!on) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }
  vbtn.addEventListener('click', function () { setVoice(!voiceOn); });

  // Speech-to-text via the browser. Talking turns voice replies on (speech↔speech).
  function getRecognition() {
    var w = window;
    var Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
  }
  var recognizing = false;
  micBtn.addEventListener('click', function () {
    var rec = getRecognition();
    if (!rec) { input.placeholder = 'Voice input not supported here — please type.'; return; }
    if (recognizing) { try { rec.stop(); } catch (e) {} return; }
    rec.lang = LANG;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = function () { recognizing = true; micBtn.classList.add('live'); };
    rec.onerror = function () { recognizing = false; micBtn.classList.remove('live'); };
    rec.onend = function () { recognizing = false; micBtn.classList.remove('live'); };
    rec.onresult = function (e) {
      var t = e.results[0][0].transcript;
      setVoice(true);          // you spoke → Veda speaks back
      sendText(t);
    };
    try { rec.start(); } catch (e) {}
  });

  // --- Messaging ------------------------------------------------------------
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
          if (voiceOn) speak(m.body);
        });
      })
      .catch(function () {});
  }

  function sendText(text) {
    text = (text || '').trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'me');
    var typing = addMsg('Veda is typing…', 'veda', 'typing');
    fetch(API + '/chat/message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, message: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function () { typing.remove(); return drainNew(); })
      .catch(function () {
        typing.remove();
        addMsg('Sorry, I couldn’t connect just now. Please try again in a moment.', 'veda');
      });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); sendText(input.value); });

  function toggle(open) {
    panel.classList.toggle('open', open);
    if (open && !greeted) { greeted = true; addMsg(GREETING, 'veda'); }
    if (open) setTimeout(function () { input.focus(); }, 50);
    if (open && !pollTimer) pollTimer = setInterval(drainNew, 5000);
    if (!open && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
})();
