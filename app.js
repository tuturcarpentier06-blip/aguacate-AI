/* =========================================================
   AGUACATE AI v4.0.0
   APP.JS — FRONTEND COMPLET
   ========================================================= */

(() => {

  'use strict';


  /* =========================================================
     ÉTAT CENTRAL
     ========================================================= */

  const state = {

    token:
      localStorage.getItem(
        'aguacate_token'
      ) || '',

    userId:
      localStorage.getItem(
        'aguacate_user_id'
      ) || '',

    role:
      localStorage.getItem(
        'aguacate_role'
      ) || 'user',

    consumptionLitres:
      0,

    conversations:
      [],

    currentConversationId:
      null,

    selectedFile:
      null,

    sending:
      false
  };


  /* =========================================================
     UTILITAIRES
     ========================================================= */

  const $ =
    id =>
      document.getElementById(id);


  function escapeHTML(value) {

    return String(
      value ?? ''
    )

      .replace(
        /&/g,
        '&amp;'
      )

      .replace(
        /</g,
        '&lt;'
      )

      .replace(
        />/g,
        '&gt;'
      )

      .replace(
        /"/g,
        '&quot;'
      )

      .replace(
        /'/g,
        '&#039;'
      );
  }


  function showToast(
    message
  ) {

    const toast =
      $('toast');

    if (!toast)
      return;

    toast.textContent =
      message;

    toast.classList.add(
      'show'
    );

    clearTimeout(
      showToast.timer
    );

    showToast.timer =
      setTimeout(
        () => {

          toast.classList.remove(
            'show'
          );

        },
        3000
      );
  }


  /* =========================================================
     API
     ========================================================= */

  async function api(
    url,
    options = {}
  ) {

    const headers = {

      ...(options.headers || {})
    };


    if (state.token) {

      headers.Authorization =
        `Bearer ${state.token}`;
    }


    const response =
      await fetch(
        url,
        {
          ...options,
          headers
        }
      );


    let data = {};


    try {

      data =
        await response.json();

    } catch {

      data = {};
    }


    if (!response.ok) {

      const error =
        new Error(

          data.message ||
          data.error ||
          `Erreur HTTP ${response.status}`
        );

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }


    return data;
  }


  /* =========================================================
     STYLES CHAT + CONVERSATIONS
     =========================================================

     IMPORTANT :
     La poubelle est corrigée ici.

     - taille raisonnable
     - toujours visible
     - pas de texte qui déborde
     - pas de "..."
     - flex-shrink: 0
  */

  function installChatStyles() {

    if (
      $('aguacate-chat-styles')
    ) {

      return;
    }


    const style =
      document.createElement(
        'style'
      );


    style.id =
      'aguacate-chat-styles';


    style.textContent = `

      /* ================================
         CONVERSATIONS
         ================================ */

      #conversation-list {
        width: 100%;
        box-sizing: border-box;
      }


      .conversation-item {
        width: 100%;
        min-width: 0;

        display: flex;
        align-items: center;

        gap: 6px;

        box-sizing: border-box;

        margin-bottom: 6px;
      }


      .conversation-open {
        flex: 1 1 auto;
        min-width: 0;

        height: 42px;

        display: flex;
        align-items: center;

        gap: 8px;

        padding: 0 10px;

        border: 0;
        border-radius: 9px;

        cursor: pointer;

        overflow: hidden;

        text-align: left;

        white-space: nowrap;
      }


      .conversation-open span {
        min-width: 0;

        flex: 1;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;
      }


      /*
        LA POUBELLE.

        Elle reste petite et visible.
      */

      .conversation-delete {
        flex: 0 0 38px;

        width: 38px;
        min-width: 38px;
        max-width: 38px;

        height: 38px;
        min-height: 38px;
        max-height: 38px;

        display: flex;

        align-items: center;
        justify-content: center;

        padding: 0;

        margin: 0;

        border: 1px solid rgba(
          255,
          255,
          255,
          .10
        );

        border-radius: 9px;

        background: rgba(
          255,
          255,
          255,
          .045
        );

        color: inherit;

        font-size: 15px;

        line-height: 1;

        cursor: pointer;

        opacity: .85;

        overflow: visible;

        box-sizing: border-box;
      }


      .conversation-delete:hover {

        opacity: 1;

        background:
          rgba(
            239,
            68,
            68,
            .15
          );

        border-color:
          rgba(
            239,
            68,
            68,
            .35
          );

        transform:
          translateY(-1px);
      }


      .conversation-delete:active {

        transform:
          scale(.94);
      }


      .conversation-item.active
      .conversation-open {

        background:
          rgba(
            34,
            197,
            94,
            .12
          );
      }


      /* ================================
         MESSAGES
         ================================ */

      #messages {

        display: flex;

        flex-direction:
          column;

        gap: 14px;

        width: 100%;

        box-sizing:
          border-box;

        overflow-y:
          auto;

        scroll-behavior:
          smooth;
      }


      #messages .message {

        display: flex;

        width: 100%;

        box-sizing:
          border-box;

        align-items:
          flex-end;

        gap: 9px;

        animation:
          aguacateMessageIn
          .25s
          ease-out;
      }


      #messages
      .message.assistant {

        justify-content:
          flex-start;
      }


      #messages
      .message.user {

        justify-content:
          flex-end;
      }


      .aguacate-message-avatar {

        width: 34px;
        height: 34px;

        min-width: 34px;

        border-radius: 11px;

        display: flex;

        align-items:
          center;

        justify-content:
          center;

        background:
          linear-gradient(
            145deg,
            rgba(
              34,
              197,
              94,
              .25
            ),
            rgba(
              16,
              185,
              129,
              .10
            )
          );

        border:
          1px solid
          rgba(
            74,
            222,
            128,
            .22
          );

        box-shadow:
          0 5px 15px
          rgba(
            0,
            0,
            0,
            .15
          );

        font-size: 18px;
      }


      #messages
      .message-bubble {

        max-width:
          min(
            78%,
            720px
          );

        padding:
          11px 15px;

        border-radius:
          17px;

        line-height:
          1.55;

        font-size:
          14px;

        word-wrap:
          break-word;

        overflow-wrap:
          anywhere;

        box-sizing:
          border-box;
      }


      #messages
      .message.assistant
      .message-bubble {

        background:
          rgba(
            255,
            255,
            255,
            .055
          );

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .09
          );

        border-bottom-left-radius:
          5px;
      }


      #messages
      .message.user
      .message-bubble {

        background:
          linear-gradient(
            135deg,
            #22c55e,
            #10b981
          );

        color:
          #06251a;

        border:
          1px solid
          rgba(
            255,
            255,
            255,
            .14
          );

        border-bottom-right-radius:
          5px;

        font-weight:
          500;

        box-shadow:
          0 7px 20px
          rgba(
            16,
            185,
            129,
            .16
          );
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


      /* ================================
         RÉFLEXION
         ================================ */

      .aguacate-thinking {

        display: flex;

        align-items:
          center;

        gap: 9px;
      }


      .aguacate-thinking-bubble {

        min-width:
          64px;

        padding:
          12px 15px !important;

        display: flex;

        align-items:
          center;

        justify-content:
          center;

        gap: 4px;
      }


      .aguacate-thinking-bubble span {

        width: 7px;
        height: 7px;

        border-radius:
          50%;

        background:
          #4ade80;

        display:
          block;

        animation:
          aguacateThinking
          1.2s
          infinite
          ease-in-out;
      }


      .aguacate-thinking-bubble
      span:nth-child(2) {

        animation-delay:
          .15s;
      }


      .aguacate-thinking-bubble
      span:nth-child(3) {

        animation-delay:
          .30s;
      }


      @keyframes aguacateThinking {

        0%,
        60%,
        100% {

          transform:
            translateY(0);

          opacity:
            .35;
        }

        30% {

          transform:
            translateY(-4px);

          opacity:
            1;
        }
      }


      @media (
        max-width: 700px
      ) {

        #messages
        .message-bubble {

          max-width:
            86%;
        }


        .conversation-delete {

          width:
            36px;

          min-width:
            36px;

          flex-basis:
            36px;
        }
      }

    `;


    document.head.appendChild(
      style
    );
  }


  /* =========================================================
     ÉCOGUACATE
     ========================================================= */

  const ECO_MAX =
    100;


  function getEcoState(
    litres
  ) {

    const value =
      Math.max(
        0,
        Number(litres) || 0
      );


    const percentage =
      Math.min(
        ECO_MAX,
        value
      );


    let level;
    let color;
    let status;


    if (
      value <= 20
    ) {

      level =
        'good';

      color =
        '#22c55e';

      status =
        'Excellent 🌿';

    } else if (
      value <= 50
    ) {

      level =
        'warning';

      color =
        '#eab308';

      status =
        'Attention 🌱';

    } else if (
      value <= 85
    ) {

      level =
        'danger';

      color =
        '#f97316';

      status =
        'Impact élevé 🍂';

    } else {

      level =
        'dead';

      color =
        '#ef4444';

      status =
        'Très forte consommation 🔴';
    }


    return {

      litres:
        value,

      percentage,

      level,

      color,

      status
    };
  }


  function updateEcoGuacate(
    litres
  ) {

    const eco =
      getEcoState(
        litres
      );


    state.consumptionLitres =
      eco.litres;


    /* COMPTEUR */

    const litresElement =
      $('eco-litres');


    if (
      litresElement
    ) {

      litresElement.textContent =
        eco.litres
          .toFixed(1)
          .replace(
            '.',
            ','
          );
    }


    /* POURCENTAGE */

    const percentElement =
      $('eco-pct');


    if (
      percentElement
    ) {

      percentElement.textContent =
        `${Math.round(
          eco.percentage
        )}%`;

      percentElement.style.color =
        eco.color;
    }


    /* BARRE */

    const bar =
      $('eco-bar-fill');


    if (
      bar
    ) {

      bar.style.width =
        `${eco.percentage}%`;

      bar.style.background =
        eco.color;

      bar.style.boxShadow =
        `0 0 10px ${eco.color}55`;
    }


    /* MARQUEUR */

    const marker =
      $('eco-marker');


    if (
      marker
    ) {

      marker.style.left =
        `${eco.percentage}%`;

      marker.style.borderColor =
        eco.color;
    }


    /* ARBRE */

    const tree =
      $('eco-tree');


    if (
      tree
    ) {

      tree.classList.remove(

        'tree-good',

        'tree-warning',

        'tree-danger',

        'tree-dry',

        'tree-dead'
      );


      if (
        eco.litres <= 20
      ) {

        tree.classList.add(
          'tree-good'
        );

      } else if (
        eco.litres <= 50
      ) {

        tree.classList.add(
          'tree-warning'
        );

      } else if (
        eco.litres <= 85
      ) {

        tree.classList.add(
          'tree-danger'
        );

      } else if (
        eco.litres < 100
      ) {

        tree.classList.add(
          'tree-dry'
        );

      } else {

        tree.classList.add(
          'tree-dead'
        );
      }
    }


    /* POMPE */

    const pump =
      $('eco-water-pump');

    const pumpWater =
      $('pump-water');


    if (
      pumpWater
    ) {

      const remaining =
        Math.max(
          0,
          1 -
            eco.percentage /
            100
        );


      pumpWater.style.height =
        `${remaining * 100}%`;
    }


    if (
      pump
    ) {

      pump.classList.toggle(
        'dry',
        eco.percentage >=
          100
      );
    }


    /* LUMIÈRE */

    const glow =
      $('eco-glow') ||
      document.querySelector(
        '.avocado-glow'
      );


    if (
      glow
    ) {

      glow.style.opacity =
        eco.level ===
        'dead'
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


    /* STATUT */

    const status =
      $('eco-status');


    if (
      status
    ) {

      status.textContent =
        eco.status;

      status.style.color =
        eco.color;
    }
  }


  /* =========================================================
     IDENTIFIANT APPAREIL
     ========================================================= */

  function ensureDeviceId() {

    let deviceId =
      localStorage.getItem(
        'aguacate_device_id'
      );


    /*
      Les anciens identifiants
      trop longs sont remplacés.
    */

    if (
      !deviceId ||
      !/^[A-Z0-9]{4}$/i.test(
        deviceId
      )
    ) {

      const chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

      deviceId = '';

      for (
        let i = 0;
        i < 4;
        i++
      ) {

        deviceId +=
          chars[
            Math.floor(
              Math.random() *
              chars.length
            )
          ];
      }

      localStorage.setItem(
        'aguacate_device_id',
        deviceId
      );
    }


    return deviceId
      .toUpperCase();
  }


  /* =========================================================
     CONNEXION
     ========================================================= */

  async function login() {

    try {

      const deviceId =
        ensureDeviceId();


      const result =
        await api(
          '/login',
          {

            method:
              'POST',

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
        result.role ||
        'user';


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

    } catch (
      error
    ) {

      console.error(
        '[login]',
        error
      );


      if (
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
          `🚫 Accès suspendu jusqu'au ${until}`
        );


        return;
      }


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


    if (
      badge
    ) {

      badge.textContent =
        `🥑 Aguacate #${
          state.userId ||
          'XXXX'
        }`;
    }


    const role =
      $('role-badge');


    if (
      role
    ) {

      const labels = {

        admin:
          'ADMINISTRATEUR',

        professeur:
          'PROFESSEUR',

        user:
          'UTILISATEUR'
      };


      role.textContent =
        labels[
          state.role
        ] ||
        'UTILISATEUR';


      role.className =
        `role-badge ${
          state.role
        }`;
    }
  }


  /* =========================================================
     HEARTBEAT
     ========================================================= */

  let heartbeatTimer =
    null;


  function startHeartbeat() {

    if (
      heartbeatTimer
    ) {

      clearInterval(
        heartbeatTimer
      );
    }


    heartbeatTimer =
      setInterval(
        async () => {

          if (
            !state.token
          )
            return;


          try {

            await api(
              '/heartbeat',
              {
                method:
                  'POST'
              }
            );

          } catch (
            error
          ) {

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
        Array.isArray(
          result
        )
          ? result
          : [];


      renderConversationList();


      if (
        state.currentConversationId
      ) {

        const stillExists =
          state.conversations
            .some(
              conversation =>
                conversation.id ===
                state.currentConversationId
            );


        if (
          stillExists
        ) {

          openConversation(
            state.currentConversationId
          );

          return;
        }
      }


      if (
        state.conversations.length
      ) {

        const latest =
          state.conversations
            .slice()
            .sort(
              (a, b) =>
                (
                  b.updatedAt ||
                  0
                ) -
                (
                  a.updatedAt ||
                  0
                )
            )[0];


        openConversation(
          latest.id
        );
      }

    } catch (
      error
    ) {

      console.error(
        '[conversations]',
        error
      );
    }
  }


  function renderConversationList() {

    const list =
      $('conversation-list');


    if (
      !list
    )
      return;


    list.innerHTML =
      '';


    state.conversations
      .slice()
      .sort(
        (a, b) =>
          (
            b.updatedAt ||
            0
          ) -
          (
            a.updatedAt ||
            0
          )
      )
      .forEach(
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


          /*
            Pas de "..."
            dans la poubelle.

            Le texte peut être tronqué,
            mais le bouton poubelle
            reste toujours à droite.
          */

          item.innerHTML = `

            <button
              class="conversation-open"
              type="button"
              title="${escapeHTML(
                conversation.title ||
                'Conversation'
              )}"
            >

              <span
                aria-hidden="true"
              >
                💬
              </span>

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
              title="Supprimer cette conversation"
              aria-label="Supprimer cette conversation"
            >
              🗑️
            </button>

          `;


          const openButton =
            item.querySelector(
              '.conversation-open'
            );


          const deleteButton =
            item.querySelector(
              '.conversation-delete'
            );


          openButton?.addEventListener(
            'click',
            () => {

              openConversation(
                conversation.id
              );
            }
          );


          deleteButton?.addEventListener(
            'click',
            event => {

              event.preventDefault();

              event.stopPropagation();

              deleteConversation(
                conversation.id
              );
            }
          );


          list.appendChild(
            item
          );
        }
      );
  }


  function openConversation(
    id
  ) {

    const conversation =
      state.conversations.find(
        item =>
          item.id === id
      );


    if (
      !conversation
    )
      return;


    state.currentConversationId =
      id;


    renderConversationList();


    renderMessages(
      conversation.messages ||
      []
    );
  }


  /* =========================================================
     MESSAGES
     ========================================================= */

  function renderMessages(
    messages
  ) {

    const container =
      $('messages');


    if (
      !container
    )
      return;


    container.innerHTML =
      '';


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


    if (
      !container
    )
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
      `message ${
        normalizedRole
      }`;


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


    if (
      scroll
    ) {

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


    if (
      !container
    )
      return null;


    const old =
      $('aguacate-thinking');


    if (
      old
    )
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


    if (
      thinking
    ) {

      thinking.remove();
    }
  }


  function scrollMessages() {

    const container =
      $('messages');


    if (
      !container
    )
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

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json'
            },

            body:
              '{}'
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

    } catch (
      error
    ) {

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

  async function deleteConversation(
    id
  ) {

    const conversation =
      state.conversations.find(
        item =>
          item.id === id
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

            method:
              'POST',

            headers: {

              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({

                conversationId:
                  id
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
          null;


        if (
          state.conversations.length
        ) {

          const next =
            state.conversations
              .slice()
              .sort(
                (a, b) =>
                  (
                    b.updatedAt ||
                    0
                  ) -
                  (
                    a.updatedAt ||
                    0
                  )
              )[0];


          openConversation(
            next.id
          );

        } else {

          renderMessages([]);
        }
      }


      renderConversationList();


      showToast(
        '🗑️ Conversation supprimée.'
      );

    } catch (
      error
    ) {

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
        item =>
          item.id ===
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

            method:
              'POST',

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
          item =>
            item.id ===
            state.currentConversationId
        );


      if (
        index !== -1
      ) {

        state.conversations[
          index
        ] =
          result.conversation;
      }


      renderConversationList();


      showToast(
        '✏️ Conversation renommée.'
      );

    } catch (
      error
    ) {

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

  async function sendMessage(
    text
  ) {

    const message =
      String(
        text || ''
      ).trim();


    if (
      !message ||
      state.sending
    ) {

      return;
    }


    state.sending =
      true;


    const prompt =
      $('prompt');


    if (
      prompt
    ) {

      prompt.value =
        '';
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

            method:
              'POST',

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


      const minimum =
        500;


      if (
        elapsed <
        minimum
      ) {

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              minimum -
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

        updateEcoGuacate(
          Number(
            result.consumptionLitres
          )
        );
      }


      await loadConversations();

    } catch (
      error
    ) {

      console.error(
        '[chat]',
        error
      );


      hideThinking();


      if (
        error.status ===
          400 &&
        error.data?.error ===
          'warning'
      ) {

        showToast(
          error.data.message ||
          '⚠️ Avertissement.'
        );

        return;
      }


      if (
        error.status ===
          403 &&
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

        return;
      }


      addMessageToUI(
        'assistant',
        error.data?.message ||
          '🥑 Désolé, je n’ai pas réussi à répondre.'
      );
    }


    finally {

      hideThinking();

      state.sending =
        false;
    }
  }


  /* =========================================================
     MODES
     ========================================================= */

  async function verifyMode(
    mode
  ) {

    const password =
      window.prompt(
        `Mot de passe ${mode} :`
      );


    if (
      password === null
    ) {

      return false;
    }


    try {

      const result =
        await api(
          '/modes/verify',
          {

            method:
              'POST',

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

    } catch (
      error
    ) {

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


    if (
      input
    ) {

      input.click();
    }
  }


  async function handleFile(
    file
  ) {

    if (
      !file
    )
      return;


    state.selectedFile =
      file;


    const preview =
      $('file-preview');


    if (
      !preview
    )
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

          ${(
            file.size /
            1024
          ).toFixed(1)}
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
        () =>
          scanAndAsk(
            file
          )
      );
  }


  async function scanAndAsk(
    file
  ) {

    if (
      !file
    )
      return;


    const question =
      window.prompt(

        'Que veux-tu demander à Aguacate AI sur ce fichier ?',

        'Analyse ce fichier et résume les points importants.'
      );


    if (
      question === null
    )
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

            method:
              'POST',

            body:
              form
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

        updateEcoGuacate(
          Number(
            result.consumptionLitres
          )
        );
      }


      await loadConversations();


      const preview =
        $('file-preview');


      if (
        preview
      ) {

        preview.classList.add(
          'hidden'
        );

        preview.innerHTML =
          '';
      }


      state.selectedFile =
        null;


      showToast(
        '✅ Fichier analysé.'
      );

    } catch (
      error
    ) {

      hideThinking();


      console.error(
        '[scan]',
        error
      );


      if (
        error.status ===
          403 &&
        error.data?.error ===
          'banned'
      ) {

        showToast(
          '🚫 Ton compte est temporairement suspendu.'
        );

      } else {

        showToast(
          error.data?.message ||
          '❌ Impossible d’analyser ce fichier.'
        );
      }
    }
  }


  /* =========================================================
     THÈME
     ========================================================= */

  function applyTheme(
    theme
  ) {

    const isLight =
      theme ===
      'light';


    document.body.classList.toggle(
      'dark',
      !isLight
    );


    document.body.classList.toggle(
      'light',
      isLight
    );


    localStorage.setItem(
      'aguacate_theme',
      isLight
        ? 'light'
        : 'dark'
    );
  }


  function toggleTheme() {

    const isLight =
      document.body.classList.contains(
        'light'
      );


    applyTheme(
      isLight
        ? 'dark'
        : 'light'
    );
  }


  function loadSavedTheme() {

    const saved =
      localStorage.getItem(
        'aguacate_theme'
      );


    applyTheme(
      saved === 'light'
        ? 'light'
        : 'dark'
    );
  }


  /* =========================================================
     ÉVÉNEMENTS
     ========================================================= */

  function setupEvents() {

    installChatStyles();


    /* ENVOI */

    $('send-btn')
      ?.addEventListener(
        'click',
        () => {

          sendMessage(
            $('prompt')?.value
          );
        }
      );


    /* ENTRÉE */

    $('prompt')
      ?.addEventListener(
        'keydown',
        event => {

          if (
            event.key ===
              'Enter' &&
            !event.shiftKey
          ) {

            event.preventDefault();


            sendMessage(
              event.target.value
            );
          }
        }
      );


    /* SUGGESTIONS */

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


              if (
                prompt
              ) {

                prompt.value =
                  button.dataset.prompt;

                prompt.focus();
              }
            }
          );
        }
      );


    /* NOUVELLE CONVERSATION */

    $('new-chat-btn')
      ?.addEventListener(
        'click',
        newConversation
      );


    /* RENOMMER */

    $('rename-btn')
      ?.addEventListener(
        'click',
        renameConversation
      );


    /* FICHIERS */

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


    /* THÈME */

    $('theme-btn')
      ?.addEventListener(
        'click',
        toggleTheme
      );


    /* MODES */

    $('mode')
      ?.addEventListener(
        'change',
        async event => {

          const mode =
            event.target.value;


          if (
            mode ===
              'Professeur' ||
            mode ===
              'Admin'
          ) {

            const success =
              await verifyMode(
                mode
              );


            if (
              !success
            ) {

              event.target.value =
                state.role ===
                  'admin'

                  ? 'Admin'

                  : state.role ===
                      'professeur'

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

      loadSavedTheme();

      setupEvents();

      updateEcoGuacate(
        0
      );

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

})();
