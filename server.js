// server.js
// Aguacate AI - backend minimal & robuste
// - No heavy native deps
// - Token auth, roles, admin protection
// - Chat (uses OpenAI if OPENAI_API_KEY set), conversations, users, admin logs
// - Reset consumption function + endpoint /internal/reset-consumption (use RESET_SECRET or secret file)

const express = require('express');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

// helper to read secret file fallback
function readSecretFromFile(paths) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const v = fs.readFileSync(p, 'utf8').trim();
        if (v) return v;
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}
const RESET_SECRET = process.env.RESET_SECRET || readSecretFromFile([
  '/run/secrets/RESET_SECRET',
  '/etc/secrets/RESET_SECRET',
  '/run/secrets/reset_secret'
]);

// OpenAI client if key present
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.warn('OPENAI_API_KEY not set. Chat and image generation will return placeholder replies.');
}

// In-memory storage (prototype)
const users = {};         // id -> {id, role, warnings, banned, connected, consumptionLitres, token}
const memories = {};      // userId -> [{role, content}]
const conversations = {}; // userId -> [{id, title, messages: [{role,content,date}]}]
const adminLogs = [];     // events

function genToken() { return crypto.randomBytes(20).toString('hex'); }

// Auth helpers
function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || req.body.token);
  if (!token) return null;
  return Object.values(users).find(u => u.token === token) || null;
}
function ensureAuth(req, res, next) {
  const u = getUserFromRequest(req);
  if (!u) return res.status(401).json({ ok: false, error: 'unauthenticated' });
  if (u.banned) return res.status(403).json({ ok: false, error: 'banned' });
  req.authUser = u;
  next();
}
function ensureAdmin(req, res, next) {
  const u = getUserFromRequest(req);
  if (!u || u.role !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
  if (u.banned) return res.status(403).json({ ok: false, error: 'banned' });
  req.authUser = u;
  next();
}

// simple moderation list
const BLACKLIST = ['pute','insulte1','motinterdit'];

// Reset daily consumption (midnight server time) - setTimeout -> setInterval
function resetDailyConsumption() {
  Object.values(users).forEach(u => { u.consumptionLitres = 0; });
  adminLogs.push({ type: 'reset-consumption', date: Date.now() });
  console.log('[server] consumption reset for all users');
}
function scheduleMidnightReset() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24,0,0,0);
  const ms = next - now;
  setTimeout(() => {
    try { resetDailyConsumption(); } catch(e) { console.error(e); }
    setInterval(resetDailyConsumption, 24*60*60*1000);
  }, ms + 1000);
}
scheduleMidnightReset();

// ROUTES

// POST /login -> returns id, token, role
app.post('/login', (req, res) => {
  const deviceId = req.body.deviceId;
  const id = deviceId || Math.random().toString(36).substring(2,8).toUpperCase();
  if (!users[id]) {
    users[id] = { id, role: 'user', warnings: 0, banned: false, connected: true, consumptionLitres: 0, token: genToken() };
  } else {
    users[id].connected = true;
    if (!users[id].token) users[id].token = genToken();
  }
  res.json({ ok:true, id: users[id].id, role: users[id].role, token: users[id].token, consumptionLitres: users[id].consumptionLitres || 0 });
});

// POST /modes/verify -> enable professeur/admin with old passwords
app.post('/modes/verify', (req,res) => {
  const { mode, password, deviceId } = req.body;
  if (!deviceId) return res.json({ ok:false, error:'no-device' });
  if (!users[deviceId]) return res.json({ ok:false, error:'unknown-user' });
  const OLD_PROF = "sinonAnanasAIneserapascontent2026!";
  const OLD_ADMIN = "situestristeBenjaBabynepleurepas2026?";
  if (mode === 'Professeur' && password === OLD_PROF) { users[deviceId].role = 'professeur'; return res.json({ ok:true, role:'professeur' }); }
  if (mode === 'Admin' && password === OLD_ADMIN) { users[deviceId].role = 'admin'; return res.json({ ok:true, role:'admin' }); }
  return res.json({ ok:false });
});

// GET /users (admin only) -> list all users
app.get('/users', ensureAdmin, (req,res) => {
  res.json(Object.values(users));
});

// GET /users/connected (admin only) -> list connected users
app.get('/users/connected', ensureAdmin, (req,res) => {
  const connected = Object.values(users).filter(u => u.connected);
  res.json(connected);
});

// GET /adminlogs (admin)
app.get('/adminlogs', ensureAdmin, (req,res) => res.json(adminLogs));

// Conversations endpoints
app.post('/newConversation', (req,res) => {
  const { user } = req.body;
  if (!user) return res.json({ ok:false });
  const id = Date.now().toString();
  if (!conversations[user]) conversations[user] = [];
  conversations[user].push({ id, title: 'Nouvelle conversation', messages: [] });
  res.json({ ok:true, id });
});
app.get('/conversations/:user', ensureAuth, (req,res) => {
  const user = req.params.user;
  // allow admin to view any user; normal user can view their own
  const requester = req.authUser;
  if (requester.role !== 'admin' && requester.id !== user) return res.status(403).json({ ok:false, error:'forbidden' });
  res.json(conversations[user] || []);
});
app.post('/renameConversation', ensureAuth, (req,res) => {
  const { user, conversationId, title } = req.body;
  const requester = req.authUser;
  if (requester.role !== 'admin' && requester.id !== user) return res.status(403).json({ ok:false, error:'forbidden' });
  if (!conversations[user]) return res.json({ ok:false });
  const conv = conversations[user].find(c => c.id === conversationId);
  if (!conv) return res.json({ ok:false });
  conv.title = title;
  res.json({ ok:true });
});
app.post('/deleteConversation', ensureAuth, (req,res) => {
  const { user, conversationId } = req.body;
  const requester = req.authUser;
  if (requester.role !== 'admin' && requester.id !== user) return res.status(403).json({ ok:false, error:'forbidden' });
  if (!conversations[user]) return res.json({ ok:false });
  conversations[user] = conversations[user].filter(c => c.id !== conversationId);
  res.json({ ok:true });
});

// Warn/ban (admin)
app.post('/warn', ensureAdmin, (req,res) => {
  const { id } = req.body;
  const u = users[id];
  if (!u) return res.json({ ok:false });
  u.warnings++;
  if (u.warnings >= 3) u.banned = true;
  adminLogs.push({ type:'warning', user:id, by:req.authUser.id, date: Date.now() });
  res.json({ ok:true, warnings: u.warnings, banned: u.banned });
});
app.post('/ban', ensureAdmin, (req,res) => {
  const { id } = req.body;
  const u = users[id];
  if (!u) return res.json({ ok:false });
  u.banned = true;
  adminLogs.push({ type:'ban', user:id, by: req.authUser.id, date: Date.now() });
  res.json({ ok:true });
});
app.post('/unban', ensureAdmin, (req,res) => {
  const { id } = req.body;
  const u = users[id];
  if (!u) return res.json({ ok:false });
  u.banned = false;
  adminLogs.push({ type:'unban', user:id, by:req.authUser.id, date: Date.now() });
  res.json({ ok:true });
});

// Chat endpoint
app.post('/chat', async (req,res) => {
  try {
    const { user, message, mode } = req.body;
    if (!user) return res.json({ reply: 'Utilisateur inconnu' });
    if (!users[user]) users[user] = { id:user, role:'user', warnings:0, banned:false, connected:true, consumptionLitres:0, token: genToken() };
    if (users[user].banned) return res.json({ reply: '⚠️ Vous êtes banni.' });
    if (BLACKLIST.some(w => (message||'').toLowerCase().includes(w))) {
      users[user].banned = true;
      adminLogs.push({ type:'auto-ban', user, date: Date.now() });
      return res.json({ reply: '⚠️ Contenu inapproprié — banni.' });
    }
    if (!memories[user]) memories[user] = [];
    memories[user].push({ role:'user', content: message });

    let reply = "🥑 Aguacate (réponse par défaut car l'API n'est pas configurée).";
    if (openai) {
      const systemPrompt = (mode === 'Kids') ? 'Explique simplement' : (mode === 'Collégien') ? 'Aide un collégien' : 'Tu es Aguacate AI.';
      const response = await openai.chat.completions.create({
        model: 'openrouter/auto',
        messages: [{ role:'system', content: systemPrompt }, ...memories[user].slice(-15)]
      });
      reply = response.choices?.[0]?.message?.content || reply;
    }
    memories[user].push({ role:'assistant', content: reply });

    if (!conversations[user]) conversations[user] = [];
    if (!conversations[user].length) conversations[user].push({ id: Date.now().toString(), title: 'Conversation', messages: [] });
    const lastConv = conversations[user][conversations[user].length - 1];
    lastConv.messages.push({ role:'user', content: message, date: Date.now() });
    lastConv.messages.push({ role:'assistant', content: reply, date: Date.now() });

    const extra = 1 + Math.floor((reply.length || 0) / 200);
    users[user].consumptionLitres = (users[user].consumptionLitres || 0) + extra;
    res.json({ reply, consumptionLitres: users[user].consumptionLitres });
  } catch (e) {
    console.error(e);
    res.json({ reply: '🥑 Une erreur est survenue.' });
  }
});

// Internal reset endpoint (protected by RESET_SECRET)
app.post('/internal/reset-consumption', (req,res) => {
  const provided = req.headers['x-admin-secret'] || req.query.secret;
  if (!RESET_SECRET || !provided || provided !== RESET_SECRET) return res.status(403).json({ ok:false, error:'forbidden' });
  try { resetDailyConsumption(); return res.json({ ok:true }); } catch (e) { console.error(e); return res.status(500).json({ ok:false, error:'error' }); }
});

// export app (index.js will start the server)
module.exports = app;
