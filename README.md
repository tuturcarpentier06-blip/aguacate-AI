# Aguacate AI


## Scanner d’images et de documents — v4.0.0

Aguacate AI peut maintenant analyser une image ou un document depuis le bouton 📎 dans la zone de chat. Les fichiers sont envoyés au backend, jamais exposés avec la clé API dans le navigateur. Formats acceptés : PNG, JPEG, WebP, GIF, PDF, TXT, Markdown, CSV, JSON, DOC/DOCX, XLS/XLSX et PPT/PPTX. Taille maximale par défaut : 10 Mo (`SCAN_MAX_FILE_MB`).

Le scanner utilise la Responses API et un modèle configuré par `OPENAI_MODEL` (par défaut `gpt-5.6-luna`).
## 🆓 Scanner gratuit v4.0.0

Aguacate AI v4.0.0 intègre un scanner sans API de vision payante :
- 🖼️ images PNG/JPG/WebP/GIF : OCR Tesseract.js exécuté dans le navigateur ; l’image n’est pas envoyée au serveur ;
- 📄 PDF : extraction locale côté serveur avec `pdf-parse` ;
- 📝 Word `.docx` : extraction du texte avec `mammoth` ;
- 📊 XLS/XLSX : extraction des feuilles avec `xlsx` ;
- 📃 TXT/MD/CSV/JSON : lecture directe du texte.

Le **scan/extraction** est gratuit. Si le texte extrait est ensuite envoyé au modèle IA via `/chat`, la réponse IA peut toujours consommer le quota de ton fournisseur (OpenRouter/OpenAI).

> Les anciens fichiers Word `.doc` ne sont pas pris en charge ; utilise `.docx`.

