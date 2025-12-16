

// index.js - API mínima para hospitals + submissions + inventories + report
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));

// CONFIG
const API_TOKEN = process.env.API_TOKEN || ""; // si se configura, protege endpoints de escritura/reporte
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://historia:goguejrJmwgVadUKqM24DUoHtBUHVcui@dpg-d4o8kaf5r7bs73cqma20-a.oregon-postgres.render.com/base_de_datos_estomatologia"; // si está, se usa Postgres
const USE_DB = !!DATABASE_URL;

// FILE STORAGE fallback
const DATA_DIR = path.join(__dirname, "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const INVENT_DIR = path.join(DATA_DIR, "inventories");

// CORS configurable vía env ALLOW_ORIGINS (coma-separados). Si no, permite cualquier origen.
const allowOriginsEnv = (process.env.ALLOW_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
const corsOptions = allowOriginsEnv.length
  ? {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowOriginsEnv.includes(origin)) return cb(null, true);
        return cb(new Error("CORS origin denied"));
      }
    }
  : { origin: true };
app.use(cors(corsOptions));

// ======================
// DB POOL (si aplica)
// ======================
let pool = null;
if (USE_DB) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    // En plataformas como Render es habitual requerir SSL; ajustar según entorno.
    ssl: { rejectUnauthorized: false }
  });

  // opcional: probar conexión al iniciar
  pool.connect().then(client => {
    client.release();
    console.log("Conexión a PostgreSQL OK (POOL inicializado).");
  }).catch(err => {
    console.warn("Advertencia: no se pudo conectar a Postgres al iniciar:", err.message || err);
  });
}

// ======================
// HOSPITALES (lista fija)
// ======================
const HOSPITALES = [
  { nombre: "Centro de Alta Especialidad DR.Rafael Lucio", clave: "VZIM002330" },
  { nombre: "Centro de Salud Con Hospitalizacion De Alto Lucero de Gutierrez Barrios,Ver.", clave: "VZIM008065" },
  { nombre: "Centro De Salud con Hospitalizacion De la localidad de Allende, Ver.", clave: "VZIM007942" },
  { nombre: "Centro Estatal de Cancerologia Dr.Miguel Dorantes Mesa", clave: "VZIM002325" },
  { nombre: "Hospital Comunitario de Ixhuatlan del Sureste", clave: "VZIM002120" },
  { nombre: "Hospital Comunitario de Tonalapan", clave: "VZIM006122" },
  { nombre: "Hospital de Alta Especialidad de Vearacruz", clave: "VZIM005533" },
  { nombre: "Hospital de la Comunidad Catemaco", clave: "VZIM000691" },
  { nombre: "Hospital de la Comunidad de Coatepec", clave: "VZIM000790" },
  { nombre: "Hospital de la Comunidad de Alvarado", clave: "VZIM000254" },
  { nombre: "Hospital de la Comunidad de Cerro Azul", clave: "VZIM006180" },
  { nombre: "Hospital de la Cumunidad de Entabladero", clave: "VZIM006163" },
  { nombre: "Hospital de la Comunidad de Gutierrez Zamora", clave: "VZIM001794" },
  { nombre: "Hospital de la Comunidad de Huayacocotla", clave: "VZIM001922" },
  { nombre: "Hospital de la Comunidad de Jose Azueta", clave: "VZIM007860" },
  { nombre: "Hospital de la Comunidad de Llano de en medio", clave: "VZIM006151" },
  { nombre: "Hospital de la Comunidad de Naolinco", clave: "VZIM007732" },
  { nombre: "Hospital de la Comunidad de Tempoal", clave: "VZIM004710" },
  { nombre: "Hospital de la comunidad de Teocelo", clave: "VZIM004775" },
  { nombre: "Hospital de la comunidad de Tezonapa", clave: "VZIM006146" },
  { nombre: "Hospital de la comunidad de Tlaquilpan Vista Hermosa", clave: "VZIM006134" },
  { nombre: "Hospital de la Comunidad Dr.Pedro Coronel Perez", clave: "VZIM015425" },
  { nombre: "Hospital de la Comunidad La Laguna Poblado 6", clave: "VZIM007573" },
  { nombre: "Hospital de la Comunidad Naranjos", clave: "VZIM000416" },
  { nombre: "Hospital de la Comunidad Ozuluama de Mascareñas", clave: "VZIM004085" },
  { nombre: "Hospital de la comunidad Playa Vicente", clave: "VZIM004674" },
  { nombre: "Hospital de la Comunidad Suchilapan del Rio Carmen Bouzas de Lopez Arias", clave: "VZIM002511" },
  { nombre: "Hospital de la Comunidad Tlacotalpan", clave: "VZIM005171" },
  { nombre: "Hospital de la Comunidad Tlapacoyan", clave: "VZIM005306" },
  { nombre: "Hospital de Salud Mental Orizaba Dr. Victor M. Concha Vasquez", clave: "VZIM004032" },
  { nombre: "Hospital General Alamo", clave: "VZIM016035" },
  { nombre: "Hospital General Altotonga Eufrosina Camacho", clave: "VZIM000230" },
  { nombre: "Hospital General Cordoba Yanga", clave: "VZIM000983" },
  { nombre: "Hospital General Cosoamalapan Dr.Victor Manuel Pitalua Gonzales", clave: "VZIM001000" },
  { nombre: "Hospital General de Cosoloacaque", clave: "VZIM007930" },
  { nombre: "Hospital General de Boca del Rio", clave: "VZIM010212" },
  { nombre: "Hospital General de Cardel", clave: "VZIM006105" },
  { nombre: "Hospital General de Minatitlan", clave: "VZIM003595" },
  { nombre: "Hospital General de Misantla", clave: "VZIM003740" },
  { nombre: "Hospital General de Otula-Acayucan", clave: "VZIM007882" },
  { nombre: "Hospital General de Santiago Tuxtla", clave: "VZIM004046" },
  { nombre: "Hospital General de Tarimoya (Veracruz)", clave: "VZIM006175" },
  { nombre: "Hospital General Tierra Blanca Jesus Garcia Corona", clave: "VZIM004944" },
  { nombre: "Hospital General Huatusco Dr.Dario Mendez Lima", clave: "VZIM002393" },
  { nombre: "Hospital General Isla", clave: "VZIM015411" },
  { nombre: "Hospital General Martinez de la Torre", clave: "VZIM003361" },
  { nombre: "Hospital General Panuco Dr.Manuel I.Avila", clave: "VZIM004160" },
  { nombre: "Hospital General Papantla Dr.Jose Buill Belenguer", clave: "VZIM004370" },
  { nombre: "Hospital General Perote Veracruz", clave: "VZIM004580" },
  { nombre: "Hospital General San Andres Tuxtla Dr.Bernardo Peña", clave: "VZIM004913" },
  { nombre: "Hospital General Tantoyuca", clave: "VZIM005560" },
  { nombre: "Hospital General Tlalixcoyan", clave: "VZIM007754" },
  { nombre: "Hospital General Tuxpan Dr.Emilio Alcazar", clave: "VZIM005393" },
  { nombre: "Hospital Regional de Coatzacoalcos Dr.Valentin Gomez Farias", clave: "VZIM000826" },
  { nombre: "Hospital Regional de Xalapa Dr.Luis F.Nachon", clave: "VZIM002342" },
  { nombre: "Hospital Regional Poza Rica de Hidalgo", clave: "VZIM003766" },
  { nombre: "Hospital Regional Rio Blanco", clave: "VZIM003870" },
  { nombre: "Instituto Veracruzano de Salud Mental Dr.Rafael Velasco Fernandez", clave: "VZIM002982" },
  { nombre: "Uneme de Platon Sanchez", clave: "VZIM015545" }
];

// ======================
// Helper: FILE storage functions (fallback)
// ======================
async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(INVENT_DIR, { recursive: true });
  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch (e) {
    await fs.writeFile(SUBMISSIONS_FILE, JSON.stringify([], null, 2), "utf8");
  }
}
async function readJsonSafe(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content || "[]");
  } catch (e) {
    return null;
  }
}
async function writeJsonSafe(filePath, obj) {
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2), "utf8");
}
function safeFileNameSegment(s) {
  if (!s) return "unknown";
  return String(s).replace(/[^a-z0-9\-_]/ig, "_").slice(0, 120);
}

// ======================
// Middleware: token optional
// ======================
function requireTokenIfSet(req, res, next) {
  if (!API_TOKEN) return next();
  const authHeader = (req.headers.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const tk = authHeader.slice(7).trim();
    if (tk === API_TOKEN) return next();
  }
  const bodyToken = req.body && req.body._token;
  if (bodyToken && bodyToken === API_TOKEN) return next();
  const tokenQuery = (req.query.token || "").trim();
  if (tokenQuery && tokenQuery === API_TOKEN) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized: missing/invalid token" });
}

// ======================
// ROUTES
// ======================

// HEALTH
app.get("/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString(), usingDb: USE_DB }));

// HOSPITALES endpoint (GET /hospitales?q=...)
app.get("/hospitales", (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    if (!q) return res.json(HOSPITALES);
    const filtered = HOSPITALES.filter(h =>
      (h.nombre || "").toLowerCase().includes(q) || (h.clave || "").toLowerCase().includes(q)
    );
    return res.json(filtered);
  } catch (e) {
    console.error("Error /hospitales:", e);
    return res.status(500).json({ ok: false, error: "error interno" });
  }
});

// POST /submit -> guarda envíos históricos (DB o file)
app.post("/submit", requireTokenIfSet, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") return res.status(400).json({ ok: false, error: "payload inválido" });

    const id = (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.floor(Math.random() * 10000)));
    const receivedAt = new Date().toISOString();

    if (USE_DB) {
      // Guardar en tabla submissions (se asume que la tabla existe con columnas id, payload, received_at)
      await pool.query(
        `INSERT INTO submissions (id, payload, received_at)
         VALUES ($1, $2::json, $3)`,
        [id, JSON.stringify(payload), receivedAt]
      );
      return res.json({ ok: true, id, savedAt: receivedAt });
    } else {
      // Fallback archivo
      await ensureStorage();
      const existing = (await readJsonSafe(SUBMISSIONS_FILE)) || [];
      const submission = { id, ...payload, receivedAt };
      existing.push(submission);
      await writeJsonSafe(SUBMISSIONS_FILE, existing);
      return res.json({ ok: true, id, savedAt: receivedAt });
    }
  } catch (e) {
    console.error("Error /submit:", e);
    return res.status(500).json({ ok: false, error: "error guardando submission" });
  }
});

// POST /inventory -> guarda inventario para hospital+categoria (DB or file)
app.post("/inventory", requireTokenIfSet, async (req, res) => {
  try {
    const { hospitalClave, hospitalNombre, categoria, items } = req.body || {};
    if (!categoria || !items || !Array.isArray(items)) return res.status(400).json({ ok: false, error: "falta categoria o items" });

    if (USE_DB) {
      await pool.query(
        `INSERT INTO inventarios (hospital_clave, hospital_nombre, categoria, items, saved_at)
         VALUES ($1, $2, $3, $4::json, $5)`,
        [hospitalClave || "", hospitalNombre || "", categoria, JSON.stringify(items), new Date().toISOString()]
      );
      return res.json({ ok: true, savedAt: new Date().toISOString() });
    } else {
      // file fallback: overwrite file for hospital+categoria (como implementabas antes)
      const key = (hospitalClave && hospitalClave.trim()) || (hospitalNombre && hospitalNombre.trim()) || `unknown-${Date.now()}`;
      const fileName = `${safeFileNameSegment(key)}--${safeFileNameSegment(categoria)}.json`;
      const filePath = path.join(INVENT_DIR, fileName);
      const payload = {
        savedAt: new Date().toISOString(),
        hospitalClave: hospitalClave || "",
        hospitalNombre: hospitalNombre || "",
        categoria,
        items
      };
      await ensureStorage();
      await writeJsonSafe(filePath, payload);
      return res.json({ ok: true, savedAt: payload.savedAt, file: fileName });
    }
  } catch (e) {
    console.error("Error POST /inventory:", e);
    return res.status(500).json({ ok: false, error: "error guardando inventory" });
  }
});

// GET /inventory?hospitalClave=...&categoria=...
app.get("/inventory", async (req, res) => {
  try {
    const hospitalClave = (req.query.hospitalClave || req.query.hospitalNombre || "").trim();
    const categoria = (req.query.categoria || "").trim();
    if (!hospitalClave || !categoria) return res.json([]);

    if (USE_DB) {
      const { rows } = await pool.query(
        `SELECT id, hospital_clave, hospital_nombre, categoria, items, saved_at
         FROM inventarios
         WHERE hospital_clave = $1 AND categoria = $2
         ORDER BY id DESC
         LIMIT 1`,
        [hospitalClave, categoria]
      );
      return res.json(rows[0] || {});
    } else {
      const fileName = `${safeFileNameSegment(hospitalClave)}--${safeFileNameSegment(categoria)}.json`;
      const filePath = path.join(INVENT_DIR, fileName);
      const data = await readJsonSafe(filePath);
      if (data === null) return res.json([]);
      return res.json(data);
    }
  } catch (e) {
    console.error("Error GET /inventory:", e);
    return res.status(500).json({ ok: false, error: "error leyendo inventory" });
  }
});

// GET /submissions (admin)
app.get("/submissions", async (req, res) => {
  // proteger si API_TOKEN configurado
  if (API_TOKEN) {
    const authHeader = (req.headers.authorization || "").trim();
    const tokenQuery = (req.query.token || "").trim();
    let ok = false;
    if (authHeader.toLowerCase().startsWith("bearer ")) ok = authHeader.slice(7).trim() === API_TOKEN;
    if (!ok && tokenQuery) ok = tokenQuery === API_TOKEN;
    if (!ok) return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    if (USE_DB) {
      const { rows } = await pool.query(`SELECT id, payload, received_at FROM submissions ORDER BY received_at DESC`);
      // normalizar salida: parsear payload si viene como text
      const normalized = rows.map(r => {
        let payload = r.payload;
        try { if (typeof payload === "string") payload = JSON.parse(payload); } catch(e){ /* ignore */ }
        return { id: r.id, ...payload, receivedAt: r.received_at || payload.receivedAt };
      });
      return res.json(normalized);
    } else {
      await ensureStorage();
      const existing = (await readJsonSafe(SUBMISSIONS_FILE)) || [];
      // devolver en orden inverso por receivedAt si existe
      existing.sort((a,b) => {
        const ta = a.receivedAt || a.fechaEnvio || "";
        const tb = b.receivedAt || b.fechaEnvio || "";
        return tb.localeCompare(ta);
      });
      return res.json(existing);
    }
  } catch (e) {
    console.error("Error GET /submissions:", e);
    return res.status(500).json({ ok: false, error: "error leyendo submissions" });
  }
});

// GET /submissions/:id (admin)
app.get("/submissions/:id", async (req, res) => {
  if (API_TOKEN) {
    const authHeader = (req.headers.authorization || "").trim();
    const tokenQuery = (req.query.token || "").trim();
    let ok = false;
    if (authHeader.toLowerCase().startsWith("bearer ")) ok = authHeader.slice(7).trim() === API_TOKEN;
    if (!ok && tokenQuery) ok = tokenQuery === API_TOKEN;
    if (!ok) return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const id = req.params.id;
    if (USE_DB) {
      const { rows } = await pool.query(`SELECT id, payload, received_at FROM submissions WHERE id = $1 LIMIT 1`, [id]);
      if (!rows || !rows.length) return res.status(404).json({ ok: false, error: "no encontrado" });
      let payload = rows[0].payload;
      try { if (typeof payload === "string") payload = JSON.parse(payload); } catch(e) {}
      return res.json({ id: rows[0].id, ...payload, receivedAt: rows[0].received_at });
    } else {
      await ensureStorage();
      const existing = (await readJsonSafe(SUBMISSIONS_FILE)) || [];
      const found = existing.find(x => String(x.id) === String(id));
      if (!found) return res.status(404).json({ ok: false, error: "no encontrado" });
      return res.json(found);
    }
  } catch (e) {
    console.error("Error GET /submissions/:id", e);
    return res.status(500).json({ ok: false, error: "error interno" });
  }
});

/*
  REPORT endpoint protegido: GET /report?format=csv|json
  - Si API_TOKEN está configurado, requireTokenIfSet lo protegerá (o se puede pasar token query).
  - Genera CSV (una fila por item) con columnas:
    submissionId, receivedAt, hospitalNombre, hospitalClave, categoria, fechaEnvio,
    clave, descripcion, stock, minimo, fecha, dias, observaciones, color, manual
*/
app.get("/report", requireTokenIfSet, async (req, res) => {
  try {
    let submissions = [];

    if (USE_DB) {
      // obtener submissions desde DB
      const { rows } = await pool.query(`SELECT id, payload, received_at FROM submissions ORDER BY received_at DESC`);
      for (const r of rows) {
        let payload = r.payload;
        try { if (typeof payload === "string") payload = JSON.parse(payload); } catch (e) { /* ignore */ }
        submissions.push({ id: r.id, receivedAt: r.received_at, ...payload });
      }
    } else {
      await ensureStorage();
      submissions = (await readJsonSafe(SUBMISSIONS_FILE)) || [];
    }

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(204).send();
    }

    // construir filas
    const rowsOut = [];
    for (const s of submissions) {
      const base = {
        submissionId: s.id || s.submissionId || "",
        receivedAt: s.receivedAt || s.receivedAt || s.fechaEnvio || "",
        hospitalNombre: s.hospitalNombre || "",
        hospitalClave: s.hospitalClave || "",
        categoria: s.categoria || "",
        fechaEnvio: s.fechaEnvio || ""
      };
      const items = Array.isArray(s.items) ? s.items : [];
      if (items.length === 0) {
        rowsOut.push({ ...base, clave: "", descripcion: "", stock: "", minimo: "", fecha: "", dias: "", observaciones: "", color: "", manual: "" });
      } else {
        for (const it of items) {
          rowsOut.push({
            ...base,
            clave: it.clave || "",
            descripcion: it.descripcion || "",
            stock: it.stock || "",
            minimo: it.minimo || "",
            fecha: it.fecha || "",
            dias: it.dias || "",
            observaciones: it.observaciones || "",
            color: it.color || "",
            manual: (it.manual === true || it.manual === "true") ? "true" : ""
          });
        }
      }
    }

    const format = (req.query.format || "csv").toLowerCase();
    if (format === "json") {
      const filename = `report_submissions_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"_")}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(rowsOut, null, 2));
    }

    // CSV
    function csvEscape(v) {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (/[,"\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }

    const header = [
      "submissionId",
      "receivedAt",
      "hospitalNombre",
      "hospitalClave",
      "categoria",
      "fechaEnvio",
      "clave",
      "descripcion",
      "stock",
      "minimo",
      "fecha",
      "dias",
      "observaciones",
      "color",
      "manual"
    ];

    const csvLines = [ header.join(",") ];
    for (const r of rowsOut) {
      const line = header.map(h => csvEscape(r[h])).join(",");
      csvLines.push(line);
    }

    const filename = `report_submissions_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"_")}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csvLines.join("\r\n"));
  } catch (e) {
    console.error("Error GET /report:", e);
    return res.status(500).json({ ok: false, error: "error generando reporte" });
  }
});

// START
const PORT = parseInt(process.env.PORT || "3000", 10);

(async () => {
  try {
    if (!USE_DB) {
      // preparar filesystem si se usa fallback
      await ensureStorage();
      console.log("Modo FILE (fallback). Archivos en:", DATA_DIR);
    } else {
      console.log("Modo DB: usando PostgreSQL (DATABASE_URL detectado).");
    }

    app.listen(PORT, () => {
      console.log(`Servidor iniciado en puerto ${PORT} (PID:${process.pid}) - usingDb=${USE_DB}`);
      if (API_TOKEN) console.log("API_TOKEN está configurado (endpoints protegidos).");
    });
  } catch (err) {
    console.error("No se pudo iniciar el servidor:", err);
    process.exit(1);
  }
})();
