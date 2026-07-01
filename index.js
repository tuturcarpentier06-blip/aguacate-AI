const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

const app = express();
app.use(express.json());
app.use(express.static("."));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

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
    console.error(err);
    res.json({ reply: "Erreur OpenAI" });
  }
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
