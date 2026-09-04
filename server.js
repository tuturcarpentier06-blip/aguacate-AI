// server.js (simplifié, fiable pour Render)
const express = require('express');
const { OpenAI } = require('openai');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// config
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;

// safe read secret file helper
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
const RESET_SECRET = process.env.RESET_SECRET || readSecretFromFile(['/run/secrets/RESET_SECRET','/etc/secrets/RESET_SECRET']);

// OpenAI client (optional; require OPENAI_API_KEY to work)
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.warn('OPENAI_API_KEY not set — chat/image generate will be disabled.');
}

// storage in-memory (prototype)
const users = {};
const memories = {};
const conversations = {};
const adminLogs = [];
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// multer
const upload = multer({ dest: uploadsDir });

// rate limiter
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(apiLimiter);

// helpers
function genToken() { return crypto.randomBytes(24).toString('hex'); }

function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || req.body.token);
  if (!token) return null;
  return Object.values(users).find(u => u.token === token) || null;
}

function ensureAdmin(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== 'admin' || user.banned) return res.status(403).json({ ok: false, error: 'forbidden' });
  req.authUser = user;
  next();
}

// reset daily consumption
function resetDailyConsumption() {
  Object.values(users).forEach(u => { u.consumptionLitres = 0; });
  adminLogs.push({ type: 'reset-consumption', date: Date.now() });
  console.log('Consumption reset for all users.');
}
// schedule daily reset at midnight server time with node-cron
cron.schedule('0 0 * * *', () => {
  try { resetDailyConsumption(); } catch (e) { console.error(e); }
}, { timezone: 'UTC' }); // change timezone if needed

// routes
app.post('/login', (req, res) => {
  const { deviceId } = req.body;
  const id = deviceId || Math.random().toString(36).slice(2,8).toUpperCase();
  if (!users[id]) users[id] = { id, role: 'user', warnings:0, banned:false, connected:true, consumptionLitres:0, token: genToken() };
  users[id].connected = true;
  res.json({ ok:true, id: users[id].id, role: users[id].role, token: users[id].token, consumptionLitres: users[id].consumptionLitres });
});

app.post('/modes/verify', (req,res) => {
  const { mode, password, deviceId } = req.body;
  if (!deviceId) return res.json({ ok:false, error:'no-device' });
  if (!users[deviceId]) return res.json({ ok:false, error:'unknown-user' });
  // anciens mots de passe (remplacer si tu veux)
  const OLD_PROF = "sinonAnanasAIneserapascontent2026!";
  const OLD_ADMIN = "situestristeBenjaBabynepleurepas2026?";
  if (mode === 'Professeur' && password === OLD_PROF) { users[deviceId].role = 'professeur'; return res.json({ ok:true, role:'professeur' }); }
  if (mode === 'Admin' && password === OLD_ADMIN) { users[deviceId].role = 'admin'; return res.json({ ok:true, role:'admin' }); }
  return res.json({ ok:false });
});

app.get('/users', ensureAdmin, (req,res) => res.json(Object.values(users)));
app.get('/adminlogs', ensureAdmin, (req,res) => res.json(adminLogs));

app.post('/newConversation', (req,res) => {
  const { user } = req.body; if (!user) return res.json({ ok:false });
  const id = Date.now().toString();
  if (!conversations[user]) conversations[user] = [];
  conversations[user].push({ id, title:'Nouvelle conversation', messages: [] });
  res.json({ ok:true, id });
});

app.get('/conversations/:user', (req,res) => {
  res.json(conversations[req.params.user] || []);
});

app.post('/chat', async (req,res) => {
  try {
    const { user, message, mode } = req.body;
    if (!user) return res.json({ reply: 'Utilisateur inconnu' });
    if (!users[user]) users[user] = { id:user, role:'user', warnings:0, banned:false, connected:true, consumptionLitres:0, token: genToken() };
    if (users[user].banned) return res.json({ reply: 'Banni' });
    // simple moderation example
    const blacklist = ['pute','insulte1','motinterdit'];
    if (blacklist.some(w => (message||'').toLowerCase().includes(w))) { users[user].banned = true; adminLogs.push({ type:'auto-ban', user, date:Date.now() }); return res.json({ reply:'Message inapproprié — banni.' }); }
    if (!memories[user]) memories[user] = [];
    memories[user].push({ role:'user', content: message });

    let reply = "🥑 Je ne peux pas répondre (API non configurée).";
    if (openai) {
      const systemPrompt = (mode === 'Kids') ? 'Explique simplement.' : (mode === 'Collégien') ? 'Aide un collégien.' : 'Tu es Aguacate AI.';
      const response = await openai.chat.completions.create({
        model: 'openrouter/auto',
        messages: [{ role:'system', content: systemPrompt }, ...memories[user].slice(-15)]
      });
      reply = response.choices?.[0]?.message?.content || reply;
    }
    memories[user].push({ role:'assistant', content: reply });
    // save conversation
    if (!conversations[user]) conversations[user] = [];
    if (!conversations[user].length) conversations[user].push({ id: Date.now().toString(), title:'Conversation', messages: [] });
    const lastConv = conversations[user][conversations[user].length -1];
    lastConv.messages.push({ role:'user', content: message, date:Date.now() });
    lastConv.messages.push({ role:'assistant', content: reply, date:Date.now() });
    // water consumption simple model
    const extra = 1 + Math.floor((reply.length || 0) / 200);
    users[user].consumptionLitres = (users[user].consumptionLitres || 0) + extra;
    res.json({ reply, consumptionLitres: users[user].consumptionLitres });
  } catch (err) {
    console.error(err);
    res.json({ reply: '🥑 Une erreur est survenue.' });
  }
});

// Simple image generate (requires OPENAI_API_KEY)
app.post('/images/generate', async (req,res) => {
  if (!openai) return res.status(400).json({ ok:false, error:'no_api' });
  const { prompt } = req.body; if (!prompt) return res.status(400).json({ ok:false, error:'no-prompt' });
  try {
    const imageRes = await openai.images.generate({ model:'stable-diffusion', prompt });
    const url = imageRes.data?.[0]?.url || null;
    res.json({ ok:true, url });
  } catch(e) {
    console.error(e); res.status(500).json({ ok:false, error:'image_failed' });
  }
});

// endpoint reset secured (RESET_SECRET must be set or secret file present)
app.post('/internal/reset-consumption', (req,res) => {
  const provided = req.headers['x-admin-secret'] || req.query.secret;
  if (!RESET_SECRET || !provided || provided !== RESET_SECRET) return res.status(403).json({ ok:false, error:'forbidden' });
  try { resetDailyConsumption(); return res.json({ ok:true }); } catch(e) { console.error(e); return res.status(500).json({ ok:false, error:'error' }); }
});

app.listen(PORT, ()=>console.log(`Aguacate AI listening on ${PORT}`));
