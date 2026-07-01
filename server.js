
const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());
app.use(express.static("."))

const PASSWORD = "BenjaminAguacateAI2026#";
const ADMIN_CODE = "sinonAnanasAIneserapascontent2026!";

let warnings = {};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// 🔐 login
app.post("/login", (req, res) => {
  if (req.body.password === PASSWORD) {
    res.json({ ok: true });
  } else {
    res.json({ ok: false });
  }
});

// 💬 chat
app.post("/chat", async (req, res) => {
  const msg = req.body.message;

  try {
    const result = await openai.chat.completions.create({
      model: "openrouter/auto",
      messages: [{ role: "user", content: msg }]
    });

    res.json({
      reply: result.choices[0].message.content
    });

  } catch {
    res.json({ reply: "Erreur IA" });
  }
});

// ⚠️ modération simple
app.post("/warn", (req, res) => {
  const user = req.body.user;

  warnings[user] = (warnings[user] || 0) + 1;

  if (warnings[user] >= 3) {
    return res.json({ banned: true });
  }

  res.json({ warnings: warnings[user] });
});

app.listen(3000, () => {
  console.log("✅ Aguacate AI v2.8.5 lancé");
});
