// app.js (modifié) - login sans mot de passe, mode verify, écoguacate UI hooks, animation fix

// ======================
// CONFIG
let currentConversation = null;
let currentVoice = "female";
let liveMode = false;
let currentRole = "user";
let currentUserId = null;
let consumptionLitres = 0;

// ======================
// ID APPAREIL PERMANENT
function getDeviceId() {
  let id = localStorage.getItem("aguacate-id");
  if (!id) {
    id = Math.random().toString(36).substring(2, 6).toUpperCase();
    localStorage.setItem("aguacate-id", id);
  }
  return id;
}

// ======================
// LOGIN (sans mot de passe)
async function login() {
  const deviceId = getDeviceId();
  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId })
  });
  const data = await res.json();
  if (!data.ok) {
    alert("Erreur lors de la connexion");
    return;
  }
  currentRole = data.role;
  currentUserId = data.id;
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  document.getElementById("user-badge").innerText = "🥑 Avocat #" + data.id;
  loadConversations();
  updateEcoUI(0, 0);
}

// ======================
// AVATAR - thinking animation fix
function restartThinkingAnimation() {
  const agu = document.getElementById("aguacate");
  if (!agu) return;
  agu.classList.remove("thinking");
  // force reflow
  void agu.offsetWidth;
  agu.classList.add("thinking");
}

function thinkingAvocado() {
  restartThinkingAnimation();
}

function talkingAvocado() {
  const mouth = document.getElementById("mouth");
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

// ======================
// ECOGUACATE UI helpers
function updateEcoUI(litres, scorePercent) {
  consumptionLitres = litres;
  const pointer = document.getElementById("ecoPointer");
  if (pointer) pointer.style.transform = `translateX(${Math.min(100, scorePercent)}%)`;

  const waterFill = document.getElementById("waterFill");
  const waterText = document.getElementById("waterText");
  const waterCircle = document.getElementById("waterCircle");
  const ecoMessage = document.getElementById("ecoMessage");

  const max = 60;
  const pct = Math.min(100, Math.round((litres / max) * 100));
  if (waterFill) waterFill.style.clipPath = `circle(${pct}% at 50% 100%)`;
  if (waterText) waterText.textContent = `${litres}L`;

  if (waterCircle) {
    waterCircle.classList.remove("green", "yellow", "orange", "red");
    if (litres <= 10) waterCircle.classList.add("green");
    else if (litres <= 25) waterCircle.classList.add("yellow");
    else if (litres <= 35) waterCircle.classList.add("orange");
    else waterCircle.classList.add("red");
  }

  if (ecoMessage) {
    if (litres >= 50) ecoMessage.textContent = "🥑 Aguacate pleure : s'il te plaît arrête de consommer de l'eau 😢";
    else ecoMessage.textContent = "";
  }
}

// calcule un "score" pour la barre (simple map)
function computeEcoScore(litres) {
  // map 0..60 -> 0..100
  return Math.min(100, Math.round((litres / 60) * 100));
}

// ======================
// CHAT
async function send() {
  const input = document.getElementById("prompt");
  const msg = input.value.trim();
  if (!msg) return;

  const messages = document.getElementById("messages");
  messages.innerHTML += `<div class="message-user">${msg}</div>`;
  input.value = "";

  thinkingAvocado();

  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: msg,
      user: getDeviceId(),
      mode: document.getElementById("mode").value
    })
  });

  const data = await res.json();

  talkingAvocado();

  messages.innerHTML += `<div class="message-ai">${data.reply}</div>`;
  messages.scrollTop = messages.scrollHeight;

  // update eco consumption if provided
  if (data.consumptionLitres !== undefined) {
    updateEcoUI(data.consumptionLitres, computeEcoScore(data.consumptionLitres));
  } else {
    // fallback: approximate consumption based on reply length
    consumptionLitres += 1 + Math.floor((data.reply || "").length / 200);
    updateEcoUI(consumptionLitres, computeEcoScore(consumptionLitres));
  }

  if (liveMode) speak(data.reply);
}

// ======================
// CONVERSATIONS
async function newConversation() {
  const res = await fetch("/newConversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: getDeviceId() })
  });
  const data = await res.json();
  currentConversation = data.id;
  loadConversations();
}

async function loadConversations() {
  const user = getDeviceId();
  const res = await fetch("/conversations/" + user);
  const list = await res.json();
  const box = document.querySelector(".conversations");
  if (!box) return;
  box.innerHTML = "";
  list.forEach(conv => {
    box.innerHTML += `
<div class="conversation">
  <span onclick="selectConversation('${conv.id}')">${conv.title}</span>
  <button class="delete-conversation" onclick="deleteConversation('${conv.id}')">🗑</button>
</div>
`;
  });
}

function selectConversation(id) {
  currentConversation = id;
}

async function renameConversation() {
  if (!currentConversation) return;
  const name = prompt("Nouveau nom");
  if (!name) return;
  await fetch("/renameConversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: getDeviceId(), conversationId: currentConversation, title: name })
  });
  loadConversations();
}

// ======================
// VOIX
function setVoice(type) {
  currentVoice = type;
  alert("Voix : " + type);
}
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  speechSynthesis.speak(utterance);
}
function toggleLive() {
  liveMode = !liveMode;
  alert(liveMode ? "🎤 Mode Live activé" : "🎤 Mode Live désactivé");
}

// ======================
// ADMIN / UTILISATEURS UI
function openAdmin() {
  const panel = document.getElementById("admin-panel");
  if (panel) panel.style.display = "flex";
}
function openUsers() {
  const panel = document.getElementById("users-panel");
  if (panel) panel.style.display = "flex";
  loadUsers();
}
function openMailbox() {
  const panel = document.getElementById("mailbox-panel");
  if (panel) panel.style.display = "flex";
  loadMailbox();
}

async function loadUsers() {
  const res = await fetch("/users");
  const users = await res.json();
  const box = document.getElementById("user-list");
  if (!box) return;
  box.innerHTML = "";
  users.forEach(user => {
    let dot = "🟢";
    if (user.role === "admin") dot = "🟡";
    if (user.role === "professeur") dot = "🔵";
    box.innerHTML += `
    <p>
      ${dot}
      Avocat #${user.id}
      (⚠ ${user.warnings})
      ${user.connected ? " • en ligne" : ""}
      ${currentRole === "admin" ? `<button onclick="viewUserConversations('${user.id}')">Voir</button>` : ""}
    </p>`;
  });
}

async function viewUserConversations(userId) {
  if (currentRole !== "admin") { alert("Accès refusé"); return; }
  const res = await fetch("/conversations/" + userId);
  const convs = await res.json();
  const box = document.getElementById("mailbox-list");
  if (!box) return;
  box.innerHTML = `<h3>Conversations de ${userId}</h3>`;
  convs.forEach(c => {
    box.innerHTML += `<div style="border-bottom:1px solid #eee;padding:8px"><strong>${c.title}</strong><pre style="white-space:pre-wrap">${JSON.stringify(c.messages, null, 2)}</pre></div>`;
  });
}

// ======================
// MAILBOX
async function loadMailbox() {
  const res = await fetch("/adminlogs");
  const logs = await res.json();
  const box = document.getElementById("mailbox-list");
  if (!box) return;
  box.innerHTML = "";
  logs.forEach(log => {
    box.innerHTML += `<p>${log.type} - ${log.user} - ${new Date(log.date).toLocaleString()}</p>`;
  });
}

// ======================
// DELETE CONVERSATION
async function deleteConversation(id) {
  const confirmDelete = confirm("Supprimer cette conversation ?");
  if (!confirmDelete) return;
  await fetch("/deleteConversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: getDeviceId(), conversationId: id })
  });
  loadConversations();
}

// ======================
// MODE SELECT : vérification pour Professeur / Admin
document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("mode");
  if (sel) {
    sel.addEventListener("change", async (e) => {
      const mode = e.target.value;
      if (mode === "Professeur" || mode === "Admin") {
        const pwd = prompt("Entrez le mot de passe spécial pour activer le mode " + mode);
        if (!pwd) {
          // revert to user
          sel.value = "Kids";
          return;
        }
        const res = await fetch("/modes/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, password: pwd, deviceId: getDeviceId() })
        });
        const json = await res.json();
        if (json.ok) {
          currentRole = json.role;
          alert("Mode activé : " + json.role);
        } else {
          alert("Mot de passe incorrect");
          sel.value = "Kids";
        }
      } else {
        // normal modes
        currentRole = "user";
      }
    });
  }
});

// ======================
// ENTER handling
document.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const loginVisible = document.getElementById("login-screen").style.display !== "none";
    if (loginVisible) login();
    else send();
  }
});
