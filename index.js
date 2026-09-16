// =========================================================
// AGUACATE AI v4.0.0
// INDEX.JS — BACKEND COMPLET CORRIGÉ
// =========================================================

'use strict';

const express = require('express');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const rateLimit = require('express-rate-limit');

const app = express();


// =========================================================
// CONFIGURATION SERVEUR
// =========================================================

const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;

const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'aguacate-data.json');

fs.mkdirSync(DATA_DIR, { recursive: true });


// =========================================================
// IMPORTANT POUR RENDER
// =========================================================

// Render est derrière un proxy.
// Sans cette ligne express-rate-limit détecte
// X-Forwarded-For comme une mauvaise configuration.

app.set('trust proxy', 1);


// =========================================================
// MIDDLEWARES
// =========================================================

app.use(express.json({
  limit: '1mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '1mb'
}));

app.use(express.static(ROOT));


// =========================================================
// CONFIGURATION IA
// =========================================================

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || '';

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || '';

const AI_BASE_URL =
  process.env.AI_BASE_URL ||
  (
    OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1'
  );

const USING_OPENROUTER =
  AI_BASE_URL.includes('openrouter.ai') ||
  Boolean(OPENROUTER_API_KEY);

const AI_API_KEY =
  OPENROUTER_API_KEY ||
  OPENAI_API_KEY;

const AI_MODEL =
  process.env.AI_MODEL ||
  (
    USING_OPENROUTER
      ? 'openrouter/auto'
      : 'gpt-5.5'
  );


// =========================================================
// AUTRES CONFIGURATIONS
// =========================================================

const MAX_FILE_MB = Math.max(
  1,
  Math.min(
    15,
    Number(process.env.MAX_FILE_MB || 10)
  )
);

const ECO_MAX_LITRES = Math.max(
  1,
  Number(
    process.env.ECOGUACATE_MAX_LITRES || 24.8
  )
);

const ONLINE_TIMEOUT_MS =
  90 * 1000;

const RECENT_WINDOW_MS =
  24 * 60 * 60 * 1000;


// =========================================================
// CLIENT OPENAI / OPENROUTER
// =========================================================

const openai = AI_API_KEY
  ? new OpenAI({
      apiKey: AI_API_KEY,
      baseURL: AI_BASE_URL,

      timeout: 60_000,

      maxRetries: 1,

      defaultHeaders:
        USING_OPENROUTER
          ? {
              'HTTP-Referer':
                process.env.APP_URL ||
                'https://aguacate-ai.onrender.com',

              'X-Title':
                'Aguacate AI v4.0.0'
            }
          : undefined
    })
  : null;


// =========================================================
// UPLOADS
// =========================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize:
      MAX_FILE_MB * 1024 * 1024
  }
});


// =========================================================
// DONNÉES
// =========================================================

const DEFAULT_DATA = {
  users: {},
  conversations: {},
  memories: {},
  adminLogs: []
};

let data = loadData();


// =========================================================
// FONCTIONS DONNÉES
// =========================================================

function loadData() {

  try {

    if (
      fs.existsSync(DATA_FILE)
    ) {

      const parsed =
        JSON.parse(
          fs.readFileSync(
            DATA_FILE,
            'utf8'
          )
        );

      return {
        ...DEFAULT_DATA,
        ...parsed
      };
    }

  } catch (error) {

    console.error(
      '[data] lecture impossible:',
      error.message
    );
  }

  return JSON.parse(
    JSON.stringify(DEFAULT_DATA)
  );
}


function saveData() {

  try {

    const tmp =
      DATA_FILE + '.tmp';

    fs.writeFileSync(
      tmp,
      JSON.stringify(data),
      'utf8'
    );

    fs.renameSync(
      tmp,
      DATA_FILE
    );

  } catch (error) {

    console.error(
      '[data] sauvegarde impossible:',
      error.message
    );
  }
}


// =========================================================
// UTILITAIRES
// =========================================================

function now() {
  return Date.now();
}


function genToken() {

  return crypto
    .randomBytes(32)
    .toString('hex');
}


function genUserId() {

  let id;

  do {

    id = String(
      Math.floor(
        1000 +
        Math.random() * 9000
      )
    );

  } while (
    Object.values(data.users)
      .some(
        user =>
          user.id === id
      )
  );

  return id;
}


function safeText(
  value,
  max = 30000
) {

  return typeof value === 'string'
    ? value.slice(0, max)
    : '';
}


function hashPassword(value) {

  return crypto
    .createHash('sha256')
    .update(
      String(value || '')
    )
    .digest('hex');
}


function passwordMatches(
  provided,
  configured
) {

  if (
    !configured ||
    !provided
  ) {
    return false;
  }

  const a =
    Buffer.from(
      hashPassword(provided)
    );

  const b =
    Buffer.from(
      hashPassword(configured)
    );

  return crypto.timingSafeEqual(
    a,
    b
  );
}


// =========================================================
// UTILISATEURS
// =========================================================

function userRecord(id) {

  if (!data.users[id]) {

    data.users[id] = {

      id,

      role: 'user',

      warnings: [],

      bannedUntil: 0,

      connected: false,

      lastSeen: 0,

      token: genToken(),

      sessionVersion: 1,

      consumptionLitres: 0,

      createdAt: now()
    };

    saveData();
  }

  return data.users[id];
}


function isBanned(user) {

  return Number(
    user.bannedUntil || 0
  ) > now();
}


function isOnline(user) {

  return (
    !!user.connected &&
    !!user.lastSeen &&
    now() - user.lastSeen <
      ONLINE_TIMEOUT_MS &&
    !isBanned(user)
  );
}


function publicUser(user) {

  const {
    token,
    ...safe
  } = user;

  return {
    ...safe,
    online: isOnline(user)
  };
}


// =========================================================
// BANNISSEMENT
// =========================================================

function banFor24h(
  user,
  reason,
  by = 'system'
) {

  user.bannedUntil =
    now() +
    24 * 60 * 60 * 1000;

  user.connected = false;

  user.sessionVersion =
    (user.sessionVersion || 1) + 1;

  user.token =
    genToken();

  data.adminLogs.push({

    type: 'ban',

    reason,

    user: user.id,

    by,

    date: now(),

    until:
      user.bannedUntil
  });

  saveData();
}


// =========================================================
// AVERTISSEMENTS
// =========================================================

function addWarning(
  user,
  reason,
  by = 'admin'
) {

  const item = {

    id:
      crypto
        .randomBytes(5)
        .toString('hex'),

    reason:
      safeText(
        reason,
        300
      ),

    date:
      now(),

    by
  };

  if (
    !Array.isArray(
      user.warnings
    )
  ) {

    user.warnings = [];
  }

  user.warnings.push(item);

  data.adminLogs.push({

    type: 'warning',

    user: user.id,

    by,

    reason: item.reason,

    warningNumber:
      user.warnings.length,

    date:
      item.date
  });

  // IMPORTANT :
  // Le bannissement se produit seulement
  // à partir du 3e avertissement.
  if (
    user.warnings.length >= 3 &&
    !isBanned(user)
  ) {

    banFor24h(
      user,
      `Avertissement n°${user.warnings.length}`,
      by
    );
  }

  saveData();

  return item;
}


function removeWarning(
  user,
  warningId
) {

  const before =
    Array.isArray(user.warnings)
      ? user.warnings.length
      : 0;

  user.warnings =
    (
      user.warnings || []
    ).filter(
      warning =>
        warning.id !== warningId
    );

  if (
    before !==
    user.warnings.length
  ) {

    if (!isBanned(user)) {
      user.bannedUntil = 0;
    }

    data.adminLogs.push({

      type:
        'warning-removed',

      user:
        user.id,

      warningId,

      date:
        now()
    });

    saveData();

    return true;
  }

  return false;
}


// =========================================================
// AUTHENTIFICATION
// =========================================================

function getUserFromRequest(req) {

  const auth =
    req.headers.authorization || '';

  const token =
    auth.startsWith('Bearer ')
      ? auth.slice(7)
      : (
          req.query.token ||
          req.body?.token
        );

  if (!token) {
    return null;
  }

  return Object.values(
    data.users
  ).find(
    user =>
      user.token === token
  ) || null;
}


function ensureAuth(
  req,
  res,
  next
) {

  const user =
    getUserFromRequest(req);

  if (!user) {

    return res
      .status(401)
      .json({
        ok: false,
        error: 'unauthenticated'
      });
  }

  if (isBanned(user)) {

    return res
      .status(403)
      .json({
        ok: false,
        error: 'banned',
        bannedUntil:
          user.bannedUntil
      });
  }

  user.connected = true;
  user.lastSeen = now();

  req.authUser = user;

  next();
}


function ensureAdmin(
  req,
  res,
  next
) {

  ensureAuth(
    req,
    res,
    () => {

      if (
        req.authUser.role !==
        'admin'
      ) {

        return res
          .status(403)
          .json({
            ok: false,
            error: 'forbidden'
          });
      }

      next();
    }
  );
}


function ensureProfessor(
  req,
  res,
  next
) {

  ensureAuth(
    req,
    res,
    () => {

      if (
        ![
          'professeur',
          'admin'
        ].includes(
          req.authUser.role
        )
      ) {

        return res
          .status(403)
          .json({
            ok: false,
            error: 'forbidden'
          });
      }

      next();
    }
  );
}


// =========================================================
// CONSOMMATION ÉCOGUACATE
// =========================================================

function resetDailyConsumption() {

  Object.values(
    data.users
  ).forEach(
    user => {
      user.consumptionLitres = 0;
    }
  );

  data.adminLogs.push({

    type:
      'reset-consumption',

    date:
      now()
  });

  saveData();
}


function scheduleReset() {

  const current =
    new Date();

  const next =
    new Date(current);

  next.setHours(
    24,
    0,
    0,
    0
  );

  const delay =
    Math.max(
      1000,
      next - current + 1000
    );

  setTimeout(
    () => {

      resetDailyConsumption();

      setInterval(
        resetDailyConsumption,
        86400000
      );

    },
    delay
  );
}


scheduleReset();


// Vérification des utilisateurs en ligne
setInterval(
  () => {

    Object.values(
      data.users
    ).forEach(
      user => {

        if (
          user.connected &&
          now() -
            user.lastSeen >
            ONLINE_TIMEOUT_MS
        ) {

          user.connected = false;
        }
      }
    );

    saveData();

  },
  30000
);


// =========================================================
// RATE LIMIT
// =========================================================

const chatLimiter =
  rateLimit({

    windowMs:
      60 * 1000,

    max: 30,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      ok: false,
      error: 'rate-limit',
      message:
        'Trop de messages envoyés. Attends quelques secondes.'
    }
  });


// =========================================================
// MODÉRATION
// =========================================================

const GROSS_WORD_PATTERNS = [

  /\b(?:putain|merde|connard|connasse|encule|enculé|salope|fdp|nique|niquer)\b/i,

  /\b(?:fuck|shit|bitch|asshole)\b/i
];


function containsGrossLanguage(
  text
) {

  return GROSS_WORD_PATTERNS
    .some(
      pattern =>
        pattern.test(text)
    );
}


function moderationHit(
  user,
  message
) {

  if (
    !containsGrossLanguage(
      message
    )
  ) {

    return false;
  }

  // IMPORTANT :
  // Un message interdit crée seulement
  // UN avertissement.
  //
  // addWarning() s'occupe lui-même du
  // bannissement au 3e avertissement.

  addWarning(
    user,
    'Langage grossier détecté automatiquement',
    'system'
  );

  return true;
}


// =========================================================
// HEALTH CHECK
// =========================================================

app.get(
  '/health',
  (req, res) => {

    res.json({

      ok: true,

      version:
        '4.0.0',

      ai:
        !!openai,

      provider:
        USING_OPENROUTER
          ? 'openrouter'
          : 'openai',

      model:
        AI_MODEL,

      baseURL:
        AI_BASE_URL,

      ecoMaxLitres:
        ECO_MAX_LITRES
    });
  }
);


// =========================================================
// LOGIN
// =========================================================

app.post(
  '/login',
  (req, res) => {

    const requested =
      String(
        req.body.deviceId || ''
      ).slice(0, 64);

    const id =
      requested &&
      data.users[requested]
        ? requested
        : (
            requested ||
            genUserId()
          );

    const user =
      userRecord(id);

    if (
      isBanned(user)
    ) {

      return res
        .status(403)
        .json({

          ok: false,

          error:
            'banned',

          bannedUntil:
            user.bannedUntil
        });
    }

    user.connected = true;
    user.lastSeen = now();
    user.token = genToken();

    user.sessionVersion =
      (user.sessionVersion || 1) + 1;

    data.adminLogs.push({

      type:
        'login',

      user:
        user.id,

      date:
        now()
    });

    saveData();

    res.json({

      ok: true,

      id:
        user.id,

      role:
        user.role,

      token:
        user.token,

      consumptionLitres:
        user.consumptionLitres || 0,

      ecoMaxLitres:
        ECO_MAX_LITRES,

      version:
        '4.0.0'
    });
  }
);


// =========================================================
// HEARTBEAT
// =========================================================

app.post(
  '/heartbeat',
  ensureAuth,
  (req, res) => {

    req.authUser.connected = true;

    req.authUser.lastSeen =
      now();

    saveData();

    res.json({
      ok: true,
      online: true
    });
  }
);


// =========================================================
// LOGOUT
// =========================================================

app.post(
  '/logout',
  ensureAuth,
  (req, res) => {

    req.authUser.connected =
      false;

    req.authUser.lastSeen =
      now();

    saveData();

    res.json({
      ok: true
    });
  }
);


// =========================================================
// MODES PROFESSEUR / ADMIN
// =========================================================

app.post(
  '/modes/verify',
  ensureAuth,
  (req, res) => {

    const mode =
      safeText(
        req.body.mode,
        30
      );

    const password =
      String(
        req.body.password || ''
      );

    const user =
      req.authUser;

    if (
      mode === 'Professeur' &&
      passwordMatches(
        password,
        process.env.PROFESSOR_PASSWORD
      )
    ) {

      user.role =
        'professeur';

      saveData();

      return res.json({
        ok: true,
        role: user.role
      });
    }

    if (
      mode === 'Admin' &&
      passwordMatches(
        password,
        process.env.ADMIN_PASSWORD
      )
    ) {

      user.role =
        'admin';

      saveData();

      return res.json({
        ok: true,
        role: user.role
      });
    }

    return res
      .status(401)
      .json({
        ok: false,
        error:
          'invalid-password'
      });
  }
);


// =========================================================
// ADMIN — UTILISATEURS
// =========================================================

app.get(
  '/users',
  ensureAdmin,
  (req, res) => {

    res.json(
      Object.values(
        data.users
      )
      .map(publicUser)
      .sort(
        (a, b) =>
          Number(b.lastSeen || 0) -
          Number(a.lastSeen || 0)
      )
    );
  }
);


app.get(
  '/users/online',
  ensureAdmin,
  (req, res) => {

    res.json(
      Object.values(
        data.users
      )
      .filter(isOnline)
      .map(publicUser)
    );
  }
);


app.get(
  '/users/recent',
  ensureAdmin,
  (req, res) => {

    res.json(
      Object.values(
        data.users
      )
      .filter(
        user =>
          user.lastSeen &&
          now() -
            user.lastSeen <=
            RECENT_WINDOW_MS
      )
      .map(publicUser)
      .sort(
        (a, b) =>
          b.lastSeen -
          a.lastSeen
      )
    );
  }
);


// =========================================================
// ADMIN — DÉCONNEXION
// =========================================================

app.post(
  '/users/:id/disconnect',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {

      return res
        .status(404)
        .json({
          ok: false,
          error: 'not-found'
        });
    }

    user.connected =
      false;

    user.lastSeen =
      now();

    user.sessionVersion =
      (user.sessionVersion || 1) + 1;

    user.token =
      genToken();

    data.adminLogs.push({

      type:
        'disconnect',

      user:
        user.id,

      by:
        req.authUser.id,

      date:
        now()
    });

    saveData();

    res.json({
      ok: true
    });
  }
);


// =========================================================
// ADMIN — BAN
// =========================================================

app.post(
  '/users/:id/ban',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {

      return res
        .status(404)
        .json({
          ok: false,
          error: 'not-found'
        });
    }

    banFor24h(
      user,
      safeText(
        req.body.reason ||
        'Bannissement manuel',
        300
      ),
      req.authUser.id
    );

    res.json({

      ok: true,

      bannedUntil:
        user.bannedUntil
    });
  }
);


// =========================================================
// ADMIN — UNBAN
// =========================================================

app.post(
  '/users/:id/unban',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {

      return res
        .status(404)
        .json({
          ok: false,
          error: 'not-found'
        });
    }

    user.bannedUntil =
      0;

    data.adminLogs.push({

      type:
        'unban',

      user:
        user.id,

      by:
        req.authUser.id,

      date:
        now()
    });

    saveData();

    res.json({
      ok: true
    });
  }
);


// =========================================================
// ADMIN — AVERTISSEMENT
// =========================================================

app.post(
  '/users/:id/warnings',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {

      return res
        .status(404)
        .json({
          ok: false,
          error: 'not-found'
        });
    }

    const warning =
      addWarning(
        user,
        req.body.reason ||
          'Avertissement administrateur',
        req.authUser.id
      );

    res.json({

      ok: true,

      warning,

      warnings:
        user.warnings,

      bannedUntil:
        user.bannedUntil || 0
    });
  }
);


// =========================================================
// ADMIN — SUPPRESSION AVERTISSEMENT
// =========================================================

app.delete(
  '/users/:id/warnings/:warningId',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {

      return res
        .status(404)
        .json({
          ok: false,
          error: 'not-found'
        });
    }

    const ok =
      removeWarning(
        user,
        String(
          req.params.warningId
        )
      );

    res.json({
      ok
    });
  }
);


// =========================================================
// ADMIN — LOGS
// =========================================================

app.get(
  '/adminlogs',
  ensureAdmin,
  (req, res) => {

    res.json(
      data.adminLogs
        .slice(-500)
        .reverse()
    );
  }
);


// =========================================================
// ADMIN — CONVERSATIONS
// =========================================================

app.get(
  '/admin/conversations',
  ensureAdmin,
  (req, res) => {

    const result =
      Object.entries(
        data.conversations
      )
      .map(
        ([userId, conversations]) => ({
          userId,
          conversations
        })
      )
      .filter(
        item =>
          item.conversations.length
      );

    res.json(result);
  }
);


app.get(
  '/admin/conversations/:userId',
  ensureAdmin,
  (req, res) => {

    res.json(
      data.conversations[
        String(req.params.userId)
      ] || []
    );
  }
);


// =========================================================
// CONVERSATIONS
// =========================================================

function createConversation(
  userId
) {

  const id =
    Date.now().toString(36) +
    crypto
      .randomBytes(3)
      .toString('hex');

  if (
    !data.conversations[userId]
  ) {

    data.conversations[userId] =
      [];
  }

  const conversation = {

    id,

    title:
      'Nouvelle conversation',

    messages: [],

    createdAt:
      now(),

    updatedAt:
      now()
  };

  data.conversations[userId]
    .push(conversation);

  return conversation;
}


app.post(
  '/newConversation',
  ensureAuth,
  (req, res) => {

    const userId =
      req.authUser.id;

    const conversation =
      createConversation(
        userId
      );

    saveData();

    res.json({

      ok: true,

      id:
        conversation.id,

      conversations:
        data.conversations[userId]
    });
  }
);


app.get(
  '/conversations',
  ensureAuth,
  (req, res) => {

    res.json(
      data.conversations[
        req.authUser.id
      ] || []
    );
  }
);


// =========================================================
// RENOMMER
// =========================================================

app.post(
  '/renameConversation',
  ensureAuth,
  (req, res) => {

    const userId =
      req.authUser.id;

    const id =
      String(
        req.body.conversationId || ''
      );

    const title =
      safeText(
        req.body.title ||
          'Nouvelle conversation',
        80
      ).trim();

    const conversation =
      (
        data.conversations[
          userId
        ] || []
      )
      .find(
        item =>
          item.id === id
      );

    if (!conversation) {

      return res
        .status(404)
        .json({
          ok: false,
          error: 'not-found'
        });
    }

    conversation.title =
      title ||
      'Nouvelle conversation';

    conversation.updatedAt =
      now();

    saveData();

    res.json({

      ok: true,

      conversation
    });
  }
);


// =========================================================
// SUPPRIMER
// =========================================================

app.post(
  '/deleteConversation',
  ensureAuth,
  (req, res) => {

    const userId =
      req.authUser.id;

    const id =
      String(
        req.body.conversationId || ''
      );

    data.conversations[userId] =
      (
        data.conversations[userId] ||
        []
      )
      .filter(
        conversation =>
          conversation.id !== id
      );

    saveData();

    res.json({

      ok: true,

      conversations:
        data.conversations[
          userId
        ]
    });
  }
);


// =========================================================
// IA
// =========================================================

async function askAI(
  messages
) {

  if (!openai) {

    throw new Error(
      'Aucune clé IA configurée. ' +
      'Ajoute OPENROUTER_API_KEY ou OPENAI_API_KEY dans Render.'
    );
  }

  console.log(
    '[AI] Requête envoyée',
    {
      provider:
        USING_OPENROUTER
          ? 'OpenRouter'
          : 'OpenAI',

      model:
        AI_MODEL,

      messages:
        messages.length
    }
  );

  const response =
    await openai.chat.completions.create({

      model:
        AI_MODEL,

      messages,

      temperature:
        0.7
    });

  const reply =
    response
      ?.choices?.[0]
      ?.message?.content;

  if (
    typeof reply !== 'string' ||
    !reply.trim()
  ) {

    throw new Error(
      `Réponse IA vide. Modèle utilisé : ${AI_MODEL}`
    );
  }

  return reply.trim();
}


// =========================================================
// CHAT
// =========================================================

app.post(
  '/chat',
  chatLimiter,
  ensureAuth,
  async (req, res) => {

    try {

      const user =
        req.authUser;

      const message =
        safeText(
          req.body.message
        ).trim();

      const mode =
        safeText(
          req.body.mode
        ) || 'Kids';

      const conversationId =
        String(
          req.body.conversationId || ''
        );


      if (!message) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              'empty-message'
          });
      }


      // -----------------------------------------------------
      // MODÉRATION
      // -----------------------------------------------------

      if (
        moderationHit(
          user,
          message
        )
      ) {

        return res
          .status(403)
          .json({

            ok: false,

            error:
              'moderation-warning',

            warnings:
              user.warnings?.length ||
              0,

            bannedUntil:
              user.bannedUntil ||
              0,

            message:
              isBanned(user)
                ? 'Ton accès a été suspendu pendant 24 heures.'
                : 'Ton message contient un langage interdit. Un avertissement a été ajouté.'
          });
      }


      // -----------------------------------------------------
      // MÉMOIRE
      // -----------------------------------------------------

      if (
        !data.memories[user.id]
      ) {

        data.memories[user.id] =
          [];
      }


      let system;

      if (
        mode === 'Kids'
      ) {

        system =
          'Tu es Aguacate AI. ' +
          'Explique avec des mots simples, adaptés à un enfant, ' +
          'sans être infantilisant.';

      } else if (
        mode === 'Collégien'
      ) {

        system =
          'Tu es Aguacate AI, ' +
          'un assistant pédagogique pour collégien. ' +
          'Explique clairement et aide à raisonner.';

      } else if (
        mode === 'Professeur'
      ) {

        system =
          'Tu es Aguacate AI, ' +
          'assistant pédagogique pour enseignants. ' +
          'Sois structuré et précis.';

      } else {

        system =
          'Tu es Aguacate AI, ' +
          'un assistant polyvalent. ' +
          'Réponds clairement en français.';
      }


      data.memories[user.id]
        .push({
          role:
            'user',

          content:
            message
        });


      // -----------------------------------------------------
      // APPEL IA
      // -----------------------------------------------------

      const reply =
        await askAI([

          {
            role:
              'system',

            content:
              system
          },

          ...data
            .memories[user.id]
            .slice(-16)
        ]);


      data.memories[user.id]
        .push({

          role:
            'assistant',

          content:
            reply
        });


      // -----------------------------------------------------
      // CONVERSATION
      // -----------------------------------------------------

      if (
        !data.conversations[user.id]
      ) {

        data.conversations[user.id] =
          [];
      }


      let conversation =
        data.conversations[user.id]
          .find(
            item =>
              item.id ===
              conversationId
          );


      // Si le frontend n'a pas envoyé d'id
      // ou si l'id n'existe plus,
      // on utilise la dernière conversation.

      if (!conversation) {

        const list =
          data.conversations[user.id];

        conversation =
          list[list.length - 1];
      }


      if (!conversation) {

        conversation =
          createConversation(
            user.id
          );
      }


      conversation.messages.push(

        {
          role:
            'user',

          content:
            message,

          date:
            now()
        },

        {
          role:
            'assistant',

          content:
            reply,

          date:
            now()
        }

      );


      conversation.updatedAt =
        now();


      // -----------------------------------------------------
      // ÉCOGUACATE
      // -----------------------------------------------------

      user.consumptionLitres =
        Number(
          (
            (
              user.consumptionLitres ||
              0
            ) +
            (
              1 +
              Math.floor(
                reply.length / 200
              )
            )
          ).toFixed(1)
        );


      user.lastSeen =
        now();

      user.connected =
        true;


      saveData();


      res.json({

        ok: true,

        reply,

        conversationId:
          conversation.id,

        consumptionLitres:
          user.consumptionLitres,

        ecoMaxLitres:
          ECO_MAX_LITRES
      });

    } catch (error) {

      console.error(
        '[chat] ERREUR IA',
        {
          name:
            error?.name,

          message:
            error?.message,

          status:
            error?.status,

          code:
            error?.code,

          type:
            error?.type,

          model:
            AI_MODEL,

          baseURL:
            AI_BASE_URL,

          provider:
            USING_OPENROUTER
              ? 'openrouter'
              : 'openai'
        }
      );


      res
        .status(502)
        .json({

          ok: false,

          error:
            'ai-error',

          message:
            '🥑 Le service IA ne répond pas correctement. Vérifie la clé API, le modèle et la configuration IA dans Render.'
        });
    }
  }
);


// =========================================================
// LECTURE DES FICHIERS
// =========================================================

function extractText(
  file
) {

  const ext =
    path
      .extname(
        file.originalname
      )
      .toLowerCase();


  if (
    [
      '.txt',
      '.md',
      '.csv',
      '.json',
      '.xml'
    ].includes(ext)
  ) {

    return Promise.resolve(
      file.buffer
        .toString('utf8')
        .slice(0, 50000)
    );
  }


  if (
    ext === '.pdf'
  ) {

    return pdfParse(
      file.buffer
    )
    .then(
      result =>
        result.text
          .slice(0, 50000)
    );
  }


  if (
    ext === '.docx'
  ) {

    return mammoth
      .extractRawText({
        buffer:
          file.buffer
      })
      .then(
        result =>
          result.value
            .slice(0, 50000)
      );
  }


  if (
    [
      '.xlsx',
      '.xls'
    ].includes(ext)
  ) {

    const workbook =
      XLSX.read(
        file.buffer,
        {
          type:
            'buffer'
        }
      );

    return Promise.resolve(

      workbook
        .SheetNames
        .map(
          name =>
            `[${name}]\n` +
            XLSX.utils.sheet_to_csv(
              workbook.Sheets[name]
            )
        )
        .join('\n\n')
        .slice(0, 50000)

    );
  }


  return Promise.reject(
    new Error(
      'unsupported-type'
    )
  );
}


const ALLOWED_EXT = [

  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.xml',
  '.xlsx',
  '.xls'

];


// =========================================================
// SCAN
// =========================================================

app.post(
  '/scan',
  ensureAuth,
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              'no-file'
          });
      }


      const ext =
        path
          .extname(
            req.file.originalname
          )
          .toLowerCase();


      if (
        !ALLOWED_EXT.includes(
          ext
        )
      ) {

        return res
          .status(415)
          .json({
            ok: false,
            error:
              'unsupported-type'
          });
      }


      const text =
        await extractText(
          req.file
        );


      res.json({

        ok: true,

        fileName:
          req.file.originalname,

        fileType:
          ext.slice(1),

        characters:
          text.length,

        text
      });

    } catch (error) {

      console.error(
        '[scan]',
        error
      );

      res
        .status(500)
        .json({

          ok: false,

          error:
            'scan-error',

          message:
            'Impossible de lire ce fichier.'
        });
    }
  }
);


// =========================================================
// SCAN + IA
// =========================================================

app.post(
  '/scan-and-ask',
  chatLimiter,
  ensureAuth,
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              'no-file'
          });
      }


      const ext =
        path
          .extname(
            req.file.originalname
          )
          .toLowerCase();


      if (
        !ALLOWED_EXT.includes(
          ext
        )
      ) {

        return res
          .status(415)
          .json({
            ok: false,
            error:
              'unsupported-type'
          });
      }


      const text =
        await extractText(
          req.file
        );


      const question =
        safeText(
          req.body.question ||
          'Analyse ce fichier et résume les points importants.'
        );


      const reply =
        await askAI([

          {
            role:
              'system',

            content:
              'Tu es Aguacate AI. ' +
              'Analyse uniquement le contenu fourni. ' +
              'Réponds clairement en français.'
          },

          {
            role:
              'user',

            content:
              `Fichier : ${req.file.originalname}\n\n` +
              `Contenu :\n${text}\n\n` +
              `Question :\n${question}`
          }

        ]);


      const userId =
        req.authUser.id;


      if (
        !data.conversations[userId]
      ) {

        data.conversations[userId] =
          [];
      }


      let conversation =
        data.conversations[userId]
          .at(-1);


      if (!conversation) {

        conversation =
          createConversation(
            userId
          );
      }


      conversation.messages.push(

        {
          role:
            'user',

          content:
            `📎 ${req.file.originalname}\n${question}`,

          date:
            now()
        },

        {
          role:
            'assistant',

          content:
            reply,

          date:
            now()
        }

      );


      conversation.updatedAt =
        now();


      req.authUser.lastSeen =
        now();

      req.authUser.connected =
        true;


      saveData();


      res.json({

        ok: true,

        reply,

        fileName:
          req.file.originalname,

        characters:
          text.length
      });

    } catch (error) {

      console.error(
        '[scan-and-ask]',
        {
          name:
            error?.name,

          message:
            error?.message,

          status:
            error?.status,

          code:
            error?.code,

          model:
            AI_MODEL,

          baseURL:
            AI_BASE_URL
        }
      );


      res
        .status(502)
        .json({

          ok: false,

          error:
            'scan-ai-error',

          message:
            'Le fichier a été lu mais l’analyse IA a échoué. Vérifie la configuration IA.'
        });
    }
  }
);


// =========================================================
// RESET ÉCOGUACATE
// =========================================================

const RESET_SECRET =
  process.env.RESET_SECRET ||
  '';


app.post(
  '/internal/reset-consumption',
  (req, res) => {

    const provided =
      req.headers[
        'x-admin-secret'
      ] ||
      req.query.secret;


    if (
      !RESET_SECRET ||
      provided !==
        RESET_SECRET
    ) {

      return res
        .status(403)
        .json({
          ok: false,
          error:
            'forbidden'
        });
    }


    resetDailyConsumption();


    res.json({
      ok: true
    });
  }
);


// =========================================================
// PAGE PRINCIPALE
// =========================================================

app.get(
  '*',
  (req, res) => {

    res.sendFile(
      path.join(
        ROOT,
        'index.html'
      )
    );
  }
);


// =========================================================
// DÉMARRAGE
// =========================================================

app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `🥑 Aguacate AI v4.0.0 listening on port ${PORT}`
    );

    console.log(
      `[AI] Provider: ${
        USING_OPENROUTER
          ? 'OpenRouter'
          : 'OpenAI'
      }`
    );

    console.log(
      `[AI] Model: ${AI_MODEL}`
    );

    console.log(
      `[AI] Base URL: ${AI_BASE_URL}`
    );

    console.log(
      `[AI] API configured: ${
        Boolean(openai)
      }`
    );
  }
);


module.exports = app;
