/* =========================================================
   AGUACATE AI v4.0.0
   APP.JS — VERSION COMPLÈTE
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

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }


  /* =========================================================
     API
     ========================================================= */

  async function api(url, options = {}) {

    const headers = {
      ...(options.headers || {})
    };

    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
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
   THÈME
   ========================================================= */

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');

  localStorage.setItem(
    'aguacate_dark',
    isDark ? 'true' : 'false'
  );
}


/* =========================================================
   THÈME AU DÉMARRAGE
   ========================================================= */

function loadTheme() {

  const savedTheme =
    localStorage.getItem('aguacate_dark');

  /*
    Première utilisation :
    Aguacate AI démarre automatiquement
    en thème sombre.
  */
  if (savedTheme === null) {

    document.body.classList.add('dark');

    localStorage.setItem(
      'aguacate_dark',
      'true'
    );

    return;
  }

  /*
    Si l'utilisateur avait choisi
    le thème sombre précédemment.
  */
  if (savedTheme === 'true') {

    document.body.classList.add('dark');

  } else {

    document.body.classList.remove('dark');
  }
}
      /* =====================================================
         VARIABLES
         ===================================================== */

      :root {
        --agu-bg: #f5f7f6;
        --agu-panel: #ffffff;
        --agu-panel-2: #f0f3f1;
        --agu-border: rgba(0,0,0,.09);
        --agu-text: #15231d;
        --agu-text-soft: #607069;
        --agu-input: #ffffff;
        --agu-shadow: 0 12px 35px rgba(0,0,0,.08);
      }

      html,
      body {
        transition:
          background-color .3s ease,
          color .3s ease;
      }


      /* =====================================================
         MODE CLAIR
         ===================================================== */

      body:not(.dark) {
        background-color: var(--agu-bg);
        color: var(--agu-text);
      }


      /* =====================================================
         MODE SOMBRE
         ===================================================== */

      body.dark {
        --agu-bg: #172923;
        --agu-panel: #243932;
        --agu-panel-2: #2d423a;
        --agu-border: rgba(255,255,255,.09);
        --agu-text: #edf7f2;
        --agu-text-soft: #a9bbb4;
        --agu-input: #f7faf8;
        --agu-shadow: 0 15px 45px rgba(0,0,0,.25);

        background-color: #172923;
        color: #edf7f2;
      }


      /* =====================================================
         TRANSITIONS GÉNÉRALES
         ===================================================== */

      body,
      body *,
      body *::before,
      body *::after {
        transition:
          background-color .25s ease,
          border-color .25s ease,
          color .25s ease,
          box-shadow .25s ease;
      }


      /* =====================================================
         CARTES / PANNEAUX
         ===================================================== */

      body:not(.dark) .sidebar,
      body:not(.dark) .left-panel,
      body:not(.dark) .right-panel,
      body:not(.dark) .eco-panel {
        background: #ffffff;
      }

      body.dark .sidebar,
      body.dark .left-panel,
      body.dark .right-panel,
      body.dark .eco-panel {
        background: #243932;
      }


      /* =====================================================
         TEXTES
         ===================================================== */

      body.dark h1,
      body.dark h2,
      body.dark h3,
      body.dark h4,
      body.dark p,
      body.dark span,
      body.dark label {
        color: inherit;
      }


      /* =====================================================
         ZONE CENTRALE
         ===================================================== */

      body:not(.dark) #messages,
      body:not(.dark) .chat,
      body:not(.dark) .chat-container {
        color: #15231d;
      }

      body.dark #messages,
      body.dark .chat,
      body.dark .chat-container {
        color: #edf7f2;
      }


      /* =====================================================
         INPUT
         ===================================================== */

      body:not(.dark) #prompt {
        background: #ffffff;
        color: #15231d;
        border-color: rgba(0,0,0,.1);
      }

      body.dark #prompt {
        background: #ffffff;
        color: #15231d;
        border-color: rgba(255,255,255,.15);
      }

      #prompt::placeholder {
        opacity: .55;
      }


      /* =====================================================
         CONVERSATIONS
         ===================================================== */

      body.dark .conversation-item {
        color: #edf7f2;
      }

      body.dark .conversation-open {
        color: #edf7f2;
      }

      body.dark .conversation-item:hover {
        background: rgba(255,255,255,.06);
      }

      body:not(.dark) .conversation-item:hover {
        background: rgba(34,197,94,.08);
      }


      /* =====================================================
         BOUTONS
         ===================================================== */

      body.dark button {
        color: inherit;
      }

      body.dark #theme-btn {
        background: rgba(255,255,255,.08);
        border-color: rgba(255,255,255,.1);
      }

      body:not(.dark) #theme-btn {
        background: rgba(0,0,0,.04);
        border-color: rgba(0,0,0,.08);
      }


      /* =====================================================
         SUGGESTIONS
         ===================================================== */

      body.dark [data-prompt] {
        background: rgba(255,255,255,.045);
        border-color: rgba(255,255,255,.08);
        color: #edf7f2;
      }

      body:not(.dark) [data-prompt] {
        background: #ffffff;
        border-color: rgba(0,0,0,.08);
        color: #15231d;
      }


      /* =====================================================
         MESSAGES IA
         ===================================================== */

      body.dark #messages .message.assistant .message-bubble {
        background: rgba(255,255,255,.055);
        border-color: rgba(255,255,255,.09);
        color: #edf7f2;
      }

      body:not(.dark) #messages .message.assistant .message-bubble {
        background: #f0f3f1;
        border-color: rgba(0,0,0,.08);
        color: #15231d;
      }


      /* =====================================================
         AVATAR
         ===================================================== */

      .aguacate-message-avatar {
        flex-shrink: 0;
      }


      /* =====================================================
         TRANSITION DU THÈME
         ===================================================== */

      body.theme-changing {
        pointer-events: none;
      }

      body.theme-changing::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 99999;
        background: rgba(34,197,94,.04);
        animation: aguacateThemeFlash .35s ease;
      }

      @keyframes aguacateThemeFlash {
        from {
          opacity: 0;
        }

        50% {
          opacity: 1;
        }

        to {
          opacity: 0;
        }
      }

    `;

    document.head.appendChild(style);
  }


  /* =========================================================
     APPLICATION DU THÈME
     ========================================================= */

  function applyTheme(theme, save = true) {

    const isDark = theme === 'dark';

    document.body.classList.toggle(
      'dark',
      isDark
    );

    document.documentElement.classList.toggle(
      'dark',
      isDark
    );

    document.documentElement.dataset.theme =
      isDark ? 'dark' : 'light';

    if (save) {

      localStorage.setItem(
        'aguacate_theme',
        isDark ? 'dark' : 'light'
      );

      /* Compatibilité avec l'ancien système */
      localStorage.setItem(
        'aguacate_dark',
        String(isDark)
      );
    }

    updateThemeButton(isDark);
  }


  /* =========================================================
     BOUTON THÈME
     ========================================================= */

  function updateThemeButton(isDark) {

    const button = $('theme-btn');

    if (!button) return;

    button.textContent =
      isDark ? '☀️' : '🌙';

    button.title =
      isDark
        ? 'Passer au mode clair'
        : 'Passer au mode sombre';

    button.setAttribute(
      'aria-label',
      isDark
        ? 'Passer au mode clair'
        : 'Passer au mode sombre'
    );
  }


  function loadSavedTheme() {

    let savedTheme =
      localStorage.getItem(
        'aguacate_theme'
      );

    /* Compatibilité avec ancienne version */
    if (!savedTheme) {

      const oldDark =
        localStorage.getItem(
          'aguacate_dark'
        );

      if (oldDark !== null) {

        savedTheme =
          oldDark === 'true'
            ? 'dark'
            : 'light';
      }
    }

    /*
      Si aucun thème n'est enregistré,
      on utilise le thème clair.
    */

    if (
      savedTheme !== 'dark' &&
      savedTheme !== 'light'
    ) {

      savedTheme = 'light';
    }

    applyTheme(
      savedTheme,
      false
    );
  }


  function toggleTheme() {

    const isDark =
      document.body.classList.contains(
        'dark'
      );

    const newTheme =
      isDark
        ? 'light'
        : 'dark';

    document.body.classList.add(
      'theme-changing'
    );

    applyTheme(
      newTheme,
      true
    );

    setTimeout(() => {

      document.body.classList.remove(
        'theme-changing'
      );

    }, 350);

    showToast(
      newTheme === 'dark'
        ? '🌙 Mode sombre activé.'
        : '☀️ Mode clair activé.'
    );
  }


  /* =========================================================
     STYLE DES MESSAGES
     ========================================================= */

  function installChatStyles() {

    if ($('aguacate-chat-styles')) return;

    const style = document.createElement('style');

    style.id = 'aguacate-chat-styles';

    style.textContent = `

      #messages {
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
        box-sizing: border-box;
        overflow-y: auto;
        scroll-behavior: smooth;
      }

      #messages .message {
        display: flex;
        width: 100%;
        box-sizing: border-box;
        align-items: flex-end;
        gap: 9px;
        animation: aguacateMessageIn .25s ease-out;
      }

      #messages .message.assistant {
        justify-content: flex-start;
      }

      #messages .message.user {
        justify-content: flex-end;
      }

      .aguacate-message-avatar {
        width: 34px;
        height: 34px;
        min-width: 34px;
        border-radius: 11px;

        display: flex;
        align-items: center;
        justify-content: center;

        background:
          linear-gradient(
            145deg,
            rgba(34,197,94,.25),
            rgba(16,185,129,.10)
          );

        border: 1px solid rgba(74,222,128,.22);

        box-shadow:
          0 5px 15px rgba(0,0,0,.15);

        font-size: 18px;
      }

      #messages .message-bubble {
        max-width: min(78%, 720px);
        padding: 11px 15px;
        border-radius: 17px;
        line-height: 1.55;
        font-size: 14px;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        box-sizing: border-box;
      }

      #messages .message.assistant .message-bubble {
        background: rgba(255,255,255,.055);
        border: 1px solid rgba(255,255,255,.09);
        border-bottom-left-radius: 5px;
      }

      #messages .message.user .message-bubble {
        background:
          linear-gradient(
            135deg,
            #22c55e,
            #10b981
          );

        color: #06251a;

        border: 1px solid rgba(255,255,255,.14);

        border-bottom-right-radius: 5px;

        font-weight: 500;

        box-shadow:
          0 7px 20px
          rgba(16,185,129,.16);
      }

      @keyframes aguacateMessageIn {

        from {
          opacity: 0;
          transform:
            translateY(7px)
            scale(.98);
        }

        to {
          opacity: 1;
          transform:
            translateY(0)
            scale(1);
        }
      }

      .aguacate-thinking {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .aguacate-thinking-bubble {
        min-width: 64px;
        padding: 12px 15px !important;

        display: flex;
        align-items: center;
        justify-content: center;

        gap: 4px;
      }

      .aguacate-thinking-bubble span {
        width: 7px;
        height: 7px;

        border-radius: 50%;

        background: #4ade80;

        display: block;

        animation:
          aguacateThinking
          1.2s
          infinite
          ease-in-out;
      }

      .aguacate-thinking-bubble span:nth-child(2) {
        animation-delay: .15s;
      }

      .aguacate-thinking-bubble span:nth-child(3) {
        animation-delay: .30s;
      }

      @keyframes aguacateThinking {

        0%,
        60%,
        100% {
          transform: translateY(0);
          opacity: .35;
        }

        30% {
          transform: translateY(-4px);
          opacity: 1;
        }
      }

      @media (max-width: 700px) {

        #messages .message-bubble {
          max-width: 86%;
        }

      }

    `;

    document.head.appendChild(style);
  }


  /* =========================================================
     ÉCOGUACATE
     ========================================================= */

  const ECO_MAX = 100;


  function getEcoState(litres) {

    const value = Math.max(
      0,
      Number(litres) || 0
    );

    const percentage = Math.min(
      ECO_MAX,
      value
    );

    let level;
    let color;
    let status;

    if (value <= 20) {

      level = 'good';
      color = '#22c55e';
      status = 'Excellent 🌿';

    } else if (value <= 50) {

      level = 'warning';
      color = '#eab308';
      status = 'Attention 🌱';

    } else if (value <= 85) {

      level = 'danger';
      color = '#f97316';
      status = 'Impact élevé 🍂';

    } else {

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

    const eco =
      getEcoState(litres);

    state.consumptionLitres =
      eco.litres;


    const litresElement =
      $('eco-litres');

    if (litresElement) {

      litresElement.textContent =
        eco.litres
          .toFixed(1)
          .replace('.', ',');
    }


    const percentElement =
      $('eco-pct');

    if (percentElement) {

      percentElement.textContent =
        `${Math.round(eco.percentage)}%`;

      percentElement.style.color =
        eco.color;
    }


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


    const marker =
      $('eco-marker');

    if (marker) {

      marker.style.left =
        `${eco.percentage}%`;

      marker.style.borderColor =
        eco.color;
    }


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

      } else if (eco.litres <= 50) {

        tree.classList.add(
          'tree-warning'
        );

      } else if (eco.litres <= 85) {

        tree.classList.add(
          'tree-danger'
        );

      } else if (eco.litres < 100) {

        tree.classList.add(
          'tree-dry'
        );

      } else {

        tree.classList.add(
          'tree-dead'
        );
      }
    }


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

      pump.classList.toggle(
        'dry',
        eco.percentage >= 100
      );
    }


    const glow =
      $('eco-glow') ||
      document.querySelector(
        '.avocado-glow'
      );

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
        await api(
          '/login',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                deviceId
              })
          }
        );


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


      if (
        result.consumptionLitres !==
        undefined
      ) {

        updateEcoGuacate(
          Number(
            result.consumptionLitres
          )
        );
      }


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
              ).toLocaleString(
                'fr-FR'
              )
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
        `🥑 Aguacate AI #${
          state.userId || '0000'
        }`;
    }


    const role =
      $('role-badge');

    if (role) {

      const labels = {

        admin:
          'ADMINISTRATEUR',

        professeur:
          'PROFESSEUR',

        user:
          'UTILISATEUR'
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
      setInterval(
        async () => {

          if (!state.token)
            return;


          try {

            await api(
              '/heartbeat'
            );

          }

          catch (error) {

            console.warn(
              '[heartbeat]',
              error
            );
          }

        },
        30000
      );
  }


  /* =========================================================
     CONVERSATIONS
     ========================================================= */

  async function loadConversations() {

    try {

      const result =
        await api(
          '/conversations'
        );


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


    state.conversations.forEach(
      conversation => {

        const item =
          document.createElement(
            'div'
          );

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
          ?.addEventListener(
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
          ?.addEventListener(
            'click',
            event => {

              event.stopPropagation();

              deleteConversation(
                conversation.id
              );
            }
          );


        list.appendChild(item);
      }
    );
  }


  function openConversation(id) {

    const conversation =
      state.conversations.find(
        c => c.id === id
      );

    if (!conversation)
      return;


    state.currentConversationId =
      id;


    renderConversationList();


    renderMessages(
      conversation.messages || []
    );
  }


  /* =========================================================
     MESSAGES
     ========================================================= */

  function renderMessages(messages) {

    const container =
      $('messages');

    if (!container)
      return;


    container.innerHTML = '';


    messages.forEach(
      message => {

        addMessageToUI(
          message.role,
          message.content,
          false
        );
      }
    );


    scrollMessages();
  }


  function addMessageToUI(
    role,
    content,
    scroll = true
  ) {

    const container =
      $('messages');

    if (!container)
      return null;


    const message =
      document.createElement(
        'div'
      );


    const normalizedRole =
      role === 'assistant'
        ? 'assistant'
        : 'user';


    message.className =
      `message ${normalizedRole}`;


    const safeContent =
      escapeHTML(
        content
      ).replace(
        /\n/g,
        '<br>'
      );


    if (
      normalizedRole ===
      'assistant'
    ) {

      message.innerHTML = `

        <div
          class="aguacate-message-avatar"
          aria-hidden="true"
        >
          🥑
        </div>

        <div
          class="message-bubble"
        >
          ${safeContent}
        </div>

      `;

    } else {

      message.innerHTML = `

        <div
          class="message-bubble"
        >
          ${safeContent}
        </div>

      `;
    }


    container.appendChild(
      message
    );


    if (scroll) {

      scrollMessages();
    }


    return message;
  }


  /* =========================================================
     AGUACATE RÉFLÉCHIT
     ========================================================= */

  function showThinking() {

    const container =
      $('messages');

    if (!container)
      return null;


    const old =
      $('aguacate-thinking');

    if (old)
      old.remove();


    const message =
      document.createElement(
        'div'
      );


    message.id =
      'aguacate-thinking';

    message.className =
      'message assistant aguacate-thinking';


    message.innerHTML = `

      <div
        class="aguacate-message-avatar"
        aria-hidden="true"
      >
        🥑
      </div>

      <div
        class="message-bubble aguacate-thinking-bubble"
        aria-label="Aguacate AI réfléchit"
      >

        <span></span>
        <span></span>
        <span></span>

      </div>

    `;


    container.appendChild(
      message
    );


    scrollMessages();


    return message;
  }


  function hideThinking() {

    const thinking =
      $('aguacate-thinking');

    if (thinking) {

      thinking.remove();
    }
  }


  function scrollMessages() {

    const container =
      $('messages');

    if (!container)
      return;


    requestAnimationFrame(
      () => {

        container.scrollTop =
          container.scrollHeight;
      }
    );
  }


  /* =========================================================
     NOUVELLE CONVERSATION
     ========================================================= */

  async function newConversation() {

    try {

      const result =
        await api(
          '/newConversation',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: '{}'
          }
        );


      state.conversations =
        result.conversations ||
        [];


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


    if (
      !window.confirm(
        `Voulez-vous vraiment supprimer "${name}" ?`
      )
    ) {
      return;
    }


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

            body:
              JSON.stringify({
                conversationId: id
              })
          }
        );


      state.conversations =
        result.conversations ||
        [];


      if (
        state.currentConversationId ===
        id
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

        } else {

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
    ) {
      return;
    }


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

            body:
              JSON.stringify({
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


    if (!message)
      return;


    if (state.sending)
      return;


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


    showThinking();


    const thinkingStart =
      Date.now();


    try {

      const mode =
        $('mode')?.value ||
        'Kids';


      const result =
        await api(
          '/chat',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                message,
                mode
              })
          }
        );


      const elapsed =
        Date.now() -
        thinkingStart;


      const minimumThinkingTime =
        500;


      if (
        elapsed <
        minimumThinkingTime
      ) {

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              minimumThinkingTime -
              elapsed
            )
        );
      }


      hideThinking();


      addMessageToUI(
        'assistant',
        result.reply ||
        'Je n’ai pas reçu de réponse.'
      );


      if (
        result.consumptionLitres !==
        undefined
      ) {

        const litres =
          Number(
            result.consumptionLitres
          );


        if (
          Number.isFinite(litres)
        ) {

          updateEcoGuacate(
            litres
          );
        }
      }


      await loadConversations();

    }

    catch (error) {

      console.error(
        '[chat]',
        error
      );


      hideThinking();


      if (
        error.status === 403 &&
        error.data?.error ===
          'auto-banned'
      ) {

        showToast(
          error.data?.message ||
          '⚠️ Langage interdit détecté.'
        );

      }

      else if (
        error.status === 403 &&
        error.data?.error ===
          'banned'
      ) {

        const until =
          error.data.bannedUntil
            ? new Date(
                error.data.bannedUntil
              ).toLocaleString(
                'fr-FR'
              )
            : 'plus tard';


        showToast(
          `🚫 Compte suspendu jusqu'au ${until}`
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

      hideThinking();

      state.sending =
        false;
    }
  }


  /* =========================================================
     MODES PROFESSEUR / ADMIN
     ========================================================= */

  async function verifyMode(mode) {

    const password =
      window.prompt(
        `Mot de passe ${mode} :`
      );


    if (password === null)
      return false;


    try {

      const result =
        await api(
          '/modes/verify',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                mode,
                password
              })
          }
        );


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

    catch (error) {

      console.error(
        '[mode]',
        error
      );

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

    if (!file)
      return;


    state.selectedFile =
      file;


    const preview =
      $('file-preview');


    if (!preview)
      return;


    preview.classList.remove(
      'hidden'
    );


    preview.innerHTML = `

      <div>

        📎

        <b>
          ${escapeHTML(
            file.name
          )}
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


  async function scanAndAsk(file) {

    if (!file)
      return;


    const question =
      window.prompt(
        'Que veux-tu demander à Aguacate AI sur ce fichier ?',
        'Analyse ce fichier et résume les points importants.'
      );


    if (question === null)
      return;


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


      showThinking();


      const result =
        await api(
          '/scan-and-ask',
          {
            method: 'POST',
            body: form
          }
        );


      hideThinking();


      addMessageToUI(
        'user',
        `📎 ${file.name}\n${question}`
      );


      addMessageToUI(
        'assistant',
        result.reply ||
        'Aucune réponse.'
      );


      if (
        result.consumptionLitres !==
        undefined
      ) {

        const litres =
          Number(
            result.consumptionLitres
          );


        if (
          Number.isFinite(litres)
        ) {

          updateEcoGuacate(
            litres
          );
        }
      }


      await loadConversations();


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

      hideThinking();


      console.error(
        '[scan]',
        error
      );


      if (
        error.status === 403 &&
        error.data?.error ===
          'banned'
      ) {

        showToast(
          '🚫 Ton compte est temporairement suspendu.'
        );

      }

      else {

        showToast(
          '❌ Impossible d’analyser ce fichier.'
        );
      }
    }
  }


  /* =========================================================
     ÉVÉNEMENTS
     ========================================================= */

  function setupEvents() {

    installThemeStyles();
    installChatStyles();


    /* -------------------------------------------------------
       THÈME
       ------------------------------------------------------- */

    $('theme-btn')
      ?.addEventListener(
        'click',
        toggleTheme
      );


    /* -------------------------------------------------------
       ENVOI
       ------------------------------------------------------- */

    $('send-btn')
      ?.addEventListener(
        'click',
        () => {

          sendMessage(
            $('prompt')?.value
          );
        }
      );


    /* -------------------------------------------------------
       ENTRÉE
       ------------------------------------------------------- */

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


    /* -------------------------------------------------------
       SUGGESTIONS
       ------------------------------------------------------- */

    document
      .querySelectorAll(
        '[data-prompt]'
      )
      .forEach(
        button => {

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
        }
      );


    /* -------------------------------------------------------
       NOUVELLE CONVERSATION
       ------------------------------------------------------- */

    $('new-chat-btn')
      ?.addEventListener(
        'click',
        newConversation
      );


    /* -------------------------------------------------------
       RENOMMER
       ------------------------------------------------------- */

    $('rename-btn')
      ?.addEventListener(
        'click',
        renameConversation
      );


    /* -------------------------------------------------------
       FICHIERS
       ------------------------------------------------------- */

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


    /* -------------------------------------------------------
       MODES
       ------------------------------------------------------- */

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
  }


  /* =========================================================
     DÉMARRAGE
     ========================================================= */

  document.addEventListener(
    'DOMContentLoaded',
    async () => {

      /*
        On installe le thème AVANT le login.
        Cela évite un flash visuel.
      */

      installThemeStyles();

      loadSavedTheme();

      setupEvents();


      /*
        Valeur visuelle initiale.
        Elle sera remplacée par le serveur.
      */

      updateEcoGuacate(0);


      /*
        Connexion serveur.
      */

      await login();
    }
  );


  /* =========================================================
     EXPORTS
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

  window.showThinking =
    showThinking;

  window.hideThinking =
    hideThinking;

  window.toggleTheme =
    toggleTheme;

  window.applyTheme =
    applyTheme;

})();
