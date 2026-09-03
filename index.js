<!DOCTYPE html>
<html lang="fr">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aguacate AI v3.5.0 🥑</title>

<!-- Google Fonts pour embellir -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">

<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="avatar.css">
</head>

<body>

<!-- =========================
     LOGIN (sans mot de passe)
========================= -->

<div id="login-screen">
  <div class="login-card">
    <div id="aguacate-container">
      <div id="aguacate">
        <div class="eyes">
          <div class="eye"></div>
          <div class="eye"></div>
        </div>
        <div class="blush blush-left"></div>
        <div class="blush blush-right"></div>
        <div id="mouth"></div>
        <div class="tie"></div>
      </div>
    </div>

    <h1>Aguacate AI 🥑</h1>
    <p>Connecte-toi (aucun mot de passe requis)</p>

    <div class="password-wrapper">
      <!-- Champ mot de passe retiré -->
      <p style="color:#6b8f84">Appuie sur Accéder pour te connecter automatiquement.</p>
    </div>

    <button class="login-btn" onclick="login()">Accéder 🔑</button>

    <div class="version">Version v3.5.0</div>

    <div class="legal">
      Ce site est un projet personnel et éducatif.<br>
      Il peut utiliser des services tiers.
    </div>
  </div>
</div>

<!-- =========================
     APPLICATION
========================= -->

<div id="app">
  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="logo">🥑 Aguacate AI</div>

    <div class="mode-box">
      <select id="mode">
        <option>Kids</option>
        <option>Collégien</option>
        <option>Professeur</option>
        <option>Admin</option>
      </select>
    </div>

    <button class="new-chat" onclick="newConversation()">➕ Nouvelle conversation</button>
    <button class="new-chat" onclick="renameConversation()">✏️ Renommer</button>

    <div class="conversations"></div>

    <div class="user-zone">
      <div id="user-badge">🥑 Avocat #0000</div>
      <div class="bottom-buttons">
        <button onclick="toggleLive()">🎤 Mode Live</button>
        <button onclick="openAdmin()">⚙️ Admin</button>
        <button onclick="openUsers()">👥 Utilisateurs</button>
      </div>
    </div>
  </div>

  <!-- CHAT -->
  <div class="chat">
    <div class="chat-header">
      <div style="display:flex;align-items:center;gap:12px">
        <div>🥑 Aguacate AI</div>
        <div style="font-size:12px;color:#888">v3.5.0</div>
      </div>

      <!-- Ecoguacate bar -->
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:220px">
          <div class="eco-bar" id="ecoBar" style="height:10px;border-radius:8px;background:linear-gradient(90deg,#0f9d58,#f4b400,#db4437)"><div id="ecoPointer" style="height:100%;width:2px;background:rgba(0,0,0,0.2);position:relative;transform:translateX(0%);transition:transform 600ms ease"></div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="water-circle green" id="waterCircle" style="width:44px;height:44px;border-radius:50%;position:relative;overflow:hidden;border:2px solid #0f9d58">
            <div id="waterFill" style="position:absolute;inset:0;border-radius:50%;clip-path:circle(0% at 50% 100%);background:rgba(0,150,255,0.18);transition:clip-path 600ms linear"></div>
            <div id="waterText" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px">0L</div>
          </div>
          <div id="ecoMessage" style="font-size:12px;color:#333"></div>
        </div>
      </div>
    </div>

    <div id="messages">
      <div class="message-ai">Bonjour 👋<br>Je suis Aguacate AI.</div>
    </div>

    <div class="input-bar">
      <input id="prompt" placeholder="Pose une question à Aguacate AI...">
      <button class="send-btn" onclick="send()">➤</button>
    </div>
  </div>
</div>

<!-- ADMIN -->
<div id="admin-panel" class="modal">
  <div class="modal-card">
    <div class="menu-header">
      <h2>🛡️ Panneau Admin</h2>
      <button class="close-btn" onclick="closeAdmin()">← Retour</button>
    </div>

    <button onclick="setVoice('female')">♀ Voix féminine</button>
    <button onclick="setVoice('male')">♂ Voix masculine</button>
    <br><br>
    <button onclick="toggleLive()">🎤 Mode Live</button>
    <br><br>
    <button onclick="openMailbox()">📬 Boîte Mail Admin</button>
  </div>
</div>

<!-- UTILISATEURS -->
<div id="users-panel" class="modal">
  <div class="modal-card">
    <div class="menu-header">
      <h2>👥 Utilisateurs</h2>
      <button class="close-btn" onclick="closeUsers()">← Retour</button>
    </div>
    <div id="user-list">Chargement...</div>
  </div>
</div>

<!-- BOITE MAIL -->
<div id="mailbox-panel" class="modal">
  <div class="modal-card">
    <div class="menu-header">
      <h2>📬 Boîte Mail Admin</h2>
      <button class="close-btn" onclick="closeMailbox()">← Retour</button>
    </div>
    <div id="mailbox-list">📭 Aucun événement enregistré.</div>
  </div>
</div>

<script src="voice.js"></script>
<script src="admin.js"></script>
<script src="app.js"></script>

</body>
</html>
