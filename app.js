// ======================
// CONFIG
// ======================

const PASSWORD = "BenjaminAguacateAI2026#";

let currentConversation = null;
let currentVoice = "female";
let liveMode = false;
let currentRole = "user";

// ======================
// MOT DE PASSE
// ======================

function togglePassword() {

  const input =
    document.getElementById("password");

  input.type =
    input.type === "password"
      ? "text"
      : "password";

}

// ======================
// ID APPAREIL PERMANENT
// ======================

function getDeviceId() {

  let id =
    localStorage.getItem(
      "aguacate-id"
    );

  if (!id) {

    id =
      Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();

    localStorage.setItem(
      "aguacate-id",
      id
    );

  }

  return id;

}

// ======================
// LOGIN
// ======================

async function login() {

  const password =
    document.getElementById(
      "password"
    ).value;

  const deviceId =
    getDeviceId();

  const res =
    await fetch("/login", {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        password,
        deviceId

      })

    });

  const data =
    await res.json();

  if (!data.ok) {

    alert(
      "Mot de passe incorrect"
    );

    return;

  }

  currentRole =
    data.role;

  document
    .getElementById(
      "login-screen"
    )
    .style.display =
      "none";

  document
    .getElementById(
      "app"
    )
    .style.display =
      "flex";

  document
    .getElementById(
      "user-badge"
    )
    .innerText =
      "🥑 Avocat #" + data.id;

  loadConversations();

}

// ======================
// AVATAR
// ======================

function thinkingAvocado() {

  const mouth =
    document.getElementById(
      "mouth"
    );

  if (!mouth) return;

  mouth.style.width =
    "14px";

  mouth.style.height =
    "14px";

  mouth.style.borderRadius =
    "50%";

}

function talkingAvocado() {

  const mouth =
    document.getElementById(
      "mouth"
    );

  if (!mouth) return;

  let open = false;

  const anim =
    setInterval(() => {

      if (open) {

        mouth.style.height =
          "8px";

      } else {

        mouth.style.height =
          "24px";

      }

      open = !open;

    }, 120);

  setTimeout(() => {

    clearInterval(anim);

    mouth.style.height =
      "8px";

    mouth.style.width =
      "32px";

  }, 2500);

}

// ======================
// CHAT
// ======================

async function send() {

  const input =
    document.getElementById(
      "prompt"
    );

  const msg =
    input.value.trim();

  if (!msg) return;

  const messages =
    document.getElementById(
      "messages"
    );

  messages.innerHTML += `
  <div class="message-user">
    ${msg}
  </div>`;

  input.value = "";

  thinkingAvocado();

  const res =
    await fetch("/chat", {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        message: msg,

        user: getDeviceId(),

        mode:
          document
            .getElementById(
              "mode"
            )
            .value

      })

    });

  const data =
    await res.json();

  talkingAvocado();

  messages.innerHTML += `
  <div class="message-ai">
    ${data.reply}
  </div>`;

  messages.scrollTop =
    messages.scrollHeight;

  if (liveMode) {
    speak(data.reply);
  }

}

// ======================
// CONVERSATIONS
// ======================

async function newConversation() {

  const res =
    await fetch(
      "/newConversation",
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          user:
            getDeviceId()

        })

      }
    );

  const data =
    await res.json();

  currentConversation =
    data.id;

  loadConversations();

}

async function loadConversations() {

  const user =
    getDeviceId();

  const res =
    await fetch(
      "/conversations/" +
        user
    );

  const list =
    await res.json();

  const box =
    document.querySelector(
      ".conversations"
    );

  if (!box) return;

  box.innerHTML = "";

  list.forEach(conv => {

    box.innerHTML += `
    <div class="conversation"
         onclick="selectConversation('${conv.id}')">
      ${conv.title}
    </div>`;

  });

}

function selectConversation(id) {

  currentConversation =
    id;

}

// ======================
// RENOMMER
// ======================

async function renameConversation() {

  if (
    !currentConversation
  )
    return;

  const name =
    prompt(
      "Nouveau nom"
    );

  if (!name) return;

  await fetch(
    "/renameConversation",
    {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        user:
          getDeviceId(),

        conversationId:
          currentConversation,

        title: name

      })

    }
  );

  loadConversations();

}

// ======================
// VOIX
// ======================

function setVoice(type) {

  currentVoice =
    type;

  alert(
    "Voix : " + type
  );

}

function speak(text) {

  if (
    !(
      "speechSynthesis" in
      window
    )
  )
    return;

  const utterance =
    new SpeechSynthesisUtterance(
      text
    );

  utterance.lang =
    "fr-FR";

  speechSynthesis.speak(
    utterance
  );

}

function toggleLive() {

  liveMode =
    !liveMode;

  alert(
    liveMode
      ? "🎤 Mode Live activé"
      : "🎤 Mode Live désactivé"
  );

}

// ======================
// ADMIN
// ======================

function openAdmin() {

  const panel =
    document.getElementById(
      "admin-panel"
    );

  if (panel) {

    panel.style.display =
      "flex";

  }

}

function openUsers() {

  const panel =
    document.getElementById(
      "users-panel"
    );

  if (panel) {

    panel.style.display =
      "flex";

  }

  loadUsers();

}

function openMailbox() {

  const panel =
    document.getElementById(
      "mailbox-panel"
    );

  if (panel) {

    panel.style.display =
      "flex";

  }

  loadMailbox();

}

// ======================
// USERS
// ======================

async function loadUsers() {

  const res =
    await fetch(
      "/users"
    );

  const users =
    await res.json();

  const box =
    document.getElementById(
      "user-list"
    );

  if (!box) return;

  box.innerHTML = "";

  users.forEach(user => {

    let dot = "🟢";

    if (
      user.role ===
      "admin"
    ) {
      dot = "🟡";
    }

    if (
      user.role ===
      "supreme"
    ) {
      dot = "⚫";
    }

    box.innerHTML += `
    <p>
      ${dot}
      Avocat #${user.id}
      (⚠ ${user.warnings})
    </p>`;

  });

}

// ======================
// MAILBOX
// ======================

async function loadMailbox() {

  const res =
    await fetch(
      "/adminlogs"
    );

  const logs =
    await res.json();

  const box =
    document.getElementById(
      "mailbox-list"
    );

  if (!box) return;

  box.innerHTML = "";

  logs.forEach(log => {

    box.innerHTML += `
    <p>
      ${log.type}
      -
      ${log.user}
    </p>`;

  });

}

// ======================
// ENTER
// ======================

document.addEventListener(
  "keydown",
  e => {

    if (
      e.key === "Enter"
    ) {

      const loginVisible =
        document
          .getElementById(
            "login-screen"
          )
          .style.display !==
        "none";

      if (loginVisible) {

        login();

      } else {

        send();

      }

    }

  }
);
function closeAdmin(){

  document.getElementById(
    "admin-panel"
  ).style.display = "none";

}

function closeUsers(){

  document.getElementById(
    "users-panel"
  ).style.display = "none";

}

function closeMailbox(){

  document.getElementById(
    "mailbox-panel"
  ).style.display = "none";

}
