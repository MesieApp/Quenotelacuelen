const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pdfBase64, imageBase64, imageBase64_2, imageMediaType } = JSON.parse(event.body);

    if (!pdfBase64 && !imageBase64) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'No se ha recibido ningún archivo.' })
      };
    }

    const client = new Anthropic({ apiKey: process.env.mesiekey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          pdfBase64
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } }
            : { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
          ...(imageBase64_2 ? [{ type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64_2 } }] : []),
          {
            type: 'text',
            text: `Eres un experto en facturas energéticas españolas. Analiza esta factura y extrae los datos en formato JSON puro, sin texto adicional, sin bloques de código, sin explicaciones. Solo el JSON.

Detecta si es factura de LUZ o GAS y rellena los campos correspondientes. Si un dato no aparece en la factura, usa null. Sé muy preciso con los números, cópialos exactamente como aparecen.

CAMPOS COMUNES:
- tipo_factura: "luz" o "gas"
- comercializadora: nombre de la empresa que emite la factura
- fecha_inicio: fecha inicio del período en formato YYYY-MM-DD
- fecha_fin: fecha fin del período en formato YYYY-MM-DD
- dias: número exacto de días del período facturado
- total_factura: importe total final con IVA incluido (el "TOTAL IMPORTE FACTURA" o equivalente final a pagar)
- tarifa: nombre de la tarifa contratada
- cups: código CUPS completo (empieza por ES)
- direccion: dirección completa del punto de suministro
- provincia: provincia del punto de suministro extraída de la dirección. Usar nombre oficial español en mayúsculas. Ejemplos: "MADRID", "BARCELONA", "VALENCIA", "SEVILLA". Si no aparece explícitamente, deducirla de la dirección o del municipio. Si no es posible deducirla, null.
- nombre_titular: nombre completo del titular del contrato
- dni: DNI o NIF del titular
- alquiler_contador_euros: importe del alquiler del contador sin IVA
- iva_euros: importe total del IVA
- total_electricidad_euros: importe total de electricidad SIN IVA (solo el suministro eléctrico puro, sin servicios adicionales como seguros). En facturas Naturgy es el campo "Total electricidad".
- servicios_adicionales_euros: importe total de servicios adicionales SIN IVA (seguros, mantenimientos, etc. que no son suministro eléctrico). Si no hay servicios adicionales, null.
- detalle_servicios: array de objetos con los servicios adicionales detectados. Cada objeto tiene "nombre" y "importe_mes" (importe mensual neto con descuentos aplicados). Si no hay servicios, array vacío [].

Ejemplo de detalle_servicios:
[
  {"nombre": "Servielectric Xpress Piezas", "importe_mes": 6.70},
  {"nombre": "Servigas Complet Agua Caliente", "importe_mes": 7.85},
  {"nombre": "Servihogar", "importe_mes": 4.01}
]

SOLO SI ES LUZ:
- potencia_p1: potencia contratada P1 en kW
- potencia_p2: potencia contratada P2 en kW
- kwh_punta: kWh consumidos en hora punta
- kwh_llano: kWh consumidos en hora llano
- kwh_valle: kWh consumidos en hora valle
- kwh_total: kWh totales consumidos (suma de los tres tramos o total si no hay discriminación horaria)
- termino_potencia_euros: importe del término de potencia sin IVA
- termino_energia_euros: importe del término de energía sin IVA
- impuesto_electrico_euros: importe del impuesto sobre electricidad
- imp_electrico_pct: porcentaje del impuesto eléctrico como decimal (normalmente 0.0511269632)
- bono_social: importe del bono social en euros si aparece, null si no aplica
- tiene_discriminacion_horaria: true si la factura distingue punta/llano/valle, false si no
- precio_kwh_unico: precio €/kWh si la factura tiene un único precio para toda la energía (sin distinguir tramos). Ejemplo: 0.108000
- precio_kwh_punta: precio €/kWh en hora punta si aparece desglosado por tramos
- precio_kwh_llano: precio €/kWh en hora llano si aparece desglosado por tramos
- precio_kwh_valle: precio €/kWh en hora valle si aparece desglosado por tramos

IMPORTANTE: Si la factura de luz es de precio fijo (un único precio €/kWh para todas las horas, sin discriminación horaria punta/llano/valle), rellena precio_kwh_unico con ese valor y deja precio_kwh_punta, precio_kwh_llano y precio_kwh_valle como null. Si tiene discriminación horaria (precios distintos por tramo), precio_kwh_unico debe ser null y hay que rellenar los tres tramos.

SOLO SI ES GAS:
- kwh_gas: kWh totales de gas consumidos
- precio_kwh_gas: precio €/kWh del consumo de gas SIN incluir impuesto de hidrocarburos. Está en el detalle de la factura como "X kWh x 0.XXXXXX €/kWh". Ejemplo en esta factura: "4.611 kWh x 0,062460 €/kWh" → extraer 0.062460. Es OBLIGATORIO extraer este campo si aparece en la factura.
- segmento_gas: segmento de consumo. IMPORTANTE: búscalo en la factura. Puede aparecer como "RL.1" (consumo anual hasta 5.000 kWh), "RL.2" (entre 5.000 y 50.000 kWh) o "RL.3" (más de 50.000 kWh). Si no aparece explícitamente, dedúcelo del consumo anual estimado o del término fijo
- termino_fijo_euros: importe total del término fijo en la factura, sin IVA
- termino_variable_euros: importe total del término variable/consumo de gas en la factura, sin IVA
- impuesto_hidrocarburos_euros: importe del impuesto sobre hidrocarburos
- detalle_servicios: array de objetos {nombre, importe_mes, importe_total} con servicios adicionales que NO sean energía, término fijo ni alquiler de contador (seguros, packs mantenimiento, protección de pagos, etc.). Si no hay, []
- descuentos: array de objetos {nombre, importe} con descuentos detectados como líneas de resta (importe negativo). Si no hay, []`
          }
        ]
      }]
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Limpieza defensiva del JSON
    const clean = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let data;
    try {
      data = JSON.parse(clean);
    } catch (parseErr) {
      console.error('Error parseando JSON de Claude:', clean);
      return {
        statusCode: 422,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'No pudimos leer los datos de la factura. Asegúrate de que el PDF es legible y contiene una factura de luz o gas.'
        })
      };
    }

    // Validación mínima
    if (!data.tipo_factura || !data.total_factura) {
      return {
        statusCode: 422,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'El PDF no parece ser una factura de luz o gas válida.'
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, data })
    };

  } catch (err) {
    console.error('Error en analizar.js:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: 'Error interno del servidor. Inténtalo de nuevo.'
      })
    };
  }
};