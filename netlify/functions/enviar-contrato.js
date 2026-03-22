const { Resend } = require('resend');

const DESTINATARIOS = ['gp.mesie@gmail.com', 'info@quenotelacuelen.com'];

const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

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
      body: JSON.stringify({ error: 'RESEND_API_KEY no configurada en Netlify. Ve a Site settings > Environment variables.' })
    };
  }

  try {
    let body = {};
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    } catch (_) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Body JSON inválido' }) };
    }
    const { tipo, cups, direccion, nombre_titular, dni, iban_cargo, iban_bono, email, pdfBase64 } = body;

    const attachments = [];
    if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.length > 100) {
      try {
        const buf = Buffer.from(pdfBase64, 'base64');
        attachments.push({ filename: 'factura.pdf', content: buf });
      } catch (e) {
        console.warn('No se pudo adjuntar PDF:', e.message);
      }
    }

    const html = `
      <h2>Nuevo contrato Gana Energía</h2>
      <p><strong>Tipo:</strong> ${tipo || '—'}</p>
      <p><strong>CUPS:</strong> ${cups || '—'}</p>
      <p><strong>Dirección:</strong> ${direccion || '—'}</p>
      <p><strong>Titular:</strong> ${nombre_titular || '—'}</p>
      <p><strong>DNI:</strong> ${dni || '—'}</p>
      <p><strong>IBAN cargo factura:</strong> ${iban_cargo || '—'}</p>
      <p><strong>IBAN bono fidelidad:</strong> ${iban_bono || '—'}</p>
      <p><strong>Email contacto:</strong> ${email || '—'}</p>
      <hr>
      <p style="color:#666;font-size:12px;">Enviado desde quenotelacuelen.com</p>
    `;

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM || 'Quenotelacuelen <onboarding@resend.dev>';
    const subject = 'NUEVO CONTRATO GANA ENERGÍA – ' + (nombre_titular || 'Sin nombre');
    const emailPayload = { from, subject, html, attachments: attachments.length ? attachments : undefined };

    let lastError = null;
    for (const to of DESTINATARIOS) {
      const { data, error } = await resend.emails.send({ ...emailPayload, to: [to] });
      if (error) {
        console.error('Resend error para', to, error);
        lastError = error;
      }
    }

    if (lastError) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: lastError?.message || (typeof lastError === 'object' ? JSON.stringify(lastError) : String(lastError)) || 'Error al enviar con Resend' })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('enviar-contrato error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
};
