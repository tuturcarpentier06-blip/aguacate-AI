const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());
app.use(express.static("."))

// 🔑 Config
const PASSWORD = "BenjaminAguacateAI2026#";
const ADMIN = "sinonAnanasAIneserapascontent2026!";

// 🧠 mémoire simple (par utilisateur)
let memory = {};
let users = {};

// 🤖 IA
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// 🔐 login
app.post("/login", (req,res)=>{
  const { password } = req.body;

  if(password === PASSWORD){
    const id = Math.random().toString(16).slice(2,6);

    users[id] = { warnings:0 };

    res.json({ ok:true, id });
  } else {
    res.json({ ok:false });
  }
});

// 💬 chat
app.post("/chat", async (req,res)=>{
  const { message, user } = req.body;

  if(!memory[user]) memory[user] = [];

  memory[user].push({ role:"user", content:message });

  const response = await openai.chat.completions.create({
    model:"openrouter/auto",
    messages:memory[user].slice(-10)
  });

  const reply = response.choices[0].message.content;

  memory[user].push({ role:"assistant", content:reply });

  res.json({ reply });
});

// ⚠️ modération
app.post("/warn",(req,res)=>{
  const { user } = req.body;

  users[user].warnings++;

  if(users[user].warnings >= 3){
    return res.json({ banned:true });
  }

  res.json({ count:users[user].warnings });
});

app.listen(3000,()=>{
  console.log("✅ Aguacate AI v2.9.5 ONLINE");
});
