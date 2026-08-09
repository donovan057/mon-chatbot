import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const sessionId = req.query?.session_id || req.body?.session_id;

    if (!sessionId) {
        return res.status(400).json({ error: 'Le paramètre session_id est requis.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ ERREUR: SUPABASE_URL ou SUPABASE_KEY manquant.');
        return res.status(500).json({
            error: 'Variables Supabase manquantes dans l environnement.'
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, sender, message, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) {
            console.error('Erreur Supabase (History) :', error.message);
            throw error;
        }

        return res.status(200).json({ messages: data || [] });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}