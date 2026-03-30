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
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'RESEND_API_KEY no configurada' }) };
  }

  try {
    let body = {};
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    } catch (_) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Body JSON inválido' }) };
    }

    const { nombre_titular, fuente } = body;

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM || 'Quenotelacuelen <onboarding@resend.dev>';

    await resend.emails.send({
      from,
      to: ['gp.mesie@gmail.com'],
      subject: '📄 Nueva factura analizada — ' + (nombre_titular || 'Desconocido'),
      html: `
        <p style="font-family:sans-serif;font-size:1rem;">
          <strong>${nombre_titular || 'Titular desconocido'}</strong> 
          acaba de analizar su factura en quenotelacuelen.com
          ${fuente === 'lp' ? '(desde la landing de Ads)' : '(desde la web principal)'}.
        </p>
        <p style="font-family:sans-serif;font-size:0.8rem;color:#94a3b8;">
          ${new Date().toLocaleString('es-ES')}
        </p>
      `
    });

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
