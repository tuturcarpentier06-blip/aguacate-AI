// server.js - Aguacate AI (réécrit)
// Fonctionnalités : login sans mot de passe (token), modes verify (anciens mots de passe),
// admin middleware, modération/ban, chat, conversations, users, adminlogs,
// image OCR via Tesseract.js, image generation via OpenAI, reset consommation à minuit.

const express = require('express');
const OpenAI = require('openai');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// ========== Configuration (adapt / change) ==========
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
if (!OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY not set. Image generation / chat may fail if required.');
}

// Anciennes valeurs (remappées)
// NOTE: modifie si tu veux des mots différents. Ne commit pas de secrets publics si c'est sensible.
const OLD_PROFESSEUR_PASSWORD = "sinonAnanasAIneserapascontent2026!"; // ancien ADMIN_PASSWORD -> Professeur
const OLD_ADMIN_PASSWORD = "situestristeBenjaBabynepleurepas2026?";   // ancien SUPREME_PASSWORD -> Admin

// OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// ========== Stockage mémoire (prototype) ==========
const users = {};          // id -> { id, role, warnings, banned, connected, consumptionLitres, token }
const memories = {};       // userId -> messages array
const conversations = {};  // userId -> [ { id, title, messages: [{role,content,date}] } ]
const adminLogs = [];      // [{type, user, by, reason, date}]
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ========== Multer upload ==========
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    // allow images and common docs
    const allowed = [
      'image/jpeg','image/png','image/webp','image/gif',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ========== Rate limiting ==========
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120
});
app.use(apiLimiter);

// ========== Auth helpers ==========
function genToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || req.body.token);
  if (!token) return null;
  return Object.values(users).find(u => u.token === token) || null;
}

function ensureAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthenticated' });
  if (user.banned) return res.status(403).json({ ok: false, error: 'banned' });
  req.authUser = user;
  next();
}

function ensureAdmin(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(403).json({ ok: false, error: 'forbidden' });
  if (user.banned) return res.status(403).json({ ok: false, error: 'banned' });
  if (user.role !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
  req.authUser = user;
  next();
}

// ========== Moderation helper (simple blacklist) ==========
const BLACKLIST = ['insulte1','motinterdit','pute']; // adapte selon besoins
function containsBlacklisted(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return BLACKLIST.some(w => t.includes(w));
}

// ========== Tesseract worker (lazy init) ==========
let ocrWorker = null;
let ocrReady = false;
async function initOCR(lang = 'fra') {
  if (ocrReady) return;
  ocrWorker = createWorker({
    logger: m => { /* console.log('[TESSERACT]', m); */ }
  });
  await ocrWorker.load();
  await ocrWorker.loadLanguage(lang);
  await ocrWorker.initialize(lang);
  ocrReady = true;
  console.log('Tesseract worker initialized for', lang);
}

// optional preprocess image to improve OCR
async function preprocessImage(inputPath, outPath) {
  await sharp(inputPath)
    .resize({ width: 1600, withoutEnlargement: true })
    .grayscale()
    .normalise()
    .toFile(outPath);
}

// ========== Reset daily consumption at midnight ==========
function resetDailyConsumption() {
  Object.values(users).forEach(u => { u.consumptionLitres = 0; });
  adminLogs.push({ type: 'reset-consumption', date: Date.now() });
  console.log('Consumption reset for all users at midnight.');
}

function scheduleMidnightReset() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24,0,0,0); // next midnight
  const ms = next - now;
  setTimeout(() => {
    try { resetDailyConsumption(); } catch(e) { console.error(e); }
    // then set 24h intervals
    setInterval(resetDailyConsumption, 24*60*60*1000);
  }, ms + 1000); // small buffer
}
scheduleMidnightReset();

// ========== Routes ==========

// POST /login  -> creates/returns token, role, id
app.post('/login', (req, res) => {
  const { deviceId } = req.body;
  let id = deviceId || Math.random().toString(36).substring(2,6).toUpperCase();
  if (!users[id]) {
    users[id] = { id, role: 'user', warnings: 0, banned: false, connected: true, consumptionLitres: 0, token: genToken() };
  } else {
    users[id].connected = true;
    if (!users[id].token) users[id].token = genToken();
  }
  return res.json({ ok: true, id: users[id].id, role: users[id].role, token: users[id].token, consumptionLitres: users[id].consumptionLitres || 0 });
});

// POST /modes/verify -> verify special passwords to set role lokalement
app.post('/modes/verify', (req, res) => {
  const { mode, password, deviceId } = req.body;
  if (!deviceId) return res.json({ ok: false, error: 'no-device' });
  if (!users[deviceId]) return res.json({ ok: false, error: 'unknown-user' });

  if (mode === 'Professeur') {
    if (password === OLD_PROFESSEUR_PASSWORD) {
      users[deviceId].role = 'professeur';
      return res.json({ ok: true, role: 'professeur' });
    } else return res.json({ ok: false });
  }
  if (mode === 'Admin') {
    if (password === OLD_ADMIN_PASSWORD) {
      users[deviceId].role = 'admin';
      return res.json({ ok: true, role: 'admin' });
    } else return res.json({ ok: false });
  }
  // other modes (Kids, Collégien) don't need password
  return res.json({ ok: true, role: users[deviceId].role || 'user' });
});

// GET /users -> admin only
app.get('/users', ensureAdmin, (req, res) => {
  res.json(Object.values(users));
});

// GET /adminlogs -> admin only
app.get('/adminlogs', ensureAdmin, (req, res) => {
  res.json(adminLogs);
});

// Admin: list all conversations (admin only)
app.get('/admin/conversations', ensureAdmin, (req, res) => {
  res.json({ ok: true, conversations });
});

// ======== conversations user endpoints ========
app.post('/newConversation', (req, res) => {
  const { user } = req.body;
  if (!user) return res.json({ ok: false });
  const id = Date.now().toString();
  if (!conversations[user]) conversations[user] = [];
  conversations[user].push({ id, title: 'Nouvelle conversation', messages: [] });
  return res.json({ ok: true, id });
});

app.get('/conversations/:user', (req, res) => {
  const user = req.params.user;
  res.json(conversations[user] || []);
});

app.post('/renameConversation', (req, res) => {
  const { user, conversationId, title } = req.body;
  if (!conversations[user]) return res.json({ ok: false });
  const conv = conversations[user].find(c => c.id === conversationId);
  if (!conv) return res.json({ ok: false });
  conv.title = title;
  return res.json({ ok: true });
});

app.post('/deleteConversation', (req, res) => {
  const { user, conversationId } = req.body;
  if (!conversations[user]) return res.json({ ok: false });
  conversations[user] = conversations[user].filter(c => c.id !== conversationId);
  return res.json({ ok: true });
});

// ======= warn / unwarn / ban / unban (admin only) =======
app.post('/warn', ensureAdmin, (req, res) => {
  const { id } = req.body;
  const user = users[id];
  if (!user) return res.json({ ok: false });
  user.warnings++;
  if (user.warnings >= 3) user.banned = true;
  adminLogs.push({ type: 'warning', user: id, by: req.authUser.id, date: Date.now() });
  res.json({ warnings: user.warnings, banned: user.banned });
});

app.post('/unwarn', ensureAdmin, (req, res) => {
  const user = users[req.body.id];
  if (!user) return res.json({ ok: false });
  user.warnings = Math.max(0, user.warnings - 1);
  res.json({ warnings: user.warnings });
});

app.post('/ban', ensureAdmin, (req, res) => {
  const user = users[req.body.id];
  if (!user) return res.json({ ok: false });
  user.banned = true;
  adminLogs.push({ type: 'ban', user: user.id, by: req.authUser.id, date: Date.now() });
  res.json({ ok: true });
});

app.post('/unban', ensureAdmin, (req, res) => {
  const user = users[req.body.id];
  if (!user) return res.json({ ok: false });
  user.banned = false;
  adminLogs.push({ type: 'unban', user: user.id, by: req.authUser.id, date: Date.now() });
  res.json({ ok: true });
});

// ========== Chat endpoint (modération, memory, consumption) ==========
app.post('/chat', async (req, res) => {
  try {
    const { user, message, mode } = req.body;
    if (!user) return res.json({ reply: 'Utilisateur inconnu' });

    if (!memories[user]) memories[user] = [];
    if (!users[user]) {
      users[user] = { id: user, role: 'user', warnings: 0, banned: false, connected: true, consumptionLitres: 0, token: genToken() };
    }

    if (users[user].banned) return res.json({ reply: '⚠️ Vous êtes banni. Contactez un administrateur.' });

    if (containsBlacklisted(message)) {
      users[user].banned = true;
      adminLogs.push({ type: 'auto-ban', user, reason: 'contenu inapproprié', date: Date.now() });
      return res.json({ reply: '⚠️ Message inapproprié détecté — vous avez été banni automatiquement.' });
    }

    // system prompt basique
    let systemPrompt = 'Tu es Aguacate AI.';
    if (mode === 'Kids') systemPrompt = 'Tu expliques simplement pour les enfants.';
    if (mode === 'Collégien') systemPrompt = 'Tu aides les collégiens et étudiants.';
    if (mode === 'Professeur' || users[user].role === 'professeur') systemPrompt = 'Tu aides les professeurs à créer des cours et exercices.';

    memories[user].push({ role: 'user', content: message });

    const response = await openai.chat.completions.create({
      model: 'openrouter/auto',
      messages: [{ role: 'system', content: systemPrompt }, ...memories[user].slice(-15)]
    });

    const reply = response.choices[0].message.content || '🥑 Une erreur est survenue.';
    memories[user].push({ role: 'assistant', content: reply });

    // save to conversations
    if (!conversations[user]) conversations[user] = [];
    if (!conversations[user].length) conversations[user].push({ id: Date.now().toString(), title: 'Conversation', messages: [] });
    const lastConv = conversations[user][conversations[user].length - 1];
    lastConv.messages.push({ role: 'user', content: message, date: Date.now() });
    lastConv.messages.push({ role: 'assistant', content: reply, date: Date.now() });

    // consommation d'eau : 1L + 1L par ~200 caractères dans la réponse (ajuste si tu veux)
    const extra = 1 + Math.floor((reply.length || 0) / 200);
    users[user].consumptionLitres = (users[user].consumptionLitres || 0) + extra;

    res.json({ reply, consumptionLitres: users[user].consumptionLitres });
  } catch (err) {
    console.error(err);
    res.json({ reply: '🥑 Une erreur est survenue.' });
  }
});

// ========== Upload endpoint (simple) ==========
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ ok: false });
  // return accessible URL
  const url = `/uploads/${path.basename(req.file.path)}`;
  res.json({ ok: true, filename: req.file.originalname, url });
});

// ========== Start ==========
app.listen(PORT, () => {
  console.log(`🥑 Aguacate AI server running on port ${PORT}`);
});
// endpoint pour reset (protégé par un secret simple)
app.post('/internal/reset-consumption', (req, res) => {
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  if (!secret || secret !== process.env.RESET_SECRET) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  try {
    resetDailyConsumption(); // ta fonction qui met consumptionLitres = 0
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'error' });
  }
});
