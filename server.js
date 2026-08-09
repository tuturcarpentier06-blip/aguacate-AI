const express = require("express");
const OpenAI = require("openai");
const multer = require("multer");

const app = express();

app.use(express.json());
app.use(express.static("."));

const PORT = process.env.PORT || 3000;

// ======================
// MOTS DE PASSE
// ======================

const USER_PASSWORD = "BenjaminAguacateAI2026#";
const ADMIN_PASSWORD = "sinonAnanasAIneserapascontent2026!";
const SUPREME_PASSWORD = "situestristeBenjaBabynepleurepas2026?";

// ======================
// STOCKAGE MEMOIRE
// ======================

const users = {};
const memories = {};
const conversations = {};
const adminLogs = [];

// ======================
// OPENROUTER
// ======================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// ======================
// UPLOAD
// ======================

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// ======================
// LOGIN
// ======================

app.post("/login", (req, res) => {

  const { password, deviceId } = req.body;

  if (
    password !== USER_PASSWORD &&
    password !== ADMIN_PASSWORD &&
    password !== SUPREME_PASSWORD
  ) {
    return res.json({
      ok: false
    });
  }

  let role = "user";

  if (password === ADMIN_PASSWORD) {
    role = "admin";
  }

  if (password === SUPREME_PASSWORD) {
    role = "supreme";
  }

  let id = deviceId;

  if (!id) {
    id = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
  }

  if (!users[id]) {

    users[id] = {
      id,
      role,
      warnings: 0,
      banned: false,
      connected: true
    };

  }

  users[id].connected = true;

  return res.json({
    ok: true,
    role,
    id
  });

});

// ======================
// UTILISATEURS
// ======================

app.get("/users", (req, res) => {

  res.json(
    Object.values(users)
  );

});

// ======================
// CONVERSATIONS
// ======================

app.post("/newConversation", (req, res) => {

  const { user } = req.body;

  const id = Date.now().toString();

  if (!conversations[user]) {
    conversations[user] = [];
  }

  conversations[user].push({
    id,
    title: "Nouvelle conversation",
    messages: []
  });

  res.json({
    ok: true,
    id
  });

});

// ======================
// LISTER CONVERSATIONS
// ======================

app.get("/conversations/:user", (req, res) => {

  const user = req.params.user;

  res.json(
    conversations[user] || []
  );

});

// ======================
// RENOMMER CONVERSATION
// ======================

app.post("/renameConversation", (req, res) => {

  const {
    user,
    conversationId,
    title
  } = req.body;

  if (!conversations[user]) {
    return res.json({ ok: false });
  }

  const conv =
    conversations[user].find(
      c => c.id === conversationId
    );

  if (!conv) {
    return res.json({ ok: false });
  }

  conv.title = title;

  return res.json({
    ok: true
  });

});

// ======================
// WARN
// ======================

app.post("/warn", (req, res) => {

  const { id } = req.body;

  const user = users[id];

  if (!user) {
    return res.json({
      ok: false
    });
  }

  if (user.role === "supreme") {
    return res.json({
      ok: false
    });
  }

  user.warnings++;

  if (user.warnings >= 3) {
    user.banned = true;
  }

  adminLogs.push({
    type: "warning",
    user: id,
    date: Date.now()
  });

  res.json({
    warnings: user.warnings,
    banned: user.banned
  });

});

// ======================
// RETIRER AVERTISSEMENT
// ======================

app.post("/unwarn", (req, res) => {

  const user = users[req.body.id];

  if (!user) {
    return res.json({
      ok: false
    });
  }

  user.warnings = Math.max(
    0,
    user.warnings - 1
  );

  res.json({
    warnings: user.warnings
  });

});

// ======================
// BAN
// ======================

app.post("/ban", (req, res) => {

  const user = users[req.body.id];

  if (!user) {
    return res.json({
      ok: false
    });
  }

  if (user.role === "supreme") {
    return res.json({
      ok: false
    });
  }

  user.banned = true;

  adminLogs.push({
    type: "ban",
    user: user.id,
    date: Date.now()
  });

  res.json({
    ok: true
  });

});

// ======================
// DEBAN
// ======================

app.post("/unban", (req, res) => {

  const user = users[req.body.id];

  if (!user) {
    return res.json({
      ok: false
    });
  }

  user.banned = false;

  adminLogs.push({
    type: "unban",
    user: user.id,
    date: Date.now()
  });

  res.json({
    ok: true
  });

});

// ======================
// MAILBOX ADMIN
// ======================

app.get("/adminlogs", (req, res) => {
  res.json(adminLogs);
});

// ======================
// CHAT IA
// ======================

app.post("/chat", async (req, res) => {

  try {

    const {
      user,
      message,
      mode
    } = req.body;

    if (!memories[user]) {
      memories[user] = [];
    }

    let systemPrompt =
      "Tu es Aguacate AI.";

    if (mode === "Kids") {
      systemPrompt =
        "Tu expliques simplement pour les enfants.";
    }

    if (mode === "Collégien") {
      systemPrompt =
        "Tu aides les collégiens et étudiants.";
    }

    if (mode === "Professeur") {
      systemPrompt =
        "Tu aides les professeurs à créer des cours et exercices.";
    }

    memories[user].push({
      role: "user",
      content: message
    });

    const response =
      await openai.chat.completions.create({

        model: "openrouter/auto",

        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...memories[user].slice(-15)
        ]
      });

    const reply =
      response.choices[0]
      .message.content;

    memories[user].push({
      role: "assistant",
      content: reply
    });

    res.json({
      reply
    });

  } catch (err) {

    console.error(err);

    res.json({
      reply:
        "🥑 Une erreur est survenue."
    });

  }

});

// ======================
// UPLOAD
// ======================

app.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {

    if (!req.file) {
      return res.json({
        ok: false
      });
    }

    return res.json({
      ok: true,
      filename:
        req.file.originalname
    });

  }
);

// ======================
// START
// ======================

app.listen(PORT, () => {

  console.log(
    "🥑 Aguacate AI v3.5.0 ONLINE"
  );

});
