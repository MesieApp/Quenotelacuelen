const STATE_PRIORITY = {
  pendiente_contrato: 0,
  contrato_enviado: 1,
  contrato_firmado: 2,
  activado: 3,
  baja: 4,
};

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const toDateYMD = (unixTs) => {
  if (!unixTs) return null;
  const date = new Date(Number(unixTs) * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const addMonthsToYMD = (ymd, monthsToAdd) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1 + monthsToAdd, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const addDaysToYMD = (ymd, daysToAdd) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d + daysToAdd));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const normalizeCups = (value) => (value || "").replace(/\s/g, "").trim().toUpperCase();

function mapEstadoGanaToSupabase(item) {
  const estadoNombre = (item?.estado?.nombre || "").toLowerCase();

  if (item?.fecha_baja) return "baja";
  if (item?.fecha_activacion) return "activado";
  if (item?.estadoid === 31 || item?.estadoid === 34) return "contrato_firmado";
  if (estadoNombre.includes("firmado")) return "contrato_firmado";
  return "contrato_enviado";
}

async function ganaLogin() {
  const username = process.env.GANA_USERNAME;
  const password = process.env.GANA_PASSWORD;

  if (!username || !password) {
    throw new Error("Faltan variables GANA_USERNAME o GANA_PASSWORD");
  }

  const res = await fetch("https://cerbero.ganaenergia.com/colaborador", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://colaboradores.ganaenergia.com",
      Referer: "https://colaboradores.ganaenergia.com/",
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.token) {
    throw new Error(`Login Gana fallido (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function fetchContratosGana(token) {
  const params = new URLSearchParams({
    paginacion: JSON.stringify({
      paginaActual: 1,
      tamanoPorPagina: 200,
      orden: null,
    }),
    filtros: JSON.stringify({
      fecha_creacion: { $gt: 1704067200, $lt: 1893456000 },
    }),
  });

  const url = `https://backcolaboradores2.ganaenergia.com/estadisticas?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Origin: "https://colaboradores.ganaenergia.com",
      Referer: "https://colaboradores.ganaenergia.com/",
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(`Fetch contratos Gana fallido (${res.status}): ${JSON.stringify(data)}`);
  }
  return Array.isArray(data.list) ? data.list : [];
}

async function fetchContratosSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan variables SUPABASE_URL o SUPABASE_KEY");
  }

  const url =
    `${supabaseUrl}/rest/v1/contratos` +
    "?select=id,cups,estado,id_gana,fecha_contrato_firmado,fecha_activado,fecha_baja" +
    "&cups=not.is.null";

  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  const data = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(`Fetch contratos Supabase fallido (${res.status}): ${JSON.stringify(data)}`);
  }
  return Array.isArray(data) ? data : [];
}

async function updateContratoSupabase(id, payload) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const url = `${supabaseUrl}/rest/v1/contratos?id=eq.${id}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH contrato ${id} fallido (${res.status}): ${text}`);
  }
}

async function runSync() {
  console.log("[sync-gana] Inicio de sincronizacion");

  const token = await ganaLogin();
  console.log("[sync-gana] Login Gana OK");

  const ganaContratos = await fetchContratosGana(token);
  console.log(`[sync-gana] Contratos recibidos de Gana: ${ganaContratos.length}`);

  const supabaseContratos = await fetchContratosSupabase();
  console.log(`[sync-gana] Contratos recuperados de Supabase: ${supabaseContratos.length}`);

  const supabaseByCups = new Map();
  for (const row of supabaseContratos) {
    const key = normalizeCups(row.cups);
    if (!key) continue;
    supabaseByCups.set(key, row);
  }

  let matched = 0;
  let updated = 0;
  let onlyIdGanaUpdated = 0;
  let skippedNoAdvance = 0;

  for (const ganaItem of ganaContratos) {
    const key = normalizeCups(ganaItem.cups);
    if (!key) continue;

    const contratoDb = supabaseByCups.get(key);
    if (!contratoDb) continue;
    matched += 1;

    const payload = {};
    const ganaId = ganaItem.id_contrato ?? null;
    if (!contratoDb.id_gana && ganaId) {
      payload.id_gana = Number(ganaId);
    }

    const nextEstado = mapEstadoGanaToSupabase(ganaItem);
    const currentEstado = contratoDb.estado || "pendiente_contrato";
    const currentPriority = STATE_PRIORITY[currentEstado] ?? 0;
    const nextPriority = nextEstado ? STATE_PRIORITY[nextEstado] ?? 0 : currentPriority;

    if (nextEstado && nextPriority > currentPriority) {
      payload.estado = nextEstado;
      if (nextEstado === "contrato_firmado") {
        payload.fecha_contrato_firmado = toDateYMD(ganaItem.fecha_estado);
      } else if (nextEstado === "activado") {
        payload.fecha_activado = toDateYMD(ganaItem.fecha_activacion);
        if (payload.fecha_activado) {
          payload.fecha_pago_1 = addDaysToYMD(addMonthsToYMD(payload.fecha_activado, 3), 1);
          payload.fecha_pago_2 = addMonthsToYMD(payload.fecha_pago_1, 3);
          payload.fecha_pago_3 = addMonthsToYMD(payload.fecha_pago_2, 3);
          payload.fecha_pago_4 = addMonthsToYMD(payload.fecha_pago_3, 3);
        }
      } else if (nextEstado === "baja") {
        payload.fecha_baja = toDateYMD(ganaItem.fecha_baja);
      }
    } else if (nextEstado && nextPriority <= currentPriority) {
      skippedNoAdvance += 1;
    }

    if (Object.keys(payload).length > 0) {
      await updateContratoSupabase(contratoDb.id, payload);
      updated += 1;
      if (Object.keys(payload).length === 1 && payload.id_gana) {
        onlyIdGanaUpdated += 1;
      }
      console.log(
        `[sync-gana] Actualizado contrato id=${contratoDb.id}, cups=${key}, payload=${JSON.stringify(payload)}`
      );
    }
  }

  const summary = {
    ok: true,
    totalGana: ganaContratos.length,
    totalSupabase: supabaseContratos.length,
    matched,
    updated,
    onlyIdGanaUpdated,
    skippedNoAdvance,
  };

  console.log("[sync-gana] Fin de sincronizacion", summary);
  return summary;
}

export const config = {
  schedule: "*/30 * * * *",
};

export default async function handler() {
  try {
    const result = await runSync();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("[sync-gana] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || String(error),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
