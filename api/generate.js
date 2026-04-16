export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { profile } = req.body;

  const prompt = `Tu es un coach fitness et nutrition expert. Génère un plan COMPLET et TRÈS DÉTAILLÉ pour ce client.

PROFIL :
- Prénom : ${profile.prenom || 'Client'}
- Âge : ${profile.age} ans | Sexe : ${profile.sexe}
- Taille : ${profile.taille} cm | Poids : ${profile.poids} kg
- Niveau : ${profile.niveau}

OBJECTIF : ${profile.objectif}
ÉQUIPEMENT : ${profile.equip}
DISPONIBILITÉS : ${profile.jours} jours/semaine
RESTRICTIONS ALIMENTAIRES : ${profile.alim || 'aucune'}
NOTES : ${profile.extras || 'aucune'}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
{
  "training": "programme semaine complet avec tous les jours, exercices, séries, reps, temps de repos, conseils de progression",
  "nutrition": "plan alimentaire complet avec calories, macros, repas détaillés sur 1 journée type + conseils"
}`;

  try {
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiResp.json();
    const text = aiData.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);

    if (profile.email && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'EVRYØNE COACH <coach@evryonecoach.com>',
          to: [profile.email],
          subject: `${profile.prenom || 'Ton'} plan personnalisé EVRYØNE COACH`,
          html: `<pre style="font-family:Arial;line-height:1.8">${plan.training}\n\n${plan.nutrition}</pre>`,
        }),
      });
    }

    return res.status(200).json(plan);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
