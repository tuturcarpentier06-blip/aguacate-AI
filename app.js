/* =========================================================
   AGUACATE AI v4.0.0
   APP.JS
   ========================================================= */

(() => {

'use strict';


/* =========================================================
   ÉTAT CENTRAL
   ========================================================= */

const state = {

  token: localStorage.getItem('aguacate_token') || '',

  userId: localStorage.getItem('aguacate_user_id') || '',

  role: localStorage.getItem('aguacate_role') || 'user',

  consumptionLitres: 0,

  conversations: [],

  currentConversationId: null,

  selectedFile: null,

  sending: false

};


/*
   IMPORTANT :

   Une seule valeur est utilisée pour l'ÉcoGuacate.

   state.consumptionLitres

   Le compteur, le %, la barre,
   l'arbre et la pompe utilisent TOUS cette valeur.
*/


/* =========================================================
   UTILITAIRES
   ========================================================= */

const $ = id => document.getElementById(id);


function escapeHTML(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


function showToast(message) {

  const toast = $('toast');

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);

}


async function api(url, options = {}) {

  const headers = {
    ...(options.headers || {})
  };

  if (state.token) {

    headers.Authorization =
      `Bearer ${state.token}`;

  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {

    const error = new Error(
      data.message ||
      data.error ||
      `Erreur HTTP ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}


/* =========================================================
   ÉCOGUACATE
   ========================================================= */

/*
   Échelle :

   0 - 20     vert
   20 - 50    jaune
   50 - 85    orange
   85 - 100+  rouge

   Le pourcentage représente directement
   la consommation sur une base de 100 L.

   Exemple :

   3 L  = 3 %
   25 L = 25 %
   50 L = 50 %
   85 L = 85 %
   100 L = 100 %
   150 L = 100 % visuellement
*/

const ECO_MAX = 100;


function getEcoState(litres) {

  const value = Math.max(
    0,
    Number(litres) || 0
  );

  const percentage =
    Math.min(
      100,
      Math.max(
        0,
        value
      )
    );


  let level;
  let color;
  let status;


  if (value <= 20) {

    level = 'good';
    color = '#22c55e';
    status = 'Excellent 🌿';

  }

  else if (value <= 50) {

    level = 'warning';
    color = '#eab308';
    status = 'Attention 🌱';

  }

  else if (value < 85) {

    level = 'danger';
    color = '#f97316';
    status = 'Impact élevé 🍂';

  }

  else {

    level = 'dead';
    color = '#ef4444';
    status = 'Très forte consommation 🔴';

  }


  return {
    litres: value,
    percentage,
    level,
    color,
    status
  };

}


function updateEcoGuacate(litres) {

  /*
     SOURCE UNIQUE

     Toutes les parties reçoivent exactement
     la même valeur.
  */

  const eco = getEcoState(litres);


  state.consumptionLitres =
    eco.litres;


  /* -------------------------------------------------------
     COMPTEUR
     ------------------------------------------------------- */

  const litresElement =
    $('eco-litres');

  if (litresElement) {

    litresElement.textContent =
      eco.litres.toFixed(1).replace('.', ',');

  }


  /* -------------------------------------------------------
     POURCENTAGE
     ------------------------------------------------------- */

  const percentageElement =
    $('eco-pct');

  if (percentageElement) {

    percentageElement.textContent =
      `${Math.round(eco.percentage)}%`;

    percentageElement.style.color =
      eco.color;

  }


  /* -------------------------------------------------------
     BARRE
     ------------------------------------------------------- */

  const bar =
    $('eco-bar-fill');

  if (bar) {

    bar.style.width =
      `${eco.percentage}%`;

    bar.style.background =
      eco.color;

    bar.style.boxShadow =
      `0 0 10px ${eco.color}55`;

  }


  /* -------------------------------------------------------
     CURSEUR
     ------------------------------------------------------- */

  const marker =
    $('eco-marker');

  if (marker) {

    marker.style.left =
      `${eco.percentage}%`;

    marker.style.borderColor =
      eco.color;

  }


  /* -------------------------------------------------------
     ARBRE
     ------------------------------------------------------- */

  const tree =
    $('eco-tree');

  if (tree) {

    tree.classList.remove(
      'tree-good',
      'tree-warning',
      'tree-danger',
      'tree-dry',
      'tree-dead'
    );


    if (eco.litres <= 20) {

      tree.classList.add(
        'tree-good'
      );

    }

    else if (eco.litres <= 50) {

      tree.classList.add(
        'tree-warning'
      );

    }

    else if (eco.litres < 85) {

      tree.classList.add(
        'tree-danger'
      );

    }

    else if (eco.litres < 100) {

      tree.classList.add(
        'tree-dry'
      );

    }

    else {

      tree.classList.add(
        'tree-dead'
      );

    }

  }


  /* -------------------------------------------------------
     POMPE
     ------------------------------------------------------- */

  const pump =
    $('eco-water-pump');

  const pumpWater =
    $('pump-water');

  if (pumpWater) {

    const remaining =
      Math.max(
        0,
        1 - eco.percentage / 100
      );

    pumpWater.style.height =
      `${remaining * 100}%`;

  }


  if (pump) {

    if (eco.percentage >= 100) {

      pump.classList.add('dry');

    } else {

      pump.classList.remove('dry');

    }

  }


  /* -------------------------------------------------------
     LUMIÈRE
     ------------------------------------------------------- */

  const glow =
    $('eco-glow');

  if (glow) {

    glow.style.opacity =
      eco.level === 'dead'
        ? '.35'
        : '1';


    glow.style.background =
      `radial-gradient(
        circle,
        ${eco.color}44,
        ${eco.color}0d 50%,
        transparent 72%
      )`;

  }


  /* -------------------------------------------------------
     STATUT
     ------------------------------------------------------- */

  const status =
    $('eco-status');

  if (status) {

    status.textContent =
      eco.status;

    status.style.color =
      eco.color;

  }

}


/* =========================================================
   CONNEXION
   ========================================================= */

async function login() {

  try {

    const deviceId =
      localStorage.getItem(
        'aguacate_device_id'
      ) || '';


    const result =
      await api('/login', {

        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          deviceId
        })

      });


    state.token =
      result.token;

    state.userId =
      result.id;

    state.role =
      result.role || 'user';


    localStorage.setItem(
      'aguacate_token',
      state.token
    );

    localStorage.setItem(
      'aguacate_user_id',
      state.userId
    );

    localStorage.setItem(
      'aguacate_role',
      state.role
    );


    updateUserInterface();


    /*
       IMPORTANT :
       on prend la valeur du serveur
       et on ne la recalcule pas.
    */

    updateEcoGuacate(
      Number(result.consumptionLitres || 0)
    );


    await loadConversations();


    startHeartbeat();

  }

  catch (error) {

    if (
      error.status === 403 &&
      error.data?.error === 'banned'
    ) {

      const until =
        error.data.bannedUntil
          ? new Date(
              error.data.bannedUntil
            ).toLocaleString('fr-FR')
          : 'plus tard';

      showToast(
        `🚫 Accès suspendu jusqu'au ${until}`
      );

      return;

    }


    console.error(
      '[login]',
      error
    );

    showToast(
      'Impossible de se connecter à Aguacate AI.'
    );

  }

}


/* =========================================================
   INTERFACE UTILISATEUR
   ========================================================= */

function updateUserInterface() {

  const badge =
    $('user-badge');

  if (badge) {

    badge.textContent =
      `🥑 Aguacate AI #${state.userId || '0000'}`;

  }


  const role =
    $('role-badge');

  if (role) {

    const labels = {

      admin: 'ADMINISTRATEUR',

      professeur: 'PROFESSEUR',

      user: 'UTILISATEUR'

    };

    role.textContent =
      labels[state.role] ||
      'UTILISATEUR';


    role.className =
      `role-badge ${state.role}`;

  }

}


/* =========================================================
   HEARTBEAT
   ========================================================= */

let heartbeatTimer = null;


function startHeartbeat() {

  if (heartbeatTimer) {

    clearInterval(
      heartbeatTimer
    );

  }


  heartbeatTimer =
    setInterval(async () => {

      if (!state.token) return;

      try {

        await api('/heartbeat');

      }

      catch (error) {

        if (
          error.status === 401 ||
          error.status === 403
        ) {

          console.warn(
            'Session expirée.'
          );

        }

      }

    }, 30000);

}


/* =========================================================
   CONVERSATIONS
   ========================================================= */

async function loadConversations() {

  try {

    const result =
      await api('/conversations');


    state.conversations =
      Array.isArray(result)
        ? result
        : [];


    renderConversationList();


    if (
      state.conversations.length &&
      !state.currentConversationId
    ) {

      openConversation(
        state.conversations[
          state.conversations.length - 1
        ].id
      );

    }

  }

  catch (error) {

    console.error(
      '[conversations]',
      error
    );

  }

}


function renderConversationList() {

  const list =
    $('conversation-list');

  if (!list) return;


  list.innerHTML = '';


  state.conversations
    .forEach(conversation => {

      const item =
        document.createElement('div');

      item.className =
        'conversation-item';


      if (
        conversation.id ===
        state.currentConversationId
      ) {

        item.classList.add(
          'active'
        );

      }


      item.innerHTML = `

        <button
          class="conversation-open"
          type="button"
        >
          💬
          <span>
            ${escapeHTML(
              conversation.title ||
              'Conversation'
            )}
          </span>
        </button>

        <button
          class="conversation-delete"
          type="button"
          title="Supprimer"
        >
          🗑️
        </button>

      `;


      item
        .querySelector(
          '.conversation-open'
        )
        .addEventListener(
          'click',
          () => {

            openConversation(
              conversation.id
            );

          }
        );


      item
        .querySelector(
          '.conversation-delete'
        )
        .addEventListener(
          'click',
          event => {

            event.stopPropagation();

            deleteConversation(
              conversation.id
            );

          }
        );


      list.appendChild(
        item
      );

    });

}


function openConversation(id) {

  const conversation =
    state.conversations.find(
      c => c.id === id
    );

  if (!conversation) return;


  state.currentConversationId =
    id;


  renderConversationList();


  renderMessages(
    conversation.messages || []
  );

}


function renderMessages(messages) {

  const container =
    $('messages');

  if (!container) return;


  container.innerHTML = '';


  messages.forEach(message => {

    addMessageToUI(
      message.role,
      message.content,
      false
    );

  });


  container.scrollTop =
    container.scrollHeight;

}


function addMessageToUI(
  role,
  content,
  scroll = true
) {

  const container =
    $('messages');

  if (!container) return;


  const message =
    document.createElement('div');

  message.className =
    `message ${role}`;


  message.innerHTML = `
    <div class="message-bubble">
      ${escapeHTML(content)
        .replace(/\n/g, '<br>')}
    </div>
  `;


  container.appendChild(
    message
  );


  if (scroll) {

    container.scrollTop =
      container.scrollHeight;

  }

}


/* =========================================================
   NOUVELLE CONVERSATION
   ========================================================= */

async function newConversation() {

  try {

    const result =
      await api('/newConversation', {

        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: '{}'

      });


    state.conversations =
      result.conversations || [];


    state.currentConversationId =
      result.id;


    renderConversationList();


    renderMessages([]);


    showToast(
      '✨ Nouvelle conversation créée.'
    );

  }

  catch (error) {

    console.error(
      '[new conversation]',
      error
    );

    showToast(
      'Impossible de créer la conversation.'
    );

  }

}


/* =========================================================
   SUPPRESSION
   ========================================================= */

async function deleteConversation(id) {

  const conversation =
    state.conversations.find(
      c => c.id === id
    );


  const name =
    conversation?.title ||
    'cette conversation';


  const confirmed =
    window.confirm(
      `Voulez-vous vraiment supprimer "${name}" ?`
    );


  if (!confirmed) return;


  try {

    const result =
      await api(
        '/deleteConversation',
        {

          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            conversationId: id
          })

        }
      );


    state.conversations =
      result.conversations || [];


    if (
      state.currentConversationId === id
    ) {

      state.currentConversationId =
        state.conversations[0]?.id ||
        null;


      if (
        state.currentConversationId
      ) {

        openConversation(
          state.currentConversationId
        );

      }

      else {

        renderMessages([]);

      }

    }


    renderConversationList();


    showToast(
      '🗑️ Conversation supprimée.'
    );

  }

  catch (error) {

    console.error(
      '[delete conversation]',
      error
    );

    showToast(
      'Impossible de supprimer la conversation.'
    );

  }

}


/* =========================================================
   RENOMMER
   ========================================================= */

async function renameConversation() {

  if (
    !state.currentConversationId
  ) {

    showToast(
      'Sélectionne une conversation.'
    );

    return;

  }


  const conversation =
    state.conversations.find(
      c =>
        c.id ===
        state.currentConversationId
    );


  const title =
    window.prompt(
      'Nouveau nom de la conversation :',
      conversation?.title ||
      'Conversation'
    );


  if (
    title === null ||
    !title.trim()
  ) return;


  try {

    const result =
      await api(
        '/renameConversation',
        {

          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({

            conversationId:
              state.currentConversationId,

            title:
              title.trim()

          })

        }
      );


    const index =
      state.conversations.findIndex(
        c =>
          c.id ===
          state.currentConversationId
      );


    if (index !== -1) {

      state.conversations[index] =
        result.conversation;

    }


    renderConversationList();


    showToast(
      '✏️ Conversation renommée.'
    );

  }

  catch (error) {

    console.error(
      '[rename]',
      error
    );

    showToast(
      'Impossible de renommer la conversation.'
    );

  }

}


/* =========================================================
   CHAT
   ========================================================= */

async function sendMessage(text) {

  const message =
    String(text || '').trim();


  if (!message) return;


  if (state.sending) return;


  state.sending = true;


  const prompt =
    $('prompt');

  if (prompt) {

    prompt.value = '';

  }


  addMessageToUI(
    'user',
    message
  );


  try {

    const mode =
      $('mode')?.value ||
      'Kids';


    const result =
      await api('/chat', {

        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({

          message,

          mode

        })

      });


    addMessageToUI(
      'assistant',
      result.reply || ''
    );


    /*
       C'est LA SEULE valeur utilisée
       pour mettre à jour l'ÉcoGuacate.
    */

    if (
      typeof result.consumptionLitres ===
      'number'
    ) {

      updateEcoGuacate(
        result.consumptionLitres
      );

    }


    await loadConversations();

  }

  catch (error) {

    console.error(
      '[chat]',
      error
    );


    if (
      error.status === 403 &&
      error.data?.error === 'auto-banned'
    ) {

      showToast(
        '⚠️ Avertissement : langage interdit détecté.'
      );

    }

    else if (
      error.status === 403 &&
      error.data?.error === 'banned'
    ) {

      showToast(
        '🚫 Ton compte est temporairement suspendu.'
      );

    }

    else {

      addMessageToUI(
        'assistant',
        '🥑 Désolé, je n’ai pas réussi à répondre.'
      );

    }

  }

  finally {

    state.sending = false;

  }

}


/* =========================================================
   MODE PROFESSEUR / ADMIN
   ========================================================= */

async function verifyMode(mode) {

  const password =
    window.prompt(
      `Mot de passe ${mode} :`
    );


  if (password === null) {

    return false;

  }


  try {

    const result =
      await api('/modes/verify', {

        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({

          mode,

          password

        })

      });


    state.role =
      result.role;


    localStorage.setItem(
      'aguacate_role',
      state.role
    );


    updateUserInterface();


    showToast(
      `🔓 Mode ${mode} activé.`
    );


    return true;

  }

  catch {

    showToast(
      '❌ Mot de passe incorrect.'
    );


    return false;

  }

}


/* =========================================================
   FICHIERS
   ========================================================= */

function openFilePicker() {

  const input =
    $('file-input');

  if (input) {

    input.click();

  }

}


async function handleFile(file) {

  if (!file) return;


  state.selectedFile =
    file;


  const preview =
    $('file-preview');


  if (preview) {

    preview.classList.remove(
      'hidden'
    );


    preview.innerHTML = `

      <div>
        📎
        <b>
          ${escapeHTML(file.name)}
        </b>

        <small>
          ${(file.size / 1024).toFixed(1)}
          Ko
        </small>
      </div>

      <button
        id="file-analyse-btn"
        type="button"
      >
        🤖 Analyser
      </button>

    `;


    $('file-analyse-btn')
      ?.addEventListener(
        'click',
        () => scanAndAsk(file)
      );

  }

}


async function scanAndAsk(file) {

  if (!file) return;


  const question =
    window.prompt(
      'Que veux-tu demander à Aguacate AI sur ce fichier ?',
      'Analyse ce fichier et résume les points importants.'
    );


  if (question === null) return;


  const form =
    new FormData();


  form.append(
    'file',
    file
  );


  form.append(
    'question',
    question
  );


  try {

    showToast(
      '📄 Lecture du fichier...'
    );


    const result =
      await api(
        '/scan-and-ask',
        {

          method: 'POST',

          body: form

        }
      );


    addMessageToUI(
      'user',
      `📎 ${file.name}\n${question}`
    );


    addMessageToUI(
      'assistant',
      result.reply || ''
    );


    if (
      result.consumptionLitres !==
      undefined
    ) {

      updateEcoGuacate(
        result.consumptionLitres
      );

    }


    const preview =
      $('file-preview');


    if (preview) {

      preview.classList.add(
        'hidden'
      );

      preview.innerHTML = '';

    }


    state.selectedFile =
      null;


    showToast(
      '✅ Fichier analysé.'
    );

  }

  catch (error) {

    console.error(
      '[scan]',
      error
    );


    showToast(
      '❌ Impossible d’analyser ce fichier.'
    );

  }

}


/* =========================================================
   THÈME
   ========================================================= */

function toggleTheme() {

  document.body.classList.toggle(
    'dark'
  );


  localStorage.setItem(
    'aguacate_dark',
    document.body.classList.contains(
      'dark'
    )
  );

}


/* =========================================================
   INITIALISATION
   ========================================================= */

function setupEvents() {

  $('send-btn')
    ?.addEventListener(
      'click',
      () => {

        sendMessage(
          $('prompt')?.value
        );

      }
    );


  $('prompt')
    ?.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Enter' &&
          !event.shiftKey
        ) {

          event.preventDefault();

          sendMessage(
            event.target.value
          );

        }

      }
    );


  document
    .querySelectorAll(
      '[data-prompt]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const prompt =
            $('prompt');

          if (prompt) {

            prompt.value =
              button.dataset.prompt;

            prompt.focus();

          }

        }
      );

    });


  $('new-chat-btn')
    ?.addEventListener(
      'click',
      newConversation
    );


  $('rename-btn')
    ?.addEventListener(
      'click',
      renameConversation
    );


  $('attach-btn')
    ?.addEventListener(
      'click',
      openFilePicker
    );


  $('file-tool-btn')
    ?.addEventListener(
      'click',
      openFilePicker
    );


  $('file-input')
    ?.addEventListener(
      'change',
      event => {

        handleFile(
          event.target.files?.[0]
        );

      }
    );


  $('theme-btn')
    ?.addEventListener(
      'click',
      toggleTheme
    );


  $('mode')
    ?.addEventListener(
      'change',
      async event => {

        const mode =
          event.target.value;


        if (
          mode === 'Professeur' ||
          mode === 'Admin'
        ) {

          const success =
            await verifyMode(
              mode
            );


          if (!success) {

            event.target.value =
              state.role === 'admin'
                ? 'Admin'
                : state.role === 'professeur'
                  ? 'Professeur'
                  : 'Kids';

          }

        }

      }
    );


  if (
    localStorage.getItem(
      'aguacate_dark'
    ) === 'true'
  ) {

    document.body.classList.add(
      'dark'
    );

  }

}


/* =========================================================
   DÉMARRAGE
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    setupEvents();

    /*
       Valeur initiale unique.
    */

    updateEcoGuacate(0);


    await login();

  }
);


/* =========================================================
   EXPORT GLOBAL
   ========================================================= */

window.AguacateState =
  state;

window.updateEcoGuacate =
  updateEcoGuacate;

window.sendMessage =
  sendMessage;

window.newConversation =
  newConversation;

window.deleteConversation =
  deleteConversation;

window.renameConversation =
  renameConversation;

})();
