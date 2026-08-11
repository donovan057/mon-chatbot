<h1 align="center">🤖 AI Chatbot - Assistant Intelligent Full-Stack & Mobile</h1>

<p align="center">
  <a href="https://mon-chatbot-chi.vercel.app" target="_blank">
    <img src="https://img.shields.io/badge/Vercel_App-Online-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel App" />
  </a>
  <a href="https://groq.com" target="_blank">
    <img src="https://img.shields.io/badge/Groq_API-F05032?style=for-the-badge&logo=lightning&logoColor=white" alt="Groq API" />
  </a>
  <a href="https://supabase.com" target="_blank">
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  </a>
  <a href="https://capacitorjs.com" target="_blank">
    <img src="https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white" alt="Capacitor" />
  </a>
  <a href="https://developer.android.com" target="_blank">
    <img src="https://img.shields.io/badge/Android-34A853?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  </a>
  <a href="https://developer.mozilla.org/fr/docs/Web/JavaScript" target="_blank">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  </a>
</p>

Application de chatbot IA interactive, ultra-rapide et responsive, fonctionnelle sur **Web et Mobile (Android Natif)**. Le projet associe l'inférence du modèle **Llama 3.3 70B via Groq API**, la persistance des données multi-sessions avec **Supabase**, un backend serverless sécurisé sur **Vercel**, et un build natif cross-platform via **Capacitor**.

---

## ⚡️ Fonctionnalités Principales

* **📱 Multi-plateforme (Web & Android Natif) :** Interface PWA réactive utilisable sur navigateur et encapsulée en application Android native via Capacitor.
* **🧠 Mémoire Contextuelle & Multi-sessions :** Gestion de l'historique de conversation grâce à un identifiant unique par session (`session_id` UUID v4).
* **🗄️ Persistance des Données :** Sauvegarde automatique des échanges (utilisateur et bot) dans une base PostgreSQL hébergée sur Supabase.
* **🚀 Inférence Ultra-Rapide (Groq LPU) :** Génération de réponses quasi-instantanée grâce au modèle `llama-3.3-70b-versatile`.
* **✨ Effet Machine à Écrire (Typewriter) :** Rendu fluide et naturel des réponses générées mot par mot.
* **📝 Markdown & Coloration de Code :** Support du rendu Markdown (`Marked.js`) et surbrillance syntaxique des blocs de code (`Highlight.js`).
* **🎨 Interface Adaptative (Dark / Light Theme) :** Basculement dynamique du thème avec conservation de la préférence utilisateur.
* **🔒 Sécurité & Protection des Clés API :** Architecture backend serverless isolant les clés d'environnement sensibles et gestion complète du CORS pour WebView.

---

## 🛠️ Stack Technique

| Composant | Technologie | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Interface utilisateur réactive, animations et gestion du DOM. |
| **Mobile Native** | Capacitor JS | Bridge natif et compilation vers la plateforme Android. |
| **Parsing & Formatting** | Marked.js, Highlight.js, FontAwesome | Interprétation Markdown, coloration syntaxique et iconographie. |
| **Backend Serverless** | Node.js (Vercel Serverless API) | Masquage des clés API, routage et gestion des en-têtes CORS. |
| **IA / LLM Engine** | Groq API (`llama-3.3-70b-versatile`) | Inférence haute performance du modèle LLM. |
| **Base de Données** | Supabase (PostgreSQL) | Stockage persistant et structuré des historiques de discussion. |

---

## 🗂️ Structure du Projet

```text
mon-chatbot/
├── api/
│   ├── chat.js            # API Serverless (requêtes Groq & requêtes Supabase)
│   ├── history.js         # Récupération de l'historique par session
│   ├── sessions.js        # Récupération de la liste des sessions
│   └── delete-session.js # Suppression sécurisée de sessions
├── www/                   # Dossier de build distribué vers Capacitor
├── index.html             # Structure HTML5 principale
├── style.css              # Feuille de style globale avec variables thème
├── script.js              # Logique client, événements UI, gestion du cache & sessions
├── capacitor.config.ts    # Configuration du runtime natif Android / Capacitor
├── vercel.json            # Configuration du serveur Vercel & en-têtes CORS
└── README.md              # Documentation officielle du projet
