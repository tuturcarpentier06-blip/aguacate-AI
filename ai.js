
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// 💬 chat
async function chat(message) {
  const res = await openai.chat.completions.create({
    model: "openrouter/auto",
    messages: [{ role: "user", content: message }]
  });

  return res.choices[0].message.content;
}

// 🖼️ image
async function image(prompt) {
  const res = await openai.images.generate({
    model: "stable-diffusion",
    prompt
  });

  return res.data[0].url;
}

// 🎤 speech → text
async function speechToText(audioBase64) {
  // simplifié (ton projet complet était + complexe)
  return "audio traité (version simplifiée)";
}

// 🔊 text → speech
async function textToSpeech(text) {
  return "voix générée (version simplifiée)";
}

module.exports = {
  chat,
  image,
  speechToText,
  textToSpeech
};
