// server.js
// Aguacate AI - backend minimal & robuste
// - No heavy native deps
// - Token auth, roles, admin protection
// - Chat (uses OpenAI if OPENAI_API_KEY set), conversations, users, admin logs
// - Reset consumption function + endpoint /internal/reset-consumption (use RESET_SECRET or secret file)

const express = require('express');
const { OpenAI } = require('openai');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const SCAN_MAX_FILE_MB = Number(process.env.SCAN_MAX_FILE_MB || 10);

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
  openai = new OpenAI({ apiKey: OPENAI_API_KEY, ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}) });
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


// Free file scanner: extraction happens locally/server-side; no binary file is sent to an AI vision/file API.
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

const TEXT_MIMES = new Set(['text/plain','text/markdown','text/csv','application/json']);
const DOCUMENT_MIMES = new Set([
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]);

const freeScanUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SCAN_MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (DOCUMENT_MIMES.has(file.mimetype)) return cb(null, true);
    cb(new Error('type-non-supporte'));
  }
});

function cleanExtractedText(text) {
  return String(text || '')
    .replace(/\\u0000/g, '')
    .replace(/[\\t ]{3,}/g, ' ')
    .replace(/\\n{4,}/g, '\\n\\n')
    .trim()
    .slice(0, 60000);
}

async function extractDocumentText(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (TEXT_MIMES.has(file.mimetype) || ['.txt','.md','.csv','.json'].includes(ext)) {
    return cleanExtractedText(file.buffer.toString('utf8'));
  }
  if (file.mimetype === 'application/pdf' || ext === '.pdf') {
    const parsed = await pdfParse(file.buffer);
    return cleanExtractedText(parsed.text);
  }
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return cleanExtractedText(result.value);
  }
  if (['.xlsx','.xls'].includes(ext) || file.mimetype.includes('spreadsheet')) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
    const parts = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      return `Feuille: ${name}\\n${XLSX.utils.sheet_to_csv(sheet)}`;
    });
    return cleanExtractedText(parts.join('\\n\\n'));
  }
  if (file.mimetype === 'application/msword' || ext === '.doc') {
    throw new Error('doc-non-supporte');
  }
  throw new Error('type-non-supporte');
}

app.post('/analyze-file', ensureAuth, freeScanUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok:false, error:'Aucun fichier fourni' });
    const mode = String(req.body?.mode || 'Kids');
    const prompt = String(req.body?.prompt || 'Analyse ce fichier et explique-moi clairement ce qu’il contient.').slice(0, 4000);

    const extracted = await extractDocumentText(req.file);
    if (!extracted) {
      return res.status(422).json({ ok:false, error:'Aucun texte exploitable n’a été trouvé dans ce fichier.' });
    }
    if (!openai) {
      return res.json({
        ok:true,
        reply:`📄 Texte extrait gratuitement de « ${req.file.originalname} » :\\n\\n${extracted.slice(0,12000)}`,
        filename:req.file.originalname,
        extractedText:extracted,
        scanCost:'0€ (extraction locale)'
      });
    }

    const systemPrompt = scanModePrompt(mode) + '\\nLe texte ci-dessous a été extrait d’un fichier. Base-toi uniquement sur ce texte et indique si une information manque ou semble incertaine.';
    const response = await openai.chat.completions.create({
      model: 'openrouter/auto',
      messages: [
        { role:'system', content:systemPrompt },
        { role:'user', content:`${prompt}\\n\\n--- CONTENU DU FICHIER ---\\n${extracted}` }
      ]
    });
    const reply = response.choices?.[0]?.message?.content || '🥑 Je n’ai pas réussi à analyser ce fichier.';
    res.json({ ok:true, reply, filename:req.file.originalname, scanCost:'0€ pour l’extraction', extractedChars:extracted.length });
  } catch (e) {
    console.error('[free-scanner]', e);
    let message = 'Impossible de lire ce fichier.';
    if (e.message === 'type-non-supporte') message = 'Type de fichier non supporté.';
    if (e.message === 'doc-non-supporte') message = 'Les anciens fichiers .doc ne sont pas encore pris en charge. Enregistre-les en .docx pour les analyser gratuitement.';
    if (e.message === 'Password is required to decrypt PDF') message = 'Ce PDF est protégé par mot de passe et ne peut pas être lu.';
    res.status(400).json({ ok:false, error:message });
  }
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
