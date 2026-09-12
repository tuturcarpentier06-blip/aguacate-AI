// app.js (front)
// Controls UI behavior: login, chat, thinking animation, sidebar toggle, footer-legal on scroll, admin/users visibility

document.addEventListener('DOMContentLoaded', () => {
  const Q = id => document.getElementById(id);
  const modeSelect = Q('mode');
  const sidebar = document.querySelector('.sidebar');
  const footerMini = document.querySelector('.footer-mini');
  const messagesWrap = document.querySelector('.messages-wrap') || Q('messages');

  function getDeviceId() {
    let id = localStorage.getItem('aguacate-id');
    if (!id) { id = Math.random().toString(36).substring(2, 8).toUpperCase(); localStorage.setItem('aguacate-id', id); }
    return id;
  }

  // restart thinking animation reliably
  function restartThinkingAnimation(){
    const el = Q('aguacate');
    if (!el) return;
    el.classList.remove('thinking');
    void el.offsetWidth;
    el.classList.add('thinking');
  }
  window.restartThinkingAnimation = restartThinkingAnimation;

  function thinkingAvocado(){ restartThinkingAnimation(); }
  function talkingAvocado(){
    const mouth = Q('mouth'); if (!mouth) return;
    let open = false;
    const anim = setInterval(() => { mouth.style.height = open ? '8px' : '24px'; open = !open; }, 120);
    setTimeout(() => { clearInterval(anim); mouth.style.height = '8px'; mouth.style.width = '32px'; }, 2400);
  }

  // login & token storage
  async function login() {
    const res = await fetch('/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ deviceId: getDeviceId() }) });
    const j = await res.json();
    if (j.ok) {
      Q('user-badge') && (Q('user-badge').innerText = '🥑 Avocat #' + j.id);
      localStorage.setItem('aguacate_token', j.token);
      return j;
    }
  }

  // show/hide admin/users depending on mode
  function updateAdminVisibility() {
    const mode = (modeSelect && modeSelect.value) || 'Kids';
    const hide = ['Kids','Collégien','Professeur'].includes(mode);
    const adminBtn = document.querySelectorAll('.admin-feature'); // buttons marked with class
    adminBtn.forEach(b => { if (hide) b.classList.add('hidden'); else b.classList.remove('hidden'); });
  }

  if (modeSelect) modeSelect.addEventListener('change', updateAdminVisibility);

  // sidebar collapse toggle for mobile
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // footer mini: appear when user scrolls down messages area
  function handleScrollForFooter() {
    if (!messagesWrap || !footerMini) return;
    const sc = messagesWrap.scrollTop;
    if (sc > 120) footerMini.classList.add('active');
    else footerMini.classList.remove('active');
  }
  if (messagesWrap) messagesWrap.addEventListener('scroll', handleScrollForFooter);

  // send message
  async function send() {
    const input = Q('prompt'); if (!input) return;
    const msg = input.value.trim(); if (!msg && !selectedFile) return;
    if (selectedFile) { await scanSelectedFile(); input.value = ''; return; }
    const messages = Q('messages') || messagesWrap;
    const el = document.createElement('div'); el.className = 'message-user'; el.textContent = msg; messages.appendChild(el);
    input.value = '';
    thinkingAvocado();
    const payload = { user: getDeviceId(), message: msg, mode: (modeSelect && modeSelect.value) || 'Kids' };
    try {
      const res = await fetch('/chat', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      talkingAvocado();
      const out = document.createElement('div'); out.className = 'message-ai'; out.textContent = j.reply || ''; out.style.whiteSpace = 'pre-wrap';
      messages.appendChild(out);
      messages.scrollTop = messages.scrollHeight;
      if (typeof updateEcoUI === 'function' && j.consumptionLitres !== undefined) updateEcoUI(j.consumptionLitres);
    } catch(e) {
      console.error(e);
      const out = document.createElement('div'); out.className = 'message-ai'; out.textContent = '🥑 Une erreur est survenue.';
      messages.appendChild(out);
    }
  }

  // 🆓 Free scanner: OCR for images in the browser + text extraction for documents on the server.
  let selectedFile = null;
  const fileInput = Q('file-input');
  const attachBtn = Q('attach-btn');
  const filePreview = Q('file-preview');

  const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/webp','image/gif']);
  const MAX_FILE_MB = 10;

  function showFilePreview(file, extra='') {
    if (!filePreview) return;
    filePreview.classList.remove('hidden');
    filePreview.textContent = `📎 ${file.name} (${Math.max(1, Math.round(file.size / 1024))} Ko)${extra}`;
  }

  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      selectedFile = fileInput.files?.[0] || null;
      if (selectedFile) showFilePreview(selectedFile);
    });
  }

  function addScanMessage(text) {
    const messages = Q('messages') || messagesWrap;
    const out = document.createElement('div');
    out.className = 'message-ai';
    out.textContent = text;
    out.style.whiteSpace = 'pre-wrap';
    messages.appendChild(out);
    messages.scrollTop = messages.scrollHeight;
    return out;
  }

  async function ocrImage(file, progressEl) {
    if (!window.Tesseract) throw new Error('Le moteur OCR gratuit n’est pas disponible.');
    const lang = 'fra+eng';
    const result = await Tesseract.recognize(file, lang, {
      logger: m => {
        if (!progressEl) return;
        if (m.status === 'recognizing text') progressEl.textContent = `📷 Lecture de l’image… ${Math.round((m.progress || 0)*100)}%`;
        else if (m.status) progressEl.textContent = `📷 ${m.status}`;
      }
    });
    return (result.data.text || '').trim();
  }

  async function sendExtractedTextToAI(filename, extractedText, prompt) {
    const token = localStorage.getItem('aguacate_token');
    const form = new FormData();
    // We use the existing chat endpoint: only extracted text is sent to the AI, never the image bytes.
    const message = `Fichier « ${filename} » analysé gratuitement.\n\n${prompt || 'Analyse ce contenu et explique-moi clairement ce qu’il contient.'}\n\n--- TEXTE EXTRAIT ---\n${extractedText.slice(0, 60000)}`;
    const res = await fetch('/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ user:getDeviceId(), message, mode:(modeSelect && modeSelect.value) || 'Kids' })
    });
    const j = await res.json();
    return j.reply || '🥑 Je n’ai pas réussi à analyser le contenu.';
  }

  async function scanSelectedFile() {
    if (!selectedFile) return null;
    const file = selectedFile;
    const messages = Q('messages') || messagesWrap;
    const userMsg = document.createElement('div');
    userMsg.className = 'message-user';
    userMsg.textContent = `📎 ${file.name}`;
    messages.appendChild(userMsg);
    thinkingAvocado();

    const progress = addScanMessage('🥑 Préparation du scan gratuit…');
    const prompt = Q('prompt')?.value.trim() || 'Analyse ce fichier et explique-moi clairement ce qu’il contient.';

    try {
      if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Fichier trop volumineux (maximum ${MAX_FILE_MB} Mo).`);

      let reply;
      if (IMAGE_TYPES.has(file.type)) {
        // OCR is performed entirely on the user's device: no image upload and no vision API cost.
        const text = await ocrImage(file, progress);
        if (!text) throw new Error('Aucun texte détecté dans l’image.');
        progress.remove();
        reply = await sendExtractedTextToAI(file.name, text, prompt);
      } else {
        progress.textContent = '📄 Extraction gratuite du texte du document…';
        const form = new FormData();
        form.append('file', file);
        form.append('prompt', prompt);
        form.append('mode', (modeSelect && modeSelect.value) || 'Kids');
        const token = localStorage.getItem('aguacate_token');
        const res = await fetch('/analyze-file', {
          method:'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: form
        });
        const j = await res.json();
        if (!res.ok || !j.ok) throw new Error(j.error || 'Analyse impossible.');
        reply = j.reply;
        progress.remove();
      }

      addScanMessage(`🥑 ${reply}`);
    } catch (e) {
      progress.remove();
      addScanMessage(`⚠️ ${e.message || 'Impossible de scanner ce fichier.'}`);
    } finally {
      selectedFile = null;
      if (fileInput) fileInput.value = '';
      if (filePreview) { filePreview.textContent = ''; filePreview.classList.add('hidden'); }
    }
    return true;
  }

  // bind UI actions
  const sendBtn = document.querySelector('.send-btn'); if (sendBtn) sendBtn.addEventListener('click', send);
  const input = Q('prompt'); if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  // Admin: view connected users (fix non-working tab)
  window.viewConnectedUsers = async function() {
    const token = localStorage.getItem('aguacate_token');
    const res = await fetch('/users/connected', { headers: { 'Authorization': `Bearer ${token}` }});
    if (res.status === 403) return alert('Accès refusé');
    const list = await res.json();
    const panel = Q('mailbox-list');
    if (!panel) return;
    panel.innerHTML = '<h3>Personnes connectées</h3>';
    list.forEach(u => {
      const p = document.createElement('p');
      p.textContent = `${u.id} • rôle: ${u.role} ${u.connected ? ' (en ligne)' : ''}`;
      panel.appendChild(p);
    });
  };

  // All users list (admin) - used by Users modal
  window.loadUsers = async function() {
    const token = localStorage.getItem('aguacate_token');
    const res = await fetch('/users', { headers: { 'Authorization': `Bearer ${token}` }});
    if (res.status === 403) {
      alert('Accès admin requis');
      return;
    }
    const arr = await res.json();
    const box = Q('user-list');
    if (!box) return;
    box.innerHTML = '';
    arr.forEach(u => {
      const p = document.createElement('p');
      p.innerHTML = `${u.id} • ${u.role} • warnings: ${u.warnings} ${u.connected ? ' • en ligne' : ''} ${u.banned ? ' • BANNI' : ''}`;
      box.appendChild(p);
    });
  };

  // init
  login().then(() => {
    updateAdminVisibility();
    // remove thinking class left
    const agu = Q('aguacate'); if (agu) agu.classList.remove('thinking');
  });

  // Expose minimal helpers for template buttons
  window.toggleSidebar = () => sidebar.classList.toggle('collapsed');
  window.openUsersPanel = () => { Q('users-panel') && (Q('users-panel').style.display = 'flex'); loadUsers(); };
  window.closeUsersPanel = () => { Q('users-panel') && (Q('users-panel').style.display = 'none'); };
  window.openAdminPanel = () => { Q('admin-panel') && (Q('admin-panel').style.display = 'flex'); };
  window.closeAdminPanel = () => { Q('admin-panel') && (Q('admin-panel').style.display = 'none'); };

});
