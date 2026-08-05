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

  // 2. Initialisation sécurisée du client Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { messages, message } = req.body;

  // System Prompt pour définir le comportement du bot
  const systemPrompt = {
    role: 'system',
    content: 'Tu es un assistant IA précis, courtois et utile. Tu te souviens des messages précédents dans la conversation.'
  };

  let conversationPayload = [];

  if (Array.isArray(messages) && messages.length > 0) {
    // Si le frontend transmet le tableau d'historique
    conversationPayload = [systemPrompt, ...messages];
  } else if (message) {
    // Fallback rétrocompatible pour message unique
    conversationPayload = [systemPrompt, { role: 'user', content: message }];
  } else {
    return res.status(400).json({ error: 'Aucun message fourni' });
  }

  // Extraire le tout dernier message utilisateur pour l'enregistrement Supabase
  const lastUserMsg = conversationPayload.filter(m => m.role === 'user').pop()?.content || '';

  try {
    // 3. Sauvegarder le message utilisateur dans Supabase
    if (lastUserMsg) {
      await supabase.from('conversations').insert([{ sender: 'user', message: lastUserMsg }]);
    }

    // 4. Envoyer TOUT l'historique à l'API Groq
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

    // 5. Sauvegarder la réponse du bot dans Supabase
    await supabase.from('conversations').insert([{ sender: 'bot', message: reply }]);

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}