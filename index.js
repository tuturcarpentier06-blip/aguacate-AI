
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static(".")); // sert index.html

const port = process.env.PORT || 3000;

// test route
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// API route
app.post("/api", async (req, res) => {
  const message = req.body.message;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: message }
      ]
    });

    res.json({
      reply: response.choices[0].message.content
    });

  } catch (err) {
    res.json({ reply: "Erreur avec OpenAI" });
  }
});



  // pour l'instant on répond simple
  res.json({ reply: "Tu as dit : " + message });
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
``
