const { Resend } = require('resend');

const DESTINATARIOS = ['gp.mesie@gmail.com', 'info@quenotelacuelen.com'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY no configurada');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Configuración de email no disponible' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
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
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'Quenotelacuelen <onboarding@resend.dev>',
      to: DESTINATARIOS,
      subject: 'NUEVO CONTRATO GANA ENERGÍA – ' + (nombre_titular || 'Sin nombre'),
      html,
      attachments: attachments.length ? attachments : undefined
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: error.message })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, id: data?.id })
    };
  } catch (err) {
    console.error('enviar-contrato error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
