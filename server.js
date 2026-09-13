// ============================================================
// AGUACATE AI v4.0.0
// SERVER.JS
// ============================================================

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

// ============================================================
// CONFIGURATION
// ============================================================

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'aguacate-data.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(ROOT));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const AI_BASE_URL =
  process.env.AI_BASE_URL ||
  'https://openrouter.ai/api/v1';

const AI_MODEL =
  process.env.AI_MODEL ||
  'openrouter/auto';

const MAX_FILE_MB = Math.max(
  1,
  Math.min(
    15,
    Number(process.env.MAX_FILE_MB || 10)
  )
);

const ECO_MAX_LITRES = Number(
  process.env.ECOGUACATE_MAX_LITRES || 100
);

const ONLINE_TIMEOUT_MS = 90 * 1000;

const RECENT_WINDOW_MS =
  24 * 60 * 60 * 1000;

// ============================================================
// OPENAI / OPENROUTER
// ============================================================

const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: AI_BASE_URL
    })
  : null;

// ============================================================
// UPLOAD
// ============================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_MB * 1024 * 1024
  }
});

// ============================================================
// DONNÉES
// ============================================================

const DEFAULT_DATA = {
  users: {},
  conversations: {},
  memories: {},
  adminLogs: []
};

let data = loadData();

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(DATA_FILE, 'utf8')
      );

      return {
        ...DEFAULT_DATA,
        ...parsed
      };
    }
  } catch (error) {
    console.error(
      '[DATA] Impossible de lire les données :',
      error.message
    );
  }

  return JSON.parse(
    JSON.stringify(DEFAULT_DATA)
  );
}

function saveData() {
  try {
    const temporaryFile = DATA_FILE + '.tmp';

    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(data, null, 2),
      'utf8'
    );

    fs.renameSync(
      temporaryFile,
      DATA_FILE
    );
  } catch (error) {
    console.error(
      '[DATA] Impossible de sauvegarder :',
      error.message
    );
  }
}

// ============================================================
// OUTILS
// ============================================================

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
        1000 + Math.random() * 9000
      )
    );
  } while (
    Object.values(data.users)
      .some(user => user.id === id)
  );

  return id;
}

function safeText(value, max = 30000) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.slice(0, max);
}

function hashPassword(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function passwordMatches(
  provided,
  configured
) {
  if (!provided || !configured) {
    return false;
  }

  const a = Buffer.from(
    hashPassword(provided)
  );

  const b = Buffer.from(
    hashPassword(configured)
  );

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

// ============================================================
// UTILISATEURS
// ============================================================

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
  return (
    Number(user.bannedUntil || 0) > now()
  );
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
    ...safeUser
  } = user;

  return {
    ...safeUser,
    online: isOnline(user)
  };
}

// ============================================================
// BAN
// ============================================================

function banFor24h(
  user,
  reason,
  by = 'system'
) {
  user.bannedUntil =
    now() + 24 * 60 * 60 * 1000;

  user.connected = false;

  user.sessionVersion =
    (user.sessionVersion || 1) + 1;

  // Invalide immédiatement l'ancienne session
  user.token = genToken();

  data.adminLogs.push({
    type: 'ban',
    reason: safeText(reason, 300),
    user: user.id,
    by,
    date: now(),
    until: user.bannedUntil
  });

  saveData();
}

// ============================================================
// AVERTISSEMENTS
// ============================================================

function addWarning(
  user,
  reason,
  by = 'admin'
) {
  const warning = {
    id: crypto
      .randomBytes(5)
      .toString('hex'),

    reason: safeText(
      reason,
      300
    ),

    date: now(),
    by
  };

  if (!Array.isArray(user.warnings)) {
    user.warnings = [];
  }

  user.warnings.push(warning);

  const warningNumber =
    user.warnings.length;

  data.adminLogs.push({
    type: 'warning',
    user: user.id,
    by,
    reason: warning.reason,
    warningNumber,
    date: warning.date
  });

  /*
   * IMPORTANT :
   *
   * 1er avertissement = avertissement
   * 2e avertissement = avertissement
   * 3e avertissement = BAN 24 H
   * 4e+ = BAN 24 H
   *
   * On ne bannit qu'une seule fois ici.
   */

  if (warningNumber >= 3) {
    banFor24h(
      user,
      `Avertissement n°${warningNumber}`,
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
  if (!Array.isArray(user.warnings)) {
    user.warnings = [];
  }

  const oldLength =
    user.warnings.length;

  user.warnings =
    user.warnings.filter(
      warning =>
        warning.id !== warningId
    );

  const changed =
    oldLength !==
    user.warnings.length;

  if (changed) {
    data.adminLogs.push({
      type: 'warning-removed',
      user: user.id,
      warningId,
      date: now()
    });

    saveData();
  }

  return changed;
}

// ============================================================
// AUTHENTIFICATION
// ============================================================

function getUserFromRequest(req) {
  const authorization =
    req.headers.authorization || '';

  let token = null;

  if (
    authorization.startsWith(
      'Bearer '
    )
  ) {
    token =
      authorization.slice(7);
  }

  if (!token) {
    token =
      req.query.token ||
      req.body?.token;
  }

  if (!token) {
    return null;
  }

  return Object.values(
    data.users
  ).find(
    user => user.token === token
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

  if (isBanned(user)) {
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
        return res.status(403).json({
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
        return res.status(403).json({
          ok: false,
          error: 'forbidden'
        });
      }

      next();
    }
  );
}

// ============================================================
// MODÉRATION
// ============================================================

const GROSS_WORD_PATTERNS = [
  /\bputain\b/i,
  /\bmerde\b/i,
  /\bconnard\b/i,
  /\bconnasse\b/i,
  /\bencule\b/i,
  /\benculé\b/i,
  /\bsalope\b/i,
  /\bfdp\b/i,
  /\bnique\b/i,
  /\bniquer\b/i,
  /\bfuck\b/i,
  /\bshit\b/i,
  /\bbitch\b/i,
  /\basshole\b/i
];

function containsGrossLanguage(
  text
) {
  return GROSS_WORD_PATTERNS.some(
    regex => regex.test(text)
  );
}

/*
 * Retourne le résultat de la modération
 * sans appliquer deux bans.
 */
function moderationHit(
  user,
  message
) {
  if (
    !containsGrossLanguage(
      message
    )
  ) {
    return {
      detected: false,
      warningNumber:
        Array.isArray(user.warnings)
          ? user.warnings.length
          : 0,
      banned: false
    };
  }

  const warning =
    addWarning(
      user,
      'Langage grossier détecté automatiquement',
      'system'
    );

  const warningNumber =
    user.warnings.length;

  const banned =
    warningNumber >= 3;

  return {
    detected: true,
    warningNumber,
    warning,
    banned,
    bannedUntil:
      user.bannedUntil || 0
  };
}

// ============================================================
// RESET ÉCOGUACATE
// ============================================================

function resetDailyConsumption() {
  Object.values(
    data.users
  ).forEach(user => {
    user.consumptionLitres = 0;
  });

  data.adminLogs.push({
    type: 'reset-consumption',
    date: now()
  });

  saveData();

  console.log(
    '[ECOGUACATE] Reset quotidien effectué.'
  );
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
      next.getTime() -
        current.getTime() +
        1000
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

// ============================================================
// SURVEILLANCE DES UTILISATEURS
// ============================================================

setInterval(
  () => {
    let changed = false;

    Object.values(
      data.users
    ).forEach(user => {
      if (
        user.connected &&
        now() -
          user.lastSeen >
          ONLINE_TIMEOUT_MS
      ) {
        user.connected = false;
        changed = true;
      }
    });

    if (changed) {
      saveData();
    }
  },
  30 * 1000
);

// ============================================================
// RATE LIMIT
// ============================================================

const chatLimiter =
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
  });

// ============================================================
// HEALTH
// ============================================================

app.get(
  '/health',
  (req, res) => {
    res.json({
      ok: true,
      version: '4.0.0',
      ai: !!openai
    });
  }
);

// ============================================================
// LOGIN
// ============================================================

app.post(
  '/login',
  (req, res) => {
    try {
      const requested =
        String(
          req.body.deviceId || ''
        ).slice(0, 64);

      let id;

      if (
        requested &&
        data.users[requested]
      ) {
        id = requested;
      } else if (
        requested &&
        /^\d{4}$/.test(requested)
      ) {
        id = requested;
      } else {
        id = genUserId();
      }

      const user =
        userRecord(id);

      if (isBanned(user)) {
        return res.status(403).json({
          ok: false,
          error: 'banned',
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
        type: 'login',
        user: user.id,
        date: now()
      });

      saveData();

      res.json({
        ok: true,
        id: user.id,
        role: user.role,
        token: user.token,
        warnings:
          user.warnings || [],
        consumptionLitres:
          user.consumptionLitres || 0,
        version: '4.0.0'
      });

    } catch (error) {
      console.error(
        '[LOGIN]',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'login-error'
      });
    }
  }
);

// ============================================================
// HEARTBEAT
// ============================================================

app.post(
  '/heartbeat',
  ensureAuth,
  (req, res) => {
    req.authUser.connected = true;
    req.authUser.lastSeen = now();

    saveData();

    res.json({
      ok: true,
      online: true
    });
  }
);

// ============================================================
// LOGOUT
// ============================================================

app.post(
  '/logout',
  ensureAuth,
  (req, res) => {
    req.authUser.connected = false;
    req.authUser.lastSeen = now();

    saveData();

    res.json({
      ok: true
    });
  }
);

// ============================================================
// PROFESSOR / ADMIN
// ============================================================

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
      user.role = 'professeur';

      data.adminLogs.push({
        type: 'professor-login',
        user: user.id,
        date: now()
      });

      saveData();

      return res.json({
        ok: true,
        role: 'professeur'
      });
    }

    if (
      mode === 'Admin' &&
      passwordMatches(
        password,
        process.env.ADMIN_PASSWORD
      )
    ) {
      user.role = 'admin';

      data.adminLogs.push({
        type: 'admin-login',
        user: user.id,
        date: now()
      });

      saveData();

      return res.json({
        ok: true,
        role: 'admin'
      });
    }

    return res.status(401).json({
      ok: false,
      error: 'invalid-password'
    });
  }
);

// ============================================================
// UTILISATEURS ADMIN
// ============================================================

app.get(
  '/users',
  ensureAdmin,
  (req, res) => {
    const users =
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
        );

    res.json(users);
  }
);

app.get(
  '/users/online',
  ensureAdmin,
  (req, res) => {
    const users =
      Object.values(
        data.users
      )
        .filter(isOnline)
        .map(publicUser);

    res.json(users);
  }
);

app.get(
  '/users/recent',
  ensureAdmin,
  (req, res) => {
    const users =
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
        );

    res.json(users);
  }
);

// ============================================================
// DÉCONNEXION FORCÉE
// ============================================================

app.post(
  '/users/:id/disconnect',
  ensureAdmin,
  (req, res) => {
    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'not-found'
      });
    }

    user.connected = false;

    user.lastSeen = now();

    user.sessionVersion =
      (user.sessionVersion || 1) + 1;

    user.token = genToken();

    data.adminLogs.push({
      type: 'disconnect',
      user: user.id,
      by: req.authUser.id,
      date: now()
    });

    saveData();

    res.json({
      ok: true
    });
  }
);

// ============================================================
// BAN MANUEL
// ============================================================

app.post(
  '/users/:id/ban',
  ensureAdmin,
  (req, res) => {
    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'not-found'
      });
    }

    const reason =
      safeText(
        req.body.reason ||
          'Bannissement manuel',
        300
      );

    banFor24h(
      user,
      reason,
      req.authUser.id
    );

    res.json({
      ok: true,
      bannedUntil:
        user.bannedUntil
    });
  }
);

// ============================================================
// UNBAN
// ============================================================

app.post(
  '/users/:id/unban',
  ensureAdmin,
  (req, res) => {
    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'not-found'
      });
    }

    user.bannedUntil = 0;

    data.adminLogs.push({
      type: 'unban',
      user: user.id,
      by: req.authUser.id,
      date: now()
    });

    saveData();

    res.json({
      ok: true
    });
  }
);

// ============================================================
// AJOUTER AVERTISSEMENT ADMIN
// ============================================================

app.post(
  '/users/:id/warnings',
  ensureAdmin,
  (req, res) => {
    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {
      return res.status(404).json({
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

// ============================================================
// SUPPRIMER AVERTISSEMENT
// ============================================================

app.delete(
  '/users/:id/warnings/:warningId',
  ensureAdmin,
  (req, res) => {
    const user =
      data.users[
        String(req.params.id)
      ];

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'not-found'
      });
    }

    const success =
      removeWarning(
        user,
        String(
          req.params.warningId
        )
      );

    res.json({
      ok: success
    });
  }
);

// ============================================================
// JOURNAL ADMIN
// ============================================================

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

// ============================================================
// CONVERSATIONS ADMIN
// ============================================================

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
            Array.isArray(
              item.conversations
            ) &&
            item.conversations.length
        );

    res.json(result);
  }
);

app.get(
  '/admin/conversations/:userId',
  ensureAdmin,
  (req, res) => {
    const conversations =
      data.conversations[
        String(
          req.params.userId
        )
      ] || [];

    res.json(conversations);
  }
);

// ============================================================
// NOUVELLE CONVERSATION
// ============================================================

app.post(
  '/newConversation',
  ensureAuth,
  (req, res) => {
    const userId =
      req.authUser.id;

    const id =
      Date.now().toString(36) +
      crypto
        .randomBytes(3)
        .toString('hex');

    if (
      !data.conversations[userId]
    ) {
      data.conversations[userId] = [];
    }

    const conversation = {
      id,
      title:
        'Nouvelle conversation',
      messages: [],
      createdAt: now(),
      updatedAt: now()
    };

    data.conversations[userId]
      .push(conversation);

    saveData();

    res.json({
      ok: true,
      id,
      conversations:
        data.conversations[userId]
    });
  }
);

// ============================================================
// RÉCUPÉRER CONVERSATIONS
// ============================================================

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

// ============================================================
// RENOMMER
// ============================================================

app.post(
  '/renameConversation',
  ensureAuth,
  (req, res) => {
    const userId =
      req.authUser.id;

    const conversationId =
      String(
        req.body.conversationId ||
          ''
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
      ).find(
        item =>
          item.id ===
          conversationId
      );

    if (!conversation) {
      return res.status(404).json({
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

// ============================================================
// SUPPRIMER CONVERSATION
// ============================================================

app.post(
  '/deleteConversation',
  ensureAuth,
  (req, res) => {
    const userId =
      req.authUser.id;

    const conversationId =
      String(
        req.body.conversationId ||
          ''
      );

    data.conversations[userId] =
      (
        data.conversations[
          userId
        ] || []
      ).filter(
        conversation =>
          conversation.id !==
          conversationId
      );

    saveData();

    res.json({
      ok: true,
      conversations:
        data.conversations[userId]
    });
  }
);

// ============================================================
// IA
// ============================================================

async function askAI(messages) {
  if (!openai) {
    throw new Error(
      'OPENAI_API_KEY manquante'
    );
  }

  const response =
    await openai.chat.completions.create(
      {
        model: AI_MODEL,
        messages
      }
    );

  return (
    response.choices?.[0]?.message
      ?.content ||
    '🥑 Je n’ai pas reçu de réponse.'
  );
}

// ============================================================
// CHAT
// ============================================================

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

      if (!message) {
        return res.status(400).json({
          ok: false,
          error: 'empty-message'
        });
      }

      // ======================================================
      // MODÉRATION
      // ======================================================

      const moderation =
        moderationHit(
          user,
          message
        );

      if (
        moderation.detected
      ) {
        if (
          moderation.banned
        ) {
          return res.status(403).json({
            ok: false,
            error: 'banned',
            warningNumber:
              moderation.warningNumber,
            bannedUntil:
              moderation.bannedUntil,
            message:
              'Ton message contient un langage interdit. Tu as reçu ton troisième avertissement ou plus et ton accès est suspendu pendant 24 heures.'
          });
        }

        const remaining =
          Math.max(
            0,
            3 -
              moderation.warningNumber
          );

        return res.status(400).json({
          ok: false,
          error: 'warning',
          warningNumber:
            moderation.warningNumber,
          remainingBeforeBan:
            remaining,
          message:
            moderation.warningNumber === 1
              ? '⚠️ Avertissement sérieux : ton message contient un langage interdit.'
              : '⚠️ Deuxième avertissement : ton message contient un langage interdit.'
        });
      }

      // ======================================================
      // MÉMOIRE
      // ======================================================

      if (
        !data.memories[user.id]
      ) {
        data.memories[user.id] = [];
      }

      let systemMessage;

      if (mode === 'Kids') {
        systemMessage =
          'Tu es Aguacate AI. Explique avec des mots simples, adaptés à un enfant, sans être infantilisant.';
      } else if (
        mode === 'Collégien'
      ) {
        systemMessage =
          'Tu es Aguacate AI, un assistant pédagogique pour collégien. Explique clairement et aide à raisonner.';
      } else if (
        mode === 'Professeur'
      ) {
        systemMessage =
          'Tu es Aguacate AI, assistant pédagogique pour enseignants. Sois structuré et précis.';
      } else {
        systemMessage =
          'Tu es Aguacate AI, assistant polyvalent.';
      }

      data.memories[user.id].push({
        role: 'user',
        content: message
      });

      const reply =
        await askAI([
          {
            role: 'system',
            content:
              systemMessage
          },
          ...data.memories[
            user.id
          ].slice(-16)
        ]);

      data.memories[user.id].push({
        role: 'assistant',
        content: reply
      });

      // ======================================================
      // CONVERSATION
      // ======================================================

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
        data.conversations[
          user.id
        ].push({
          id:
            Date.now().toString(36),
          title: 'Conversation',
          messages: [],
          createdAt: now(),
          updatedAt: now()
        });
      }

      const conversation =
        data.conversations[
          user.id
        ][
          data.conversations[
            user.id
          ].length - 1
        ];

      conversation.messages.push(
        {
          role: 'user',
          content: message,
          date: now()
        },
        {
          role: 'assistant',
          content: reply,
          date: now()
        }
      );

      conversation.updatedAt =
        now();

      // ======================================================
      // ÉCOGUACATE
      // ======================================================

      const waterUsed =
        1 +
        Math.floor(
          reply.length / 200
        );

      user.consumptionLitres =
        Number(
          (
            Number(
              user.consumptionLitres ||
                0
            ) + waterUsed
          ).toFixed(1)
        );

      user.lastSeen = now();
      user.connected = true;

      saveData();

      res.json({
        ok: true,
        reply,
        consumptionLitres:
          user.consumptionLitres,
        ecoMaxLitres:
          ECO_MAX_LITRES
      });

    } catch (error) {
      console.error(
        '[CHAT]',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'ai-error',
        message:
          '🥑 Impossible de contacter l’IA. Vérifie la clé API et le modèle configurés dans Render.'
      });
    }
  }
);

// ============================================================
// EXTRACTION DE FICHIERS
// ============================================================

async function extractText(file) {
  const extension =
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
    ].includes(extension)
  ) {
    return file.buffer
      .toString('utf8')
      .slice(0, 50000);
  }

  if (extension === '.pdf') {
    const result =
      await pdfParse(
        file.buffer
      );

    return result.text.slice(
      0,
      50000
    );
  }

  if (extension === '.docx') {
    const result =
      await mammoth.extractRawText(
        {
          buffer:
            file.buffer
        }
      );

    return result.value.slice(
      0,
      50000
    );
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
          type: 'buffer'
        }
      );

    return workbook.SheetNames
      .map(
        sheetName =>
          `[${sheetName}]\n` +
          XLSX.utils.sheet_to_csv(
            workbook.Sheets[
              sheetName
            ]
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

// ============================================================
// SCANNER
// ============================================================

app.post(
  '/scan',
  ensureAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: 'no-file'
        });
      }

      const extension =
        path
          .extname(
            req.file.originalname
          )
          .toLowerCase();

      if (
        !ALLOWED_EXTENSIONS.includes(
          extension
        )
      ) {
        return res.status(415).json({
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
        '[SCAN]',
        error
      );

      res.status(500).json({
        ok: false,
        error: 'scan-error',
        message:
          'Impossible de lire ce fichier.'
      });
    }
  }
);

// ============================================================
// SCAN + IA
// ============================================================

app.post(
  '/scan-and-ask',
  chatLimiter,
  ensureAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok: false,
          error: 'no-file'
        });
      }

      const extension =
        path
          .extname(
            req.file.originalname
          )
          .toLowerCase();

      if (
        !ALLOWED_EXTENSIONS.includes(
          extension
        )
      ) {
        return res.status(415).json({
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
            role: 'system',
            content:
              'Tu es Aguacate AI. Analyse uniquement le contenu fourni et réponds clairement en français.'
          },
          {
            role: 'user',
            content:
              `Fichier: ${req.file.originalname}\n\n` +
              `Contenu:\n${text}\n\n` +
              `Question:\n${question}`
          }
        ]);

      const userId =
        req.authUser.id;

      if (
        !data.conversations[
          userId
        ]
      ) {
        data.conversations[
          userId
        ] = [];
      }

      if (
        !data.conversations[
          userId
        ].length
      ) {
        data.conversations[
          userId
        ].push({
          id:
            Date.now().toString(36),
          title: 'Conversation',
          messages: [],
          createdAt: now(),
          updatedAt: now()
        });
      }

      const conversation =
        data.conversations[
          userId
        ][
          data.conversations[
            userId
          ].length - 1
        ];

      conversation.messages.push(
        {
          role: 'user',
          content:
            `📎 ${req.file.originalname}\n${question}`,
          date: now()
        },
        {
          role: 'assistant',
          content: reply,
          date: now()
        }
      );

      conversation.updatedAt =
        now();

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
        '[SCAN-AND-ASK]',
        error
      );

      res.status(500).json({
        ok: false,
        error:
          'scan-ai-error',
        message:
          'Le fichier a été lu mais l’analyse IA a échoué. Vérifie la configuration IA.'
      });
    }
  }
);

// ============================================================
// RESET ÉCOGUACATE MANUEL
// ============================================================

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
      return res.status(403).json({
        ok: false,
        error: 'forbidden'
      });
    }

    resetDailyConsumption();

    res.json({
      ok: true
    });
  }
);

// ============================================================
// PAGE PRINCIPALE
// ============================================================

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

// ============================================================
// EXPORT
// ============================================================

module.exports = app;
