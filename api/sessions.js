import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Variables Supabase manquantes dans .env' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('session_id, message, sender, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur Supabase (Sessions) :', error.message);
      return res.status(500).json({ error: error.message });
    }

    const sessionsMap = new Map();

    (data || []).forEach((row) => {
      if (row.session_id && !sessionsMap.has(row.session_id)) {
        const text = row.message || 'Discussion';
        const previewText = text.length > 28 ? text.substring(0, 28) + '...' : text;

        sessionsMap.set(row.session_id, {
          session_id: row.session_id,
          last_updated: row.created_at,
          preview: previewText
        });
      }
    });

    const sessions = Array.from(sessionsMap.values());
    return res.status(200).json({ sessions });

  } catch (err) {
    console.error('Erreur Serveur (Sessions) :', err);
    return res.status(500).json({ error: err.message || 'Erreur interne du serveur' });
  }
}