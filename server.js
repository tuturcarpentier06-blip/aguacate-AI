// server.js (modifié) - support: no-password login, mode verify, ban/modération, écoguacate back hooks, remove 'supreme' role

const express = require("express");
const OpenAI = require("openai");
const multer = require("multer");

const app = express();

app.use(express.json());
app.use(express.static("."));

const PORT = process.env.PORT || 3000;

// ======================
// ANCIENS MOTS DE PASSE (gardés côté serveur)
// - mapping demandé : ancien ADMIN_PASSWORD -> Professeur
// - ancien SUPREME_PASSWORD -> Admin
// NOTE: NE PAS COMMITER DE SECRETS RÉELS DANS LE CODE
// ======================

const OLD_PROFESSEUR_PASSWORD = "sinonAnanasAIneserapascontent2026!"; // ancien ADMIN_PASSWORD
const OLD_ADMIN_PASSWORD = "situestristeBenjaBabynepleurepas2026?"; // ancien SUPREME_PASSWORD

// ======================
// STOCKAGE MEMOIRE (simple prototype)
// ======================

const users = {}; // id -> { id, role, warnings, banned, connected, consumptionLitres }
const memories = {}; // user -> messages
const conversations = {}; // user -> [ {id, title, messages: [...] } ]
const adminLogs = []; // events (warning/ban/unban/auto-ban)

// On startup, migrate any 'supreme' role users to 'admin' (if data persisted elsewhere)
Object.values(users).forEach(u => {
  if (u.role === "supreme") u.role = "admin";
});

// ======================
// OPENROUTER / OpenAI wrapper (ai.js could be used instead)
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
// UTIL / MODERATION
// ======================

const BLACKLIST = [
  "insulte1",
  "motinterdit",
  "pute", // exemple -> adapte
];

// retourne true si inapproprié
function containsBlacklisted(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return BLACKLIST.some(w => t.includes(w));
}

// ======================
// LOGIN SANS MOT DE PASSE
// ======================

app.post("/login", (req, res) => {
  const { deviceId } = req.body;

  let id = deviceId;
  if (!id) {
    id = Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  if (!users[id]) {
    users[id] = {
      id,
      role: "user",
      warnings: 0,
      banned: false,
      connected: true,
      consumptionLitres: 0
    };
  } else {
    users[id].connected = true;
  }

  return res.json({
    ok: true,
    role: users[id].role,
    id
  });
});

// ======================
// VERIFY MODE (Professeur / Admin) via ancien mot de passe
// - Professeur uses OLD_PROFESSEUR_PASSWORD
// - Admin uses OLD_ADMIN_PASSWORD
// ======================

app.post("/modes/verify", (req, res) => {
  const { mode, password, deviceId } = req.body;
  if (!deviceId) return res.json({ ok: false, error: "no-device" });
  if (!users[deviceId]) return res.json({ ok: false, error: "unknown-user" });

  if (mode === "Professeur") {
    if (password === OLD_PROFESSEUR_PASSWORD) {
      users[deviceId].role = "professeur"; // rôle local pour prof
      return res.json({ ok: true, role: "professeur" });
    } else return res.json({ ok: false });
  }

  if (mode === "Admin") {
    if (password === OLD_ADMIN_PASSWORD) {
      users[deviceId].role = "admin";
      return res.json({ ok: true, role: "admin" });
    } else return res.json({ ok: false });
  }

  // Kids / Collégien don't require password
  return res.json({ ok: true, role: users[deviceId].role || "user" });
});

// ======================
// UTILISATEURS
// ======================

app.get("/users", (req, res) => {
  res.json(Object.values(users));
});

// ======================
// ADMIN: lister toutes les conversations (protégé côté serveur par simple vérif role)
// usage: GET /admin/conversations?adminId=XXXX
// ======================

app.get("/admin/conversations", (req, res) => {
  const adminId = req.query.adminId;
  if (!adminId || !users[adminId] || users[adminId].role !== "admin") {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  // renvoyer toutes les conversations
  const all = {};
  Object.keys(conversations).forEach(u => (all[u] = conversations[u]));
  res.json({ ok: true, conversations: all });
});

// ======================
// CONVERSATIONS (user-specific)
// ======================

app.post("/newConversation", (req, res) => {
  const { user } = req.body;
  const id = Date.now().toString();
  if (!conversations[user]) conversations[user] = [];
  conversations[user].push({
    id,
    title: "Nouvelle conversation",
    messages: []
  });
  res.json({ ok: true, id });
});

app.get("/conversations/:user", (req, res) => {
  const user = req.params.user;
  res.json(conversations[user] || []);
});

app.post("/renameConversation", (req, res) => {
  const { user, conversationId, title } = req.body;
  if (!conversations[user]) return res.json({ ok: false });
  const conv = conversations[user].find(c => c.id === conversationId);
  if (!conv) return res.json({ ok: false });
  conv.title = title;
  return res.json({ ok: true });
});

// ======================
// WARN / UNWARN / BAN / UNBAN (admin actions)
// ======================

app.post("/warn", (req, res) => {
  const { id } = req.body;
  const user = users[id];
  if (!user) return res.json({ ok: false });
  user.warnings++;
  if (user.warnings >= 3) user.banned = true;
  adminLogs.push({ type: "warning", user: id, date: Date.now() });
  res.json({ warnings: user.warnings, banned: user.banned });
});

app.post("/unwarn", (req, res) => {
  const user = users[req.body.id];
  if (!user) return res.json({ ok: false });
  user.warnings = Math.max(0, user.warnings - 1);
  res.json({ warnings: user.warnings });
});

app.post("/ban", (req, res) => {
  const user = users[req.body.id];
  if (!user) return res.json({ ok: false });
  user.banned = true;
  adminLogs.push({ type: "ban", user: user.id, date: Date.now() });
  res.json({ ok: true });
});

app.post("/unban", (req, res) => {
  const user = users[req.body.id];
  if (!user) return res.json({ ok: false });
  user.banned = false;
  adminLogs.push({ type: "unban", user: user.id, date: Date.now() });
  res.json({ ok: true });
});

app.get("/adminlogs", (req, res) => {
  res.json(adminLogs);
});

// ======================
// UPLOAD (image describe placeholder)
// ======================

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.json({ ok: false });
  return res.json({ ok: true, filename: req.file.originalname, path: req.file.path });
});

// endpoint pour décrire une image (placeholder simple)
app.post("/images/describe", upload.single("image"), async (req, res) => {
  if (!req.file) return res.json({ ok: false, error: "no-file" });
  // Ici tu peux appeler une API vision (OpenAI Vision, Google Vision). Pour le moment : réponse générique.
  return res.json({ ok: true, description: "Analyse d'image non configurée sur ce serveur (configure OpenAI Vision / Google Vision)." });
});

// génération d'image (utilise la même intégration que ton ai.image)
app.post("/images/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.json({ ok: false, error: "no-prompt" });
  try {
    // Si tu veux, appelle openai via un wrapper (ici simplifié)
    const imageRes = await openai.images.generate({
      model: "stable-diffusion",
      prompt
    });
    const url = imageRes.data?.[0]?.url || null;
    return res.json({ ok: true, url });
  } catch (err) {
    console.error(err);
    return res.json({ ok: false, error: "image-failed" });
  }
});

// ======================
// CHAT IA avec modération et suivi consommation d'eau
// ======================

app.post("/chat", async (req, res) => {
  try {
    const { user, message, mode } = req.body;
    if (!user) return res.json({ reply: "Utilisateur inconnu" });

    // init structures
    if (!memories[user]) memories[user] = [];
    if (!users[user]) {
      users[user] = { id: user, role: "user", warnings: 0, banned: false, connected: true, consumptionLitres: 0 };
    }

    // si banni
    if (users[user].banned) {
      return res.json({ reply: "⚠️ Vous êtes banni. Contactez un administrateur." });
    }

    // modération simple
    if (containsBlacklisted(message)) {
      users[user].banned = true;
      adminLogs.push({ type: "auto-ban", user, reason: "contenu inapproprié", date: Date.now() });
      return res.json({ reply: "⚠️ Message inapproprié détecté — vous avez été banni automatiquement." });
    }

    // system prompt selon mode
    let systemPrompt = "Tu es Aguacate AI.";
    if (mode === "Kids") systemPrompt = "Tu expliques simplement pour les enfants.";
    if (mode === "Collégien") systemPrompt = "Tu aides les collégiens et étudiants.";
    if (mode === "Professeur" || mode === "professeur") systemPrompt = "Tu aides les professeurs à créer des cours et exercices.";
    if (users[user].role === "professeur") systemPrompt = "Tu aides les professeurs à créer des cours et exercices.";

    memories[user].push({ role: "user", content: message });

    const response = await openai.chat.completions.create({
      model: "openrouter/auto",
      messages: [{ role: "system", content: systemPrompt }, ...memories[user].slice(-15)]
    });

    const reply = response.choices[0].message.content;

    memories[user].push({ role: "assistant", content: reply });

    // mise à jour conversation store (optionnel)
    if (!conversations[user]) conversations[user] = [];
    if (!conversations[user].length) {
      const id = Date.now().toString();
      conversations[user].push({ id, title: "Conversation", messages: [] });
    }
    const lastConv = conversations[user][conversations[user].length - 1];
    lastConv.messages.push({ role: "user", content: message, date: Date.now() });
    lastConv.messages.push({ role: "assistant", content: reply, date: Date.now() });

    // consommation d'eau : logique simple
    const extra = 1 + Math.floor((reply.length || 0) / 200); // 1L + 1L every ~200 chars
    users[user].consumptionLitres = (users[user].consumptionLitres || 0) + extra;

    return res.json({ reply, consumptionLitres: users[user].consumptionLitres });
  } catch (err) {
    console.error(err);
    return res.json({ reply: "🥑 Une erreur est survenue." });
  }
});

// ======================
// DELETE CONVERSATION (fin)
app.post("/deleteConversation", (req, res) => {
  const { user, conversationId } = req.body;
  if (!conversations[user]) return res.json({ ok: false });
  conversations[user] = conversations[user].filter(conv => conv.id !== conversationId);
  res.json({ ok: true });
});

// ======================
// START
app.listen(PORT, () => {
  console.log("🥑 Aguacate AI v3.5.0 ONLINE");
});
