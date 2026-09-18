// ============================================================
// AGUACATE AI v4.0.0
// SERVER.JS — BACKEND COMPLET
// ============================================================

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

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'aguacate-data.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

/* ============================================================
   RENDER / EXPRESS
   ============================================================ */

// IMPORTANT pour Render + X-Forwarded-For
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '1mb'
}));

app.use(express.static(ROOT));


/* ============================================================
   CONFIGURATION IA
   ============================================================ */

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || '';

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || '';

const USING_OPENROUTER =
  Boolean(OPENROUTER_API_KEY);

const AI_API_KEY =
  OPENROUTER_API_KEY ||
  OPENAI_API_KEY;

const AI_BASE_URL =
  process.env.AI_BASE_URL ||
  (
    USING_OPENROUTER
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1'
  );

const AI_MODEL =
  process.env.AI_MODEL ||
  (
    USING_OPENROUTER
      ? 'openrouter/auto'
      : 'gpt-5.6'
  );

const openai = AI_API_KEY
  ? new OpenAI({
      apiKey: AI_API_KEY,
      baseURL: AI_BASE_URL,
      timeout: 60_000,
      maxRetries: 1,

      defaultHeaders: USING_OPENROUTER
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


/* ============================================================
   CONFIGURATION
   ============================================================ */

const MAX_FILE_MB = Math.max(
  1,
  Math.min(
    15,
    Number(
      process.env.MAX_FILE_MB || 10
    )
  )
);

const ECO_MAX_LITRES =
  Number(
    process.env.ECOGUACATE_MAX_LITRES || 100
  );

const ONLINE_TIMEOUT_MS =
  90 * 1000;

const RECENT_WINDOW_MS =
  24 * 60 * 60 * 1000;


/* ============================================================
   UPLOADS
   ============================================================ */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize:
      MAX_FILE_MB * 1024 * 1024
  }
});


/* ============================================================
   DONNÉES
   ============================================================ */

const DEFAULT_DATA = {
  users: {},
  conversations: {},
  memories: {},
  adminLogs: []
};

let data = loadData();


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
    JSON.stringify(
      DEFAULT_DATA
    )
  );
}


function saveData() {

  try {

    const temporary =
      DATA_FILE + '.tmp';

    fs.writeFileSync(
      temporary,
      JSON.stringify(
        data,
        null,
        2
      ),
      'utf8'
    );

    fs.renameSync(
      temporary,
      DATA_FILE
    );

  } catch (error) {

    console.error(
      '[data] sauvegarde impossible:',
      error.message
    );
  }
}


/* ============================================================
   UTILITAIRES
   ============================================================ */

function now() {
  return Date.now();
}


function genToken() {

  return crypto
    .randomBytes(32)
    .toString('hex');
}


/*
  Nouvel identifiant court.

  Exemple :
  Aguacate #23PY
  Aguacate #A7KD
  Aguacate #4XQ2
*/

function genUserId() {

  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let id;

  do {

    id = '';

    for (
      let i = 0;
      i < 4;
      i++
    ) {

      id += chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];
    }

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

  return crypto.timingSafeEqual(
    Buffer.from(
      hashPassword(provided)
    ),
    Buffer.from(
      hashPassword(configured)
    )
  );
}


/* ============================================================
   UTILISATEURS
   ============================================================ */

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
    Boolean(user.connected) &&
    Boolean(user.lastSeen) &&
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


/* ============================================================
   BANNISSEMENT
   ============================================================ */

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

    until: user.bannedUntil
  });

  saveData();
}


/* ============================================================
   AVERTISSEMENTS
   ============================================================ */

function addWarning(
  user,
  reason,
  by = 'admin'
) {

  const warning = {

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

  user.warnings.push(
    warning
  );

  const number =
    user.warnings.length;

  data.adminLogs.push({

    type: 'warning',

    user: user.id,

    by,

    reason:
      warning.reason,

    warningNumber:
      number,

    date:
      warning.date
  });

  /*
    3 avertissements =
    bannissement 24 h.

    IMPORTANT :
    les 1er et 2e avertissements
    ne bannissent PAS.
  */

  if (number >= 3) {

    banFor24h(
      user,
      `Avertissement n°${number}`,
      by
    );
  }

  saveData();

  return warning;
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
        warning.id !==
        warningId
    );

  if (
    before !==
    user.warnings.length
  ) {

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


/* ============================================================
   AUTHENTIFICATION
   ============================================================ */

function getUserFromRequest(req) {

  const authorization =
    req.headers.authorization || '';

  const token =
    authorization.startsWith(
      'Bearer '
    )
      ? authorization.slice(7)
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

    return res.status(401).json({
      ok: false,
      error: 'unauthenticated'
    });
  }

  if (
    isBanned(user)
  ) {

    return res.status(403).json({

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

        return res.status(403)
          .json({
            ok: false,
            error: 'forbidden'
          });
      }

      next();
    }
  );
}


/* ============================================================
   CONSOMMATION ÉCOGUACATE
   ============================================================ */

function addEcoConsumption(
  user,
  replyLength
) {

  const litres =
    1 +
    Math.floor(
      Number(replyLength || 0) /
      200
    );

  user.consumptionLitres =
    Number(
      (
        Number(
          user.consumptionLitres ||
          0
        ) +
        litres
      ).toFixed(1)
    );

  return user.consumptionLitres;
}


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
        24 * 60 * 60 * 1000
      );

    },
    delay
  );
}


scheduleReset();


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

          user.connected =
            false;
        }
      }
    );

    saveData();

  },
  30 * 1000
);


/* ============================================================
   MODÉRATION
   ============================================================ */

const GROSS_WORD_PATTERNS = [

  /\b(?:putain|merde|connard|connasse|encule|enculé|salope|fdp|nique|niquer)\b/i,

  /\b(?:fuck|shit|bitch|asshole)\b/i
];


function containsGrossLanguage(
  text
) {

  return GROSS_WORD_PATTERNS.some(
    regex =>
      regex.test(text)
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

    return null;
  }

  const warning =
    addWarning(
      user,
      'Langage grossier détecté automatiquement',
      'system'
    );

  const warningNumber =
    user.warnings.length;

  return {

    banned:
      warningNumber >= 3,

    warningNumber,

    warning
  };
}


/* ============================================================
   RATE LIMIT
   ============================================================ */

const chatLimiter =
  rateLimit({

    windowMs:
      60 * 1000,

    max: 30,

    standardHeaders: true,

    legacyHeaders: false,

    message: {

      ok: false,

      error:
        'rate-limit',

      message:
        'Trop de messages en peu de temps. Réessaie dans un instant.'
    }
  });


/* ============================================================
   HEALTH
   ============================================================ */

app.get(
  '/health',
  (req, res) => {

    res.json({

      ok: true,

      version:
        '4.0.0',

      ai:
        Boolean(openai),

      provider:
        USING_OPENROUTER
          ? 'openrouter'
          : 'openai',

      model:
        AI_MODEL,

      baseURL:
        AI_BASE_URL
    });
  }
);


/* ============================================================
   LOGIN
   ============================================================ */

app.post(
  '/login',
  (req, res) => {

    const requested =
      safeText(
        req.body?.deviceId,
        64
      ).trim();

    /*
      On garde un identifiant court
      de 4 caractères.

      Si l'ancien navigateur possède
      un ancien identifiant trop long,
      on en génère un nouveau.
    */

    let id =
      /^[A-Z0-9]{4}$/i.test(
        requested
      )
        ? requested.toUpperCase()
        : genUserId();

    const user =
      userRecord(id);

    if (
      isBanned(user)
    ) {

      return res.status(403)
        .json({

          ok: false,

          error:
            'banned',

          bannedUntil:
            user.bannedUntil
        });
    }

    user.connected = true;

    user.lastSeen =
      now();

    user.token =
      genToken();

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
        user.consumptionLitres ||
        0,

      version:
        '4.0.0'
    });
  }
);


/* ============================================================
   HEARTBEAT / LOGOUT
   ============================================================ */

app.post(
  '/heartbeat',
  ensureAuth,
  (req, res) => {

    req.authUser.connected =
      true;

    req.authUser.lastSeen =
      now();

    saveData();

    res.json({
      ok: true,
      online: true
    });
  }
);


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


/* ============================================================
   MODES
   ============================================================ */

app.post(
  '/modes/verify',
  ensureAuth,
  (req, res) => {

    const mode =
      safeText(
        req.body?.mode,
        30
      );

    const password =
      String(
        req.body?.password || ''
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
        role:
          user.role
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
        role:
          user.role
      });
    }

    return res.status(401)
      .json({

        ok: false,

        error:
          'invalid-password'
      });
  }
);


/* ============================================================
   ADMIN — UTILISATEURS
   ============================================================ */

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
          Number(
            b.lastSeen || 0
          ) -
          Number(
            a.lastSeen || 0
          )
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


/* ============================================================
   ADMIN — ACTIONS
   ============================================================ */

app.post(
  '/users/:id/disconnect',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(
          req.params.id
        )
      ];

    if (!user) {

      return res.status(404)
        .json({
          ok: false,
          error:
            'not-found'
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

    saveData();

    res.json({
      ok: true
    });
  }
);


app.post(
  '/users/:id/ban',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(
          req.params.id
        )
      ];

    if (!user) {

      return res.status(404)
        .json({
          ok: false,
          error:
            'not-found'
        });
    }

    banFor24h(
      user,
      safeText(
        req.body?.reason ||
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


app.post(
  '/users/:id/unban',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(
          req.params.id
        )
      ];

    if (!user) {

      return res.status(404)
        .json({
          ok: false,
          error:
            'not-found'
        });
    }

    user.bannedUntil =
      0;

    saveData();

    res.json({
      ok: true
    });
  }
);


app.post(
  '/users/:id/warnings',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(
          req.params.id
        )
      ];

    if (!user) {

      return res.status(404)
        .json({
          ok: false,
          error:
            'not-found'
        });
    }

    const warning =
      addWarning(
        user,
        req.body?.reason ||
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


app.delete(
  '/users/:id/warnings/:warningId',
  ensureAdmin,
  (req, res) => {

    const user =
      data.users[
        String(
          req.params.id
        )
      ];

    if (!user) {

      return res.status(404)
        .json({
          ok: false,
          error:
            'not-found'
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


/* ============================================================
   CONVERSATIONS ADMIN
   ============================================================ */

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
        String(
          req.params.userId
        )
      ] || []
    );
  }
);


/* ============================================================
   CONVERSATIONS UTILISATEUR
   ============================================================ */

function createConversation(
  userId,
  title = 'Nouvelle conversation'
) {

  if (
    !data.conversations[userId]
  ) {

    data.conversations[userId] =
      [];
  }

  const conversation = {

    id:
      Date.now()
        .toString(36) +
      crypto
        .randomBytes(3)
        .toString('hex'),

    title,

    messages: [],

    createdAt:
      now(),

    updatedAt:
      now()
  };

  data.conversations[
    userId
  ].push(
    conversation
  );

  return conversation;
}


app.post(
  '/newConversation',
  ensureAuth,
  (req, res) => {

    const conversation =
      createConversation(
        req.authUser.id
      );

    saveData();

    res.json({

      ok: true,

      id:
        conversation.id,

      conversations:
        data.conversations[
          req.authUser.id
        ]
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


app.post(
  '/renameConversation',
  ensureAuth,
  (req, res) => {

    const userId =
      req.authUser.id;

    const id =
      String(
        req.body?.conversationId ||
        ''
      );

    const title =
      safeText(
        req.body?.title ||
          'Nouvelle conversation',
        60
      ).trim();

    const conversation =
      (
        data.conversations[
          userId
        ] || []
      ).find(
        item =>
          item.id === id
      );

    if (!conversation) {

      return res.status(404)
        .json({
          ok: false,
          error:
            'not-found'
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


app.post(
  '/deleteConversation',
  ensureAuth,
  (req, res) => {

    const userId =
      req.authUser.id;

    const id =
      String(
        req.body?.conversationId ||
        ''
      );

    data.conversations[
      userId
    ] =
      (
        data.conversations[
          userId
        ] || []
      ).filter(
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


/* ============================================================
   IA
   ============================================================ */

async function askAI(
  messages
) {

  if (!openai) {

    throw new Error(
      'Aucune clé IA configurée.'
    );
  }


  /*
    OpenRouter
    ----------------------------------------------------------
    On utilise Chat Completions.
  */

  if (USING_OPENROUTER) {

    const response =
      await openai
        .chat
        .completions
        .create({

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
      typeof reply !==
        'string' ||
      !reply.trim()
    ) {

      throw new Error(
        'Réponse OpenRouter vide.'
      );
    }

    return reply.trim();
  }


  /*
    OpenAI direct
  */

  const systemMessage =
    messages.find(
      message =>
        message.role ===
        'system'
    );

  const otherMessages =
    messages.filter(
      message =>
        message.role !==
        'system'
    );

  const response =
    await openai.responses.create({

      model:
        AI_MODEL,

      instructions:
        systemMessage?.content ||
        'Tu es Aguacate AI.',

      input:
        otherMessages
          .map(
            message =>
              `${message.role}: ${message.content}`
          )
          .join('\n\n')
    });

  const reply =
    response?.output_text;

  if (
    typeof reply !==
      'string' ||
    !reply.trim()
  ) {

    throw new Error(
      'Réponse OpenAI vide.'
    );
  }

  return reply.trim();
}


/* ============================================================
   CHAT
   ============================================================ */

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
          req.body?.message
        ).trim();

      const mode =
        safeText(
          req.body?.mode
        ) || 'Kids';


      if (!message) {

        return res.status(400)
          .json({

            ok: false,

            error:
              'empty-message'
          });
      }


      /*
        MODÉRATION

        1er message interdit :
        avertissement.

        2e :
        avertissement.

        3e :
        bannissement 24 h.
      */

      const moderation =
        moderationHit(
          user,
          message
        );

      if (
        moderation?.banned
      ) {

        return res.status(403)
          .json({

            ok: false,

            error:
              'banned',

            bannedUntil:
              user.bannedUntil,

            message:
              '🚫 Troisième avertissement : ton accès est suspendu pendant 24 heures.'
          });
      }

      if (moderation) {

        const warningMessage =
          moderation.warningNumber ===
          1

            ? '⚠️ Premier avertissement : merci de respecter les règles.'

            : '⚠️ Deuxième avertissement : un nouveau message interdit entraînera un bannissement de 24 heures.';

        return res.status(400)
          .json({

            ok: false,

            error:
              'warning',

            warningNumber:
              moderation.warningNumber,

            message:
              warningMessage
          });
      }


      /* ======================================================
         MÉMOIRE
         ====================================================== */

      if (
        !data.memories[
          user.id
        ]
      ) {

        data.memories[
          user.id
        ] = [];
      }


      let systemPrompt;

      if (
        mode === 'Kids'
      ) {

        systemPrompt =
          'Tu es Aguacate AI. Explique avec des mots simples, adaptés à un enfant, sans être infantilisant. Sois utile, clair et pédagogique.';

      } else if (
        mode === 'Collégien'
      ) {

        systemPrompt =
          'Tu es Aguacate AI, un assistant pédagogique pour collégien. Explique clairement et aide à raisonner plutôt que de simplement donner une réponse.';

      } else if (
        mode === 'Professeur'
      ) {

        systemPrompt =
          'Tu es Aguacate AI, assistant pédagogique pour enseignants. Sois structuré, précis et pédagogique.';

      } else {

        systemPrompt =
          'Tu es Aguacate AI, assistant polyvalent. Réponds clairement et utilement en français.';
      }


      data.memories[
        user.id
      ].push({

        role:
          'user',

        content:
          message
      });


      const reply =
        await askAI([

          {
            role:
              'system',

            content:
              systemPrompt
          },

          ...data
            .memories[
              user.id
            ]
            .slice(-16)
        ]);


      data.memories[
        user.id
      ].push({

        role:
          'assistant',

        content:
          reply
      });


      /* ======================================================
         CONVERSATION
         ====================================================== */

      if (
        !data.conversations[
          user.id
        ]
      ) {

        data.conversations[
          user.id
        ] = [];
      }


      if (
        !data.conversations[
          user.id
        ].length
      ) {

        createConversation(
          user.id,
          'Conversation'
        );
      }


      /*
        On utilise la conversation
        la plus récemment modifiée.
      */

      const conversations =
        data.conversations[
          user.id
        ];

      let conversation =
        conversations
          .slice()
          .sort(
            (a, b) =>
              b.updatedAt -
              a.updatedAt
          )[0];


      if (!conversation) {

        conversation =
          createConversation(
            user.id,
            'Conversation'
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


      /* ======================================================
         ÉCOGUACATE
         ====================================================== */

      const consumption =
        addEcoConsumption(
          user,
          reply.length
        );

      user.lastSeen =
        now();

      user.connected =
        true;

      saveData();


      res.json({

        ok: true,

        reply,

        consumptionLitres:
          consumption,

        ecoMaxLitres:
          ECO_MAX_LITRES
      });

    } catch (error) {

      console.error(
        '[chat] Erreur IA:',
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
            AI_BASE_URL,

          provider:
            USING_OPENROUTER
              ? 'openrouter'
              : 'openai'
        }
      );

      res.status(502)
        .json({

          ok: false,

          error:
            'ai-error',

          message:
            '🥑 Le service IA ne répond pas correctement. Vérifie la clé API et le modèle dans Render.'
        });
    }
  }
);


/* ============================================================
   EXTRACTION DE FICHIERS
   ============================================================ */

async function extractText(
  file
) {

  const extension =
    path.extname(
      file.originalname
    ).toLowerCase();


  if (
    [
      '.txt',
      '.md',
      '.csv',
      '.json',
      '.xml'
    ].includes(extension)
  ) {

    return file.buffer
      .toString('utf8')
      .slice(0, 50000);
  }


  if (
    extension === '.pdf'
  ) {

    const result =
      await pdfParse(
        file.buffer
      );

    return result.text
      .slice(0, 50000);
  }


  if (
    extension === '.docx'
  ) {

    const result =
      await mammoth
        .extractRawText({
          buffer:
            file.buffer
        });

    return result.value
      .slice(0, 50000);
  }


  if (
    [
      '.xlsx',
      '.xls'
    ].includes(extension)
  ) {

    const workbook =
      XLSX.read(
        file.buffer,
        {
          type:
            'buffer'
        }
      );

    return workbook
      .SheetNames
      .map(
        name =>
          `[${name}]\n` +
          XLSX.utils.sheet_to_csv(
            workbook.Sheets[name]
          )
      )
      .join('\n\n')
      .slice(0, 50000);
  }


  throw new Error(
    'unsupported-type'
  );
}


const ALLOWED_EXTENSIONS = [

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


/* ============================================================
   SCANNER
   ============================================================ */

app.post(
  '/scan',
  ensureAuth,
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400)
          .json({
            ok: false,
            error:
              'no-file'
          });
      }


      const extension =
        path.extname(
          req.file.originalname
        ).toLowerCase();


      if (
        !ALLOWED_EXTENSIONS
          .includes(
            extension
          )
      ) {

        return res.status(415)
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
          extension.slice(1),

        characters:
          text.length,

        text
      });

    } catch (error) {

      console.error(
        '[scan]',
        error
      );

      res.status(500)
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


/* ============================================================
   SCAN + IA
   ============================================================ */

app.post(
  '/scan-and-ask',
  chatLimiter,
  ensureAuth,
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400)
          .json({
            ok: false,
            error:
              'no-file'
          });
      }


      const extension =
        path.extname(
          req.file.originalname
        ).toLowerCase();


      if (
        !ALLOWED_EXTENSIONS
          .includes(
            extension
          )
      ) {

        return res.status(415)
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
          req.body?.question ||
          'Analyse ce fichier et résume les points importants.'
        );


      const reply =
        await askAI([

          {
            role:
              'system',

            content:
              'Tu es Aguacate AI. Analyse uniquement le contenu fourni et réponds clairement en français.'
          },

          {
            role:
              'user',

            content:
              `Fichier : ${req.file.originalname}

Contenu :
${text}

Question :
${question}`
          }

        ]);


      if (
        !data.conversations[
          req.authUser.id
        ]
      ) {

        data.conversations[
          req.authUser.id
        ] = [];
      }


      if (
        !data.conversations[
          req.authUser.id
        ].length
      ) {

        createConversation(
          req.authUser.id,
          'Conversation'
        );
      }


      const conversation =
        data.conversations[
          req.authUser.id
        ]
        .slice()
        .sort(
          (a, b) =>
            b.updatedAt -
            a.updatedAt
        )[0];


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


      const consumption =
        addEcoConsumption(
          req.authUser,
          reply.length
        );


      saveData();


      res.json({

        ok: true,

        reply,

        fileName:
          req.file.originalname,

        characters:
          text.length,

        consumptionLitres:
          consumption
      });

    } catch (error) {

      console.error(
        '[scan-and-ask]',
        error
      );

      res.status(500)
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


/* ============================================================
   RESET ÉCOGUACATE
   ============================================================ */

const RESET_SECRET =
  process.env.RESET_SECRET || '';


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

      return res.status(403)
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


/* ============================================================
   PAGE PRINCIPALE
   ============================================================ */

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


/* ============================================================
   SERVEUR
   ============================================================ */

const PORT =
  Number(
    process.env.PORT || 10000
  );


// Le serveur est lancé ici.
// index.js peut simplement faire require('./server.js').

app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `🥑 Aguacate AI v4.0.0 listening on port ${PORT}`
    );
  }
);


module.exports = app;
