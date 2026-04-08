const { Resend } = require('resend');

const DESTINATARIOS = ['gp.mesie@gmail.com'];

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
    const { tipo, cups, direccion, nombre_titular, dni, iban_cargo, iban_bono, email, pdfBase64, comercializadora_nueva } = body;

    const isPayloadSimplificado =
      !!nombre_titular &&
      !!tipo &&
      !!cups &&
      !dni &&
      !email &&
      !iban_cargo &&
      !iban_bono &&
      !direccion &&
      !pdfBase64;

    const attachments = [];
    if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.length > 100) {
      try {
        const buf = Buffer.from(pdfBase64, 'base64');
        attachments.push({ filename: 'factura.pdf', content: buf });
      } catch (e) {
        console.warn('No se pudo adjuntar PDF:', e.message);
      }
    }

    const html = isPayloadSimplificado
      ? `
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          
          <div style="background:#dc2626;padding:20px 24px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:28px;">🚨</span>
            <div>
              <div style="color:#fff;font-size:16px;font-weight:700;line-height:1.2;">Solicitud de cambio de tarifa</div>
              <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:2px;">${new Date().toLocaleString('es-ES')}</div>
            </div>
          </div>

          <div style="padding:16px 24px 0;">
            <span style="display:inline-flex;align-items:center;gap:6px;background:${String(tipo||'luz').toLowerCase()==='gas'?'#ef444418':'#f59e0b18'};color:${String(tipo||'luz').toLowerCase()==='gas'?'#ef4444':'#f59e0b'};border:1px solid ${String(tipo||'luz').toLowerCase()==='gas'?'#ef444430':'#f59e0b30'};border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;">
              ${String(tipo||'luz').toLowerCase()==='gas'?'🔥 Gas':'⚡ Luz'}
            </span>
          </div>

          <div style="padding:16px 24px;display:flex;flex-direction:column;gap:10px;">

            <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Titular</div>
              <div style="font-size:15px;font-weight:600;color:#1a1a1a;">${nombre_titular || '—'}</div>
            </div>

            <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">CUPS</div>
              <div style="font-size:13px;font-weight:500;color:#334155;font-family:monospace;">${cups || '—'}</div>
            </div>

            <div style="background:#fef0f0;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Comercializadora nueva</div>
              <div style="font-size:15px;font-weight:700;color:#1E6B3A;">${comercializadora_nueva || 'Gana Energía'}</div>
            </div>

          </div>

          <div style="padding:12px 24px 16px;border-top:1px solid #f1f5f9;">
            <a href="https://resonant-rugelach-9fed79.netlify.app" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;">Ver en el programa →</a>
            <div style="font-size:11px;color:#94a3b8;margin-top:8px;">quenotelacuelen.com</div>
          </div>

        </div>
      `
      : `
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
    const subject = isPayloadSimplificado
      ? `🚨 Nueva solicitud — ${comercializadora_nueva || 'Gana Energía'}`
      : 'NUEVO CONTRATO GANA ENERGÍA – ' + (nombre_titular || 'Sin nombre');
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
