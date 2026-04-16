export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, email, profile } = req.body;

  const PRICE_IDS = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro:     process.env.STRIPE_PRICE_PRO,
  };

  const priceId = PRICE_IDS[plan];
  if (!priceId) return res.status(400).json({ error: 'Plan invalide' });

  const profileEncoded = encodeURIComponent(JSON.stringify(profile));
  const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;

  try {
    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'customer_email': email,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${baseUrl}/?success=1&profile=${profileEncoded}`,
        'cancel_url': `${baseUrl}/?cancelled=1`,
        'metadata[profile]': JSON.stringify(profile),
      }),
    });

    const session = await stripeResp.json();
    if (session.error) return res.status(400).json({ error: session.error.message });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
