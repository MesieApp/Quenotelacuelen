const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    
    const client = new Anthropic({ apiKey: process.env.mesiekey });
    
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: `Extrae estos datos de la factura eléctrica española en JSON sin texto adicional. Para el desglose en euros (termino_potencia, termino_energia, etc.) busca las líneas del detalle de la factura. Si no aparece, usa null:
{
  "comercializadora": "nombre",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD",
  "dias": número,
  "potencia_p1": kW,
  "potencia_p2": kW,
  "kwh_punta": kWh,
  "kwh_llano": kWh,
  "kwh_valle": kWh,
  "total_factura": euros con IVA,
  "tarifa": "nombre tarifa",
  "cups": "código CUPS",
  "direccion": "dirección suministro",
  "nombre_titular": "nombre completo titular",
  "dni": "DNI o NIF",
  "bono_social": euros sin IVA o null,
  "imp_electrico_pct": porcentaje decimal,
  "termino_potencia_euros": euros término potencia o null,
  "termino_energia_euros": euros término energía o null,
  "impuesto_electrico_euros": euros impuesto electricidad o null,
  "alquiler_contador_euros": euros alquiler contador o null,
  "iva_euros": euros IVA o null,
  "margen_comercial_euros": euros margen comercial o null
}` }
        ]
      }]
    });

    const text = response.content.map(b => b.text || '').join('').trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, data })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
