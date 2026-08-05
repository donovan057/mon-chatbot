# 🤖 AI Chatbot - Assistant Intelligent Full-Stack

![Vercel Deployment](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Groq API](https://img.shields.io/badge/Groq_API-F05032?style=for-the-badge&logo=lightning&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

Un chatbot intéractif full-stack combinant d'inférence du modèle **Llama 3.3 70B via Groq API**, la persistance des données multi-sessions avec **Supabase**, et un déploiement serverless ultra-rapide sur **Vercel**.

---

## ⚡️ Fontionnalités principales

* **🧠 Mémoire contextuelle & Gestion par session :** Conversation fluide grâce à l'historique de messages. Chaque nouvelle discussion génère un `session_id` unique (`UUID`).
* **🗄️ Persistance des données :** Sauvegarde automatique des échanges (messages utilisateur et réponses du bot) dans une base PostgreSQL hébergée sur Supabase.
* **✨ Effet Machine à Écrire (Typewriter) :** Rendu fluide et dynamique des réponses générées mot par mot.
* **📝 Support Markdown & Coloration de code :** Intégration de `Marked.js` pour la mise en forme du texte et `Highlight.js` pour la coloration syntaxique des blocs de code.
* **📋 Copie universelle en un clic :** Bouton de copie du contenu dans le presse-papier avec gestion du fallback HTTP/HTTPS.
* **🌙 Mode Sombre / Clair (Dark/Light Theme) :** Thème dynamique configurable à tout moment par l'utilisateur.

---

| Composant | Technologie | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Interface utilisateur réactive et responsive. |
| **Parsing & Formatting** | Marked.js, Highlight.js, FontAwesome | Interprétation Markdown, coloration syntaxique et icônes. |
| **Backend Serverless** | Node.js (Vercel Serverless API) | Masquage des clés API et traitement sécurisé des requêtes. |
| **IA / LLM** | Groq API (`llama-3.3-70b-versatile`) | Génération de réponses ultra-rapide par IA. |
| **Base de données** | Supabase (PostgreSQL) | Stockage persistant et structuré des historiques de discussion. |

---

## 🗂️ Architecture du Projet

```text
mon-chatbot/
├── api/
│    └── chat.js           # Fonction serverless Vercel (gestion Groq + Supabase)
├── index.html             # Structure HTML5 de l'interface du chat
├── style.css              # Styles CSS avec support Dark/Light mode
├── script.js              # Logique client, événements UI et gestion des sessions
└── README.md              # Documentation du projet
