/* =======================
   Aguacate AI - app.js
   Refonte complète front JS
   - initialisation automatique
   - fetch centralisé
   - animation thinking restart
   - modes avec mot de passe pour Professeur/Admin
   - écoguacate sync (consommation d'eau)
   - gestion conversations & admin view
   ======================= */

(() => {
  // ---------- Configuration & état ----------
  let currentConversation = null;
  let currentVoice = "female";
  let liveMode = false;
  let currentRole = "user";
  let currentUserId = null;
  let consumptionLitres = 0;

  const API = {
    post: async (path, body) => {
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body || {})
        });
        return await res.json();
      } catch (e) {
        console.error("Fetch error", path, e);
        return { ok: false, error: "network" };
      }
    },
    get: async (path) => {
      try {
        const res = await fetch(path);
        return await res.json();
      } catch (e) {
        console.error("Fetch GET error", path, e);
        return null;
      }
    }
  };

  // ---------- Utils ----------
  function getDeviceId() {
    let id = localStorage.getItem("aguacate-id");
    if (!id) {
      id = Math.random().toString(36).substring(2, 6).toUpperCase();
      localStorage.setItem("aguacate-id", id);
    }
    return id;
  }

  function q(id) { return document.getElementById(id); }
  function el(sel) { return document.querySelector(sel); }

  // ---------- Avatar animation helpers ----------
  function restartThinkingAnimation() {
    const agu = q("aguacate");
    if (!agu) return;
    agu.classList.remove("thinking");
    void agu.offsetWidth; // force reflow
    agu.classList.add("thinking");
  }

  function thinkingAvocado() { restartThinkingAnimation(); }

  function talkingAvocado() {
    const mouth = q("mouth");
    if (!mouth) return;
    let open = false;
    const anim = setInterval(() => {
      mouth.style.height = open ? "8px" : "24px";
      open = !open;
    }, 120);
    setTimeout(() => {
      clearInterval(anim);
      mouth.style.height = "8px";
      mouth.style.width = "32px";
    }, 2500);
  }

  // ---------- Eco UI ----------
  function computeEcoScore(litres) { return Math.min(100, Math.round((litres / 60) * 100)); }

  function updateEcoUI(litres) {
    consumptionLitres = litres;
    const pointer = el("#ecoPointer");
    if (pointer) pointer.style.transform = `translateX(${computeEcoScore(litres)}%)`;

    const waterFill = el("#waterFill");
    const waterText = el("#waterText");
    const waterCircle = el("#waterCircle");
    const ecoMessage = el("#ecoMessage");

    const pct = Math.min(100, Math.round((litres / 60) * 100));
    if (waterFill) waterFill.style.height = `${pct}%`;
    if (waterText) waterText.textContent = `${litres}L`;

    if (waterCircle) {
      waterCircle.classList.remove("green", "yellow", "orange", "red");
      if (litres <= 10) waterCircle.classList.add("green");
      else if (litres <= 25) waterCircle.classList.add("yellow");
      else if (litres <= 35) waterCircle.classList.add("orange");
      else waterCircle.classList.add("red");
    }

    if (ecoMessage) {
      ecoMessage.textContent = litres >= 50 ? "🥑 Aguacate pleure : s'il te plaît arrête de consommer de l'eau 😢" : "";
    }
  }

  // ---------- Login (auto, no password) ----------
  async function login() {
    const deviceId = getDeviceId();
    const res = await API.post("/login", { deviceId });
    if (!res || res.ok === false) {
      console.warn("Login failed", res);
      alert("Impossible de se connecter (erreur serveur).");
      return;
    }
    currentUserId = res.id;
    currentRole = res.role || "user";
    const badge = q("user-badge");
    if (badge) badge.innerText = "🥑 Avocat #" + res.id;
    // Try to load previous consumption if any (server may return on first chat)
    if (res.consumptionLitres !== undefined) updateEcoUI(res.consumptionLitres);
    await loadConversations();
  }

  // ---------- Mode selection (Professeur/Admin password) ----------
  async function handleModeChange(mode) {
    if (mode === "Professeur" || mode === "Admin") {
      const pwd = prompt(`Entrez le mot de passe spécial pour activer le mode ${mode}`);
      if (!pwd) {
        // revert select to default
        const sel = q("mode");
        if (sel) sel.value = "Kids";
        return;
      }
      const res = await API.post("/modes/verify", { mode, password: pwd, deviceId: getDeviceId() });
      if (res && res.ok) {
        currentRole = res.role || currentRole;
        alert("Mode activé : " + currentRole);
        return;
      } else {
        alert("Mot de passe incorrect");
        const sel = q("mode"); if (sel) sel.value = "Kids";
        return;
      }
    } else {
      currentRole = "user";
    }
  }

  // ---------- Chat send ----------
  async function send() {
    const input = q("prompt");
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    // append user message
    const messages = q("messages");
    if (messages) {
      const node = document.createElement("div");
      node.className = "message-user";
      node.textContent = msg;
      messages.appendChild(node);
      messages.scrollTop = messages.scrollHeight;
    }
    input.value = "";

    thinkingAvocado();

    const payload = {
      message: msg,
      user: getDeviceId(),
      mode: (q("mode") && q("mode").value) || "Kids"
    };
    const res = await API.post("/chat", payload);
    if (!res) {
      appendAIMessage("Erreur réseau");
      return;
    }
    if (res.consumptionLitres !== undefined) updateEcoUI(res.consumptionLitres);
    appendAIMessage(res.reply || "Erreur IA");
    talkingAvocado();
  }

  function appendAIMessage(text) {
    const messages = q("messages");
    if (!messages) return;
    const node = document.createElement("div");
    node.className = "message-ai";
    node.innerHTML = text.replace(/\n/g, "<br>");
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  }

  // ---------- Conversations management ----------
  async function newConversation() {
    await API.post("/newConversation", { user: getDeviceId() });
    await loadConversations();
  }

  async function loadConversations() {
    const user = getDeviceId();
    const res = await API.get("/conversations/" + user);
    const box = el(".conversations");
    if (!box) return;
    box.innerHTML = "";
    if (!Array.isArray(res)) return;
    res.forEach(conv => {
      const div = document.createElement("div");
      div.className = "conversation";
      div.innerHTML = `<span onclick="selectConversation('${conv.id}')">${conv.title}</span>
                       <button class="delete-conversation" onclick="deleteConversation('${conv.id}')">🗑</button>`;
      box.appendChild(div);
    });
  }

  window.selectConversation = function(id){
    currentConversation = id;
  };

  async function renameConversation() {
    if (!currentConversation) return alert("Sélectionnez une conversation");
    const name = prompt("Nouveau nom");
    if (!name) return;
    await API.post("/renameConversation", { user: getDeviceId(), conversationId: currentConversation, title: name });
    await loadConversations();
  }

  window.deleteConversation = async function(id) {
    if (!confirm("Supprimer cette conversation ?")) return;
    await API.post("/deleteConversation", { user: getDeviceId(), conversationId: id });
    await loadConversations();
  };

  // ---------- Users & admin ----------
  async function loadUsers() {
    const res = await API.get("/users");
    const box = q("user-list");
    if (!box) return;
    box.innerHTML = "";
    (res||[]).forEach(user => {
      const p = document.createElement("p");
      const dot = user.role === "admin" ? "🟡" : (user.role === "professeur" ? "🔵" : "🟢");
      p.innerHTML = `${dot} Avocat #${user.id} (⚠ ${user.warnings}) ${user.connected ? " • en ligne" : ""} ${currentRole === "admin" ? `<button onclick="viewUserConversations('${user.id}')">Voir</button>` : ""}`;
      box.appendChild(p);
    });
  }

  window.viewUserConversations = async function(userId) {
    if (currentRole !== "admin") return alert("Accès refusé");
    const res = await API.get("/conversations/" + userId);
    const box = q("mailbox-list");
    if (!box) return;
    box.innerHTML = `<h3>Conversations de ${userId}</h3>`;
    (res||[]).forEach(c => {
      const div = document.createElement("div");
      div.style.borderBottom = "1px solid #eee";
      div.style.padding = "8px";
      div.innerHTML = `<strong>${c.title}</strong><pre style="white-space:pre-wrap;font-family:var(--mono, monospace);font-size:12px">${JSON.stringify(c.messages || [], null, 2)}</pre>`;
      box.appendChild(div);
    });
  };

  async function loadMailbox() {
    const res = await API.get("/adminlogs");
    const box = q("mailbox-list");
    if (!box) return;
    box.innerHTML = "";
    (res||[]).forEach(log => {
      const p = document.createElement("p");
      p.textContent = `${log.type} - ${log.user} - ${new Date(log.date).toLocaleString()}`;
      box.appendChild(p);
    });
  }

  // ---------- Voice helpers (simple) ----------
  function setVoice(type) {
    currentVoice = type;
    alert("Voix : " + type);
  }

  async function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "fr-FR";
    speechSynthesis.speak(utt);
  }

  function toggleLive() {
    liveMode = !liveMode;
    alert(liveMode ? "🎤 Mode Live activé" : "🎤 Mode Live désactivé");
  }

  // ---------- DOM bindings & init ----------
  function bindUI() {
    const sendBtn = document.querySelector(".send-btn");
    if (sendBtn) sendBtn.addEventListener("click", send);
    const promptInput = q("prompt");
    if (promptInput) promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    const modeSel = q("mode");
    if (modeSel) modeSel.addEventListener("change", (e) => handleModeChange(e.target.value));

    // header buttons
    const liveBtn = [...document.querySelectorAll(".bottom-buttons button")].find(b => b.textContent.includes("Mode Live"));
    if (liveBtn) liveBtn.addEventListener("click", toggleLive);
  }

  async function init() {
    bindUI();
    await login(); // auto-login
    // initial eco UI
    updateEcoUI(consumptionLitres || 0);
    // expose some helpers to global for modals/buttons from HTML
    window.newConversation = newConversation;
    window.renameConversation = renameConversation;
    window.openAdmin = () => { const panel = q("admin-panel"); if (panel) panel.style.display = "flex"; };
    window.closeAdmin = () => { const panel = q("admin-panel"); if (panel) panel.style.display = "none"; };
    window.openUsers = () => { const p = q("users-panel"); if (p) p.style.display = "flex"; loadUsers(); };
    window.closeUsers = () => { const p = q("users-panel"); if (p) p.style.display = "none"; };
    window.openMailbox = () => { const p = q("mailbox-panel"); if (p) p.style.display = "flex"; loadMailbox(); };
    window.closeMailbox = () => { const p = q("mailbox-panel"); if (p) p.style.display = "none"; };
    window.setVoice = setVoice;
    window.toggleLive = toggleLive;
  }

  // init on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
// après fetch('/login', { ... }) -> response data
localStorage.setItem('aguacate_token', data.token);
const token = localStorage.getItem('aguacate_token');
const res = await fetch('/users', { headers: { 'Authorization': `Bearer ${token}` } });
