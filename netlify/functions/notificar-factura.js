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

    const { nombre_titular, fuente, tipo, comercializadora, total_factura, ahorro_estimado, resultado, factura_url } = body;

    const esLuz = String(tipo || 'luz').toLowerCase() !== 'gas';
    const tipoIcon = esLuz ? '⚡' : '🔥';
    const tipoLabel = esLuz ? 'Luz' : 'Gas';
    const tipoColor = esLuz ? '#f59e0b' : '#ef4444';

    const ahorroNum = parseFloat(ahorro_estimado) || 0;
    const totalNum = parseFloat(total_factura) || 0;

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM || 'Quenotelacuelen <onboarding@resend.dev>';

    if (resultado === 'NO_SE_LA_ESTAN_COLANDO') {
      await resend.emails.send({
        from,
        to: ['gp.mesie@gmail.com'],
        subject: '✅ Resultado negativo — No se la están colando',
        html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="background:#1E6B3A;padding:20px 24px;">
            <div style="color:#fff;font-size:17px;font-weight:700;line-height:1.2;">✅ Resultado negativo</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">Esta persona NO tiene ahorro potencial actualmente.</div>
          </div>
          <div style="padding:16px 24px;display:flex;flex-direction:column;gap:10px;">
            <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;"><strong>Nombre titular:</strong> ${nombre_titular || '—'}</div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;"><strong>Comercializadora actual:</strong> ${comercializadora || '—'}</div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;"><strong>Tipo de factura:</strong> ${tipoLabel}</div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;"><strong>Total factura:</strong> ${totalNum ? totalNum.toFixed(2) + ' €' : '—'}</div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;"><strong>Ahorro estimado:</strong> 0 €</div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;"><strong>Fecha y hora del análisis:</strong> ${new Date().toLocaleString('es-ES')}</div>
            ${factura_url ? `<div style="background:#f8fafc;border-radius:10px;padding:12px 14px;"><strong>URL factura:</strong> <a href="${factura_url}" target="_blank" rel="noopener">${factura_url}</a></div>` : ''}
          </div>
          <div style="padding:12px 24px 16px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
            quenotelacuelen.com · ${fuente === 'lp' ? 'Landing Ads' : 'Web principal'}
          </div>
        </div>
      `
      });
    } else {
      await resend.emails.send({
        from,
        to: ['gp.mesie@gmail.com'],
        subject: `📄 ${tipoIcon} Nueva factura analizada — ${nombre_titular || 'Desconocido'}`,
        html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          
          <!-- HEADER -->
          <div style="background:#1E6B3A;padding:20px 24px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:24px;">📄</span>
            <div>
              <div style="color:#fff;font-size:16px;font-weight:700;line-height:1.2;">Nueva factura analizada</div>
              <div style="color:rgba(255,255,255,0.65);font-size:12px;margin-top:2px;">${new Date().toLocaleString('es-ES')}</div>
            </div>
          </div>

          <!-- TIPO BADGE -->
          <div style="padding:16px 24px 0;">
            <span style="display:inline-flex;align-items:center;gap:6px;background:${tipoColor}18;color:${tipoColor};border:1px solid ${tipoColor}30;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;">
              ${tipoIcon} Factura de ${tipoLabel}
            </span>
          </div>

          <!-- DATOS -->
          <div style="padding:16px 24px;display:flex;flex-direction:column;gap:10px;">
            
            <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Titular</div>
              <div style="font-size:15px;font-weight:600;color:#1a1a1a;">${nombre_titular || '—'}</div>
            </div>

            <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;">
              <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Comercializadora actual</div>
              <div style="font-size:14px;font-weight:500;color:#334155;">${comercializadora || '—'}</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Total factura</div>
                <div style="font-size:18px;font-weight:700;color:#1a1a1a;">${totalNum ? totalNum.toFixed(2) + ' €' : '—'}</div>
              </div>
              <div style="background:${ahorroNum > 0 ? '#fef2f2' : '#f8fafc'};border-radius:10px;padding:14px 16px;border:${ahorroNum > 0 ? '1px solid #fecaca' : '1px solid transparent'};">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Le están colando</div>
                <div style="font-size:18px;font-weight:700;color:${ahorroNum > 0 ? '#ef4444' : '#94a3b8'};">${ahorroNum > 0 ? ahorroNum + ' €/año' : '—'}</div>
              </div>
            </div>

          </div>

          <!-- FOOTER -->
          <div style="padding:12px 24px 16px;border-top:1px solid #f1f5f9;">
            <a href="https://resonant-rugelach-9fed79.netlify.app" style="display:inline-block;background:#1E6B3A;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;">Ver en el programa →</a>
            <div style="font-size:11px;color:#94a3b8;margin-top:8px;">quenotelacuelen.com · ${fuente === 'lp' ? 'Landing Ads' : 'Web principal'}</div>
          </div>

        </div>
      `
      });
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
