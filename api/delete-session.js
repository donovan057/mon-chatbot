import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée.' });

    const sessionId = req.query?.session_id || req.body?.session_id;
    if (!sessionId) return res.status(400).json({ error: 'Le paramètre session_id est requis.' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { error } = await supabase
          .from('conversations')
          .delete()
          .eq('session_id', sessionId);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Session supprimée avec succès' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}