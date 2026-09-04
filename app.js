// app.js (front)
document.addEventListener('DOMContentLoaded', () => {
  // helpers
  function q(id){ return document.getElementById(id); }
  function getDeviceId(){
    let id = localStorage.getItem('aguacate-id');
    if (!id){ id = Math.random().toString(36).substring(2,6).toUpperCase(); localStorage.setItem('aguacate-id', id); }
    return id;
  }

  // restart thinking animation reliably
  function restartThinkingAnimation(){
    const el = q('aguacate');
    if (!el) return;
    el.classList.remove('thinking');
    // force reflow
    void el.offsetWidth;
    el.classList.add('thinking');
  }
  window.restartThinkingAnimation = restartThinkingAnimation;

  function thinkingAvocado(){ restartThinkingAnimation(); }
  function talkingAvocado(){
    const mouth = q('mouth'); if (!mouth) return;
    let open = false;
    const anim = setInterval(() => { mouth.style.height = open ? '8px' : '24px'; open = !open; }, 120);
    setTimeout(() => { clearInterval(anim); mouth.style.height = '8px'; mouth.style.width = '32px'; }, 2500);
  }

  async function login(){
    const res = await fetch('/login',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ deviceId: getDeviceId() })});
    const j = await res.json();
    if (j.ok) {
      q('user-badge') && (q('user-badge').innerText = "🥑 Avocat #"+j.id);
      localStorage.setItem('aguacate_token', j.token);
    }
  }

  async function send(){
    const input = q('prompt'); if (!input) return;
    const msg = input.value.trim(); if (!msg) return;
    const messages = q('messages');
    const div = document.createElement('div'); div.className = 'message-user'; div.textContent = msg; messages && messages.appendChild(div);
    input.value = '';
    thinkingAvocado();
    const payload = { user: getDeviceId(), message: msg, mode: (q('mode') && q('mode').value) || 'Kids' };
    const res = await fetch('/chat',{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    const j = await res.json();
    talkingAvocado();
    const out = document.createElement('div'); out.className = 'message-ai'; out.innerHTML = (j.reply||'').replace(/\n/g,'<br>');
    messages && messages.appendChild(out);
    messages && (messages.scrollTop = messages.scrollHeight);
    // update eco UI if present
    if (typeof updateEcoUI === 'function' && j.consumptionLitres !== undefined) updateEcoUI(j.consumptionLitres);
  }

  // bind UI
  q('prompt') && q('prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  const sendBtn = document.querySelector('.send-btn'); sendBtn && sendBtn.addEventListener('click', send);

  // initial login + remove thinking class if left
  login();
  const agu = q('aguacate'); if (agu) agu.classList.remove('thinking');
});
