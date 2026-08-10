import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 1. En-têtes CORS complets (Permet les requêtes depuis l'émulateur Android et Capacitor)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, PATCH, DELETE, POST, PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Réponse immédiate aux requêtes de pré-vérification (preflight) OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // 2. Vérification du Mode Maintenance via variable d'environnement
  if (process.env.MAINTENANCE_MODE === 'true') {
    return res.status(503).json({ 
      maintenance: true, 
      error: 'Le chatbot est actuellement en maintenance.' 
    });
  }

  // 3. Récupération et vérification des variables d'environnement
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERREUR: SUPABASE_URL ou SUPABASE_KEY/SUPABASE_ANON_KEY manquant.');
    return res.status(500).json({
      error: 'Variables SUPABASE_URL ou SUPABASE_KEY manquantes dans l’environnement.'
    });
  }

  if (!groqApiKey) {
    console.error('❌ ERREUR: GROQ_API_KEY manquante.');
    return res.status(500).json({
      error: 'Variable GROQ_API_KEY manquante dans l’environnement.'
    });
  }

  // 4. Initialisation du client Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 5. Extraction des données de la requête
  const { messages, message, session_id } = req.body || {};
  const activeSessionId = session_id || 'default-session';

  // System Prompt
  const systemPrompt = {
    role: 'system',
    content: 'Tu es un assistant IA précis, courtois et utile. Tu te souviens des messages précédents dans la conversation.'
  };

  let conversationPayload = [];

  if (Array.isArray(messages) && messages.length > 0) {
    conversationPayload = [systemPrompt, ...messages];
  } else if (message) {
    conversationPayload = [systemPrompt, { role: 'user', content: message }];
  } else {
    return res.status(400).json({ error: 'Aucun message fourni' });
  }

  // Extraire le dernier message utilisateur
  const lastUserMsg = conversationPayload.filter(m => m.role === 'user').pop()?.content || '';

  try {
    // 6. Enregistrement du message utilisateur dans Supabase
    if (lastUserMsg) {
      const { error: userInsertError } = await supabase
        .from('conversations')
        .insert([{ 
          sender: 'user', 
          message: lastUserMsg,
          session_id: activeSessionId
        }]);

      if (userInsertError) {
        console.error('Erreur Supabase (User) :', userInsertError.message);
      }
    }

    // 7. Envoi à l'API Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: conversationPayload,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur retournée par l’API Groq :', data);
      throw new Error(data.error?.message || 'Erreur Groq API');
    }

    const reply = data.choices?.[0]?.message?.content || "Désolé, une erreur est survenue.";

    // 8. Enregistrement de la réponse du bot dans Supabase
    const { error: botInsertError } = await supabase
      .from('conversations')
      .insert([{ 
        sender: 'bot', 
        message: reply,
        session_id: activeSessionId
      }]);

    if (botInsertError) {
      console.error('Erreur Supabase (Bot) :', botInsertError.message);
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Crash serveur dans api/chat.js :', error.message);
    return res.status(500).json({ error: error.message });
  }
}