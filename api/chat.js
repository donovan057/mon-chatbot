import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // 1. Récupération et vérification des variables d'environnement
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Variables SUPABASE_URL ou SUPABASE_KEY manquantes dans l’environnement.'
    });
  }

  if (!groqApiKey) {
    return res.status(500).json({
      error: 'Variable GROQ_API_KEY manquante dans l’environnement.'
    });
  }

  // 2. Initialisation du client Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 3. Extraction des données de la requête
  const { messages, message, session_id } = req.body;
  const activeSessionId = session_id || 'default-session';

  // System Prompt pour définir le comportement du bot
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

  // Extraire le dernier message utilisateur pour l'enregistrement
  const lastUserMsg = conversationPayload.filter(m => m.role === 'user').pop()?.content || '';

  try {
    // 4. Enregistrement du message utilisateur avec vérification d'erreur
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

    // 5. Envoi à l'API Groq
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
      throw new Error(data.error?.message || 'Erreur Groq API');
    }

    const reply = data.choices?.[0]?.message?.content || "Désolé, une erreur est survenue.";

    // 6. Enregistrement de la réponse du bot avec vérification d'erreur
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
    return res.status(500).json({ error: error.message });
  }
}