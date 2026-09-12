# Aguacate AI

Assistant IA pédagogique en Node.js/Express.

## Lancer

`npm start`

## Variables

`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` (optionnel), `PROFESSOR_PASSWORD`, `ADMIN_PASSWORD`, `RESET_SECRET`.

## Architecture

- `server.js` : API, authentification, sécurité et appel IA.
- `app.js` : interface et conversations.
- `index.html` / `style.css` : interface.
- `voice.js` : synthèse/reconnaissance vocale.
