// api/generate.js
// Génère le plan personnalisé via Claude et le sauvegarde dans Supabase

const SUPABASE_URL = 'https://rusqjfimppgcxusnwyzq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function sbInsert(table, data) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(data),
  });
  return resp.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { profile } = req.body;

  const prompt = `Tu es un coach fitness et nutrition expert. Génère un plan COMPLET pour ce client.

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
  "training": "programme semaine complet avec tous les jours, exercices, séries, reps, temps de repos",
  "nutrition": "plan alimentaire complet avec calories totales, macros, et liste des repas détaillés",
  "meals": [
    {
      "name": "🌅 Petit-déjeuner",
      "description": "description des aliments",
      "kcal": nombre,
      "protein": grammes,
      "carbs": grammes,
      "fat": grammes
    },
    {
      "name": "☀️ Déjeuner",
      "description": "description des aliments",
      "kcal": nombre,
      "protein": grammes,
      "carbs": grammes,
      "fat": grammes
    },
    {
      "name": "🍎 Collation",
      "description": "description des aliments",
      "kcal": nombre,
      "protein": grammes,
      "carbs": grammes,
      "fat": grammes
    },
    {
      "name": "🌙 Dîner",
      "description": "description des aliments",
      "kcal": nombre,
      "protein": grammes,
      "carbs": grammes,
      "fat": grammes
    }
  ],
  "total_kcal": nombre,
  "total_protein": grammes,
  "total_carbs": grammes,
  "total_fat": grammes
}`;

  try {
    // 1. Génération du plan via Claude
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiResp.json();
    const text = aiData.content?.map(b => b.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(clean);

    // 2. Sauvegarde dans Supabase
    if (profile.email && SUPABASE_KEY) {
      try {
        // Crée ou met à jour le client
        await sbInsert('clients', {
          email: profile.email,
          prenom: profile.prenom || '',
          plan: profile.plan || 'starter',
        });

        // Sauvegarde le programme complet
        await sbInsert('programmes', {
          email: profile.email,
          training: plan.training,
          nutrition: plan.nutrition,
          meals: JSON.stringify(plan.meals || []),
          total_kcal: plan.total_kcal || 2000,
          total_protein: plan.total_protein || 150,
          total_carbs: plan.total_carbs || 200,
          total_fat: plan.total_fat || 70,
          profil: JSON.stringify(profile),
          mois: 1,
        });
      } catch (dbErr) {
        console.error('Supabase error:', dbErr);
        // Continue même si la sauvegarde échoue
      }
    }

    // 3. Envoi email via Resend
    if (profile.email && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'EVRYØNE COACH <coach@evryoneclub.com>',
          to: [profile.email],
          subject: `${profile.prenom || 'Ton'} plan personnalisé EVRYØNE COACH`,
          html: buildEmailHTML(profile, plan),
        }),
      });
    }

    return res.status(200).json(plan);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function buildEmailHTML(profile, plan) {
  const mealsHTML = (plan.meals || []).map(m => `
    <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-weight:600;font-size:15px">${m.name}</div>
        <div style="color:#ff3333;font-weight:700;font-size:16px">${m.kcal} kcal</div>
      </div>
      <div style="color:#888;font-size:13px;margin-bottom:6px">${m.description}</div>
      <div style="font-size:12px;color:#666">P: ${m.protein}g · G: ${m.carbs}g · L: ${m.fat}g</div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#0a0a0a;color:#f0f0f0;font-family:Arial,sans-serif;padding:40px 20px;margin:0">
  <div style="max-width:600px;margin:0 auto">
    <div style="font-size:13px;letter-spacing:0.25em;color:#ff3333;margin-bottom:8px">EVRYØNE COACH</div>
    <h1 style="font-size:36px;font-weight:900;margin-bottom:4px">TON PLAN <span style="color:#ff3333">EST PRÊT</span></h1>
    <p style="color:#666;margin-bottom:32px">Créé spécialement pour ${profile.prenom || 'toi'}</p>

    <div style="background:#161616;border:1px solid #222;border-radius:16px;padding:24px;margin-bottom:20px">
      <h2 style="color:#ff3333;font-size:20px;margin-bottom:16px">🏋️ Programme d'entraînement</h2>
      <pre style="white-space:pre-wrap;font-family:Arial;font-size:14px;line-height:1.8;color:#ccc">${plan.training}</pre>
    </div>

    <div style="background:#161616;border:1px solid #222;border-radius:16px;padding:24px;margin-bottom:20px">
      <h2 style="color:#ff3333;font-size:20px;margin-bottom:8px">🥗 Plan alimentaire</h2>
      <div style="color:#666;font-size:13px;margin-bottom:16px">
        Total : ${plan.total_kcal || '—'} kcal · P: ${plan.total_protein || '—'}g · G: ${plan.total_carbs || '—'}g · L: ${plan.total_fat || '—'}g
      </div>
      ${mealsHTML}
    </div>

    <div style="background:#161616;border:1px solid rgba(255,51,51,0.2);border-radius:16px;padding:20px;text-align:center;margin-bottom:20px">
      <div style="color:#666;font-size:13px;margin-bottom:12px">Retrouve ton programme complet dans ton tracker</div>
      <a href="https://tracker.evryoneclub.com" style="display:inline-block;background:#ff3333;color:#fff;padding:12px 28px;border-radius:99px;font-weight:600;text-decoration:none;font-size:15px">Ouvrir mon tracker →</a>
    </div>

    <div style="color:#333;font-size:12px;text-align:center">EVRYØNE COACH — tracker.evryoneclub.com</div>
  </div>
</body>
</html>`;
}
