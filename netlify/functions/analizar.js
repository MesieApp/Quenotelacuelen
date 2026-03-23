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
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: `Analiza esta factura de suministro energético español y extrae los datos en JSON sin texto adicional. Detecta automáticamente si es una factura de GAS o de LUZ/ELECTRICIDAD. Si no aparece un dato, usa null:
{
  "tipo_factura": "luz" o "gas",
  "comercializadora": "nombre",
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD",
  "dias": número,
  "total_factura": euros con IVA,
  "tarifa": "nombre tarifa",
  "cups": "código CUPS",
  "direccion": "dirección suministro",
  "nombre_titular": "nombre completo titular",
  "dni": "DNI o NIF",

  "potencia_p1": kW (solo luz),
  "potencia_p2": kW (solo luz),
  "kwh_punta": kWh (solo luz),
  "kwh_llano": kWh (solo luz),
  "kwh_valle": kWh (solo luz),
  "bono_social": euros sin IVA o null (solo luz),
  "imp_electrico_pct": porcentaje decimal (solo luz),
  "termino_potencia_euros": euros o null (solo luz),
  "termino_energia_euros": euros o null (solo luz),
  "impuesto_electrico_euros": euros o null (solo luz),
  "alquiler_contador_euros": euros o null,
  "iva_euros": euros o null,
  "margen_comercial_euros": euros o null,

  "kwh_gas": kWh totales consumidos (solo gas),
  "segmento_gas": "RL.1", "RL.2" o "RL.3" (solo gas, busca en la factura),
  "termino_fijo_euros": euros término fijo sin IVA (solo gas),
  "termino_variable_euros": euros término variable sin IVA (solo gas),
  "impuesto_hidrocarburos_euros": euros impuesto hidrocarburos (solo gas)
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
