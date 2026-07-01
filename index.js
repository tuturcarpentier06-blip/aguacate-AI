
const express = require("express");
const { chat, image } = require("./ai");

const app = express();
app.use(express.json());
app.use(express.static("."));

const port = process.env.PORT || 3000;

// accueil
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// 💬 chat
app.post("/chat", async (req, res) => {
  try {
    const reply = await chat(req.body.message);
    res.json({ reply });
  } catch (e) {
    res.json({ reply: "Erreur IA" });
  }
});

// 🖼️ image
app.post("/image", async (req, res) => {
  const url = await image(req.body.prompt);
  res.json({ url });
});

app.listen(port, () => {
  console.log("Server running");
});
