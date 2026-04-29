const { Resend } = require('resend');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key;
  if (!apiKey) {
    console.error('RESEND_API_KEY no configurada');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'RESEND_API_KEY no configurada en Netlify.' })
    };
  }

  try {
    let body = {};
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    } catch (_) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Body JSON inválido' }) };
    }

    const { telefono } = body;
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: process.env.RESEND_FROM || 'Quenotelacuelen <onboarding@resend.dev>',
      to: 'gp.mesie@gmail.com',
      subject: '📱 Nuevo número de WhatsApp — quenotelacuelen.com',
      html: `
        <div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:2rem;">
          <div style="background:#1E6B3A; border-radius:12px; padding:1.5rem; text-align:center; margin-bottom:1.5rem;">
            <h2 style="color:#fff; margin:0; font-size:1.2rem;">📱 Nuevo contacto por WhatsApp</h2>
          </div>
          <p style="font-size:1rem; color:#1a1a1a;">Alguien ha dejado su número porque <strong>no tenía la factura a mano</strong>.</p>
          <div style="background:#f0faf2; border:1px solid #d1e7d8; border-radius:10px; padding:1.25rem; margin:1.5rem 0; text-align:center;">
            <p style="font-size:0.75rem; color:#64748b; margin:0 0 0.5rem; text-transform:uppercase; letter-spacing:0.05em;">Número de WhatsApp</p>
            <p style="font-size:2rem; font-weight:700; color:#1E6B3A; margin:0;">+34 ${telefono}</p>
          </div>
          <a href="https://wa.me/34${telefono}" 
             style="display:block; background:#25D366; color:#fff; text-decoration:none; text-align:center; padding:1rem; border-radius:10px; font-weight:600; font-size:1rem;">
            💬 Abrir WhatsApp
          </a>
          <p style="font-size:0.75rem; color:#94a3b8; margin-top:1.5rem; text-align:center;">quenotelacuelen.com</p>
        </div>
      `
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('Error notificar-telefono:', err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
