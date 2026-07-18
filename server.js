const express = require("express");
const OpenAI = require("openai");
const multer = require("multer");

const app = express();

app.use(express.json());
app.use(express.static("."));

const PORT = process.env.PORT || 3000;

// ===== MOTS DE PASSE =====

const USER_PASSWORD = "BenjaminAguacateAI2026#";
const ADMIN_PASSWORD = "sinonAnanasAIneserapascontent2026!";
const SUPREME_PASSWORD = "situestristeBenjaBabynepleurepas2026?";

// ===== DONNEES =====

const users = {};
const memories = {};
const adminLogs = [];

// ===== UPLOAD =====

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

// ===== OPENROUTER =====

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// ===== LOGIN =====

app.post("/login", (req, res) => {

  const { password } = req.body;

  if (
    password !== USER_PASSWORD &&
    password !== ADMIN_PASSWORD &&
    password !== SUPREME_PASSWORD
  ) {
    return res.json({
      ok: false
    });
  }

  const role =
    password === SUPREME_PASSWORD
      ? "supreme"
      : password === ADMIN_PASSWORD
      ? "admin"
      : "user";

  const id =
    req.body.deviceId ||
    Math.random()
      .toString(16)
      .substring(2, 6)
      .toUpperCase();

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

// ===== INFOS USER =====

app.get("/users", (req, res) => {
  res.json(Object.values(users));
});

// ===== WARN =====

app.post("/warn", (req, res) => {

  const { id } = req.body;

  const user = users[id];

  if (!user)
    return res.json({
      ok: false
    });

  if (user.role === "supreme")
    return res.json({
      ok: false,
      message: "Impossible"
    });

  user.warnings++;

  adminLogs.push({
    type: "warning",
    user: id,
    date: Date.now()
  });

  if (user.warnings >= 3) {
    user.banned = true;
  }

  res.json({
    warnings: user.warnings,
    banned: user.banned
  });
});

// ===== REMOVE WARN =====

app.post("/unwarn", (req, res) => {

  const user = users[req.body.id];

  if (!user)
    return res.json({
      ok: false
    });

  user.warnings = Math.max(
    0,
    user.warnings - 1
  );

  res.json({
    warnings: user.warnings
  });
});

// ===== BAN =====

app.post("/ban", (req, res) => {

  const user =
    users[req.body.id];

  if (!user)
    return res.json({
      ok: false
    });

  if (user.role === "supreme")
    return res.json({
      ok: false
    });

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

// ===== DEBAN =====

app.post("/unban", (req, res) => {

  const user =
    users[req.body.id];

  if (!user)
    return res.json({
      ok: false
    });

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

// ===== CHAT =====

app.post("/chat", async (req, res) => {

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
      "Tu aides à créer cours, évaluations et exercices.";
  }

  memories[user].push({
    role: "user",
    content: message
  });

  try {

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

    return res.json({
      reply
    });

  } catch {

    return res.json({
      reply:
        "🥑 Une erreur est survenue."
    });

  }
});

// ===== PDF / IMAGE =====

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
      filename: req.file.originalname
    });
  }
);

// ===== LOGS =====

app.get("/adminlogs", (req, res) => {
  res.json(adminLogs);
});

// ===== START =====

app.listen(PORT, () => {
  console.log(
    "🥑 Aguacate AI v3.5.0 ONLINE"
  );
});
