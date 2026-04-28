// index.js — servidor completo: guarda y lee directo de la tabla CSV
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(morgan("combined"));

// ======================
// CONFIG
// ======================
const API_TOKEN = process.env.API_TOKEN || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const USE_DB = !!DATABASE_URL;

// Cambia aquí si tu tabla real se llama inventario_csv
const INVENTORY_TABLE = process.env.INVENTORY_TABLE || "inventarios_csv";

// FILE STORAGE fallback
const DATA_DIR = path.join(__dirname, "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const INVENT_DIR = path.join(DATA_DIR, "inventories");

// ======================
// CORS
// ======================
const allowedOrigins = new Set([
  "https://ioestomatolo-art.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ======================
// DB POOL
// ======================
let pool = null;

if (USE_DB) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

// ======================
// HOSPITALES
// ======================
const HOSPITALES = [
  { nombre: "Centro de Alta Especialidad DR.Rafael Lucio", clave: "VZIM002330" },
  { nombre: "Centro de Salud con Hospitalizacion de Alto Lucero de Gutierrez Barrios,Ver.", clave: "VZIM008065" },
  { nombre: "Centro De Salud con Hospitalizacion de la localidad de Allende, Ver.", clave: "VZIM007942" },
  { nombre: "Centro Estatal de Cancerologia Dr.Miguel Dorantes Mesa", clave: "VZIM002325" },
  { nombre: "Hospital Comunitario de Ixhuatlan del Sureste", clave: "VZIM002120" },
  { nombre: "Hospital Comunitario de Tonalapan", clave: "VZIM006122" },
  { nombre: "Hospital de Alta Especialidad de Veracruz", clave: "VZIM005533" },
  { nombre: "Hospital de la Comunidad Catemaco", clave: "VZIM000691" },
  { nombre: "Hospital de la Comunidad de Coatepec", clave: "VZIM000790" },
  { nombre: "Hospital de la Comunidad de Alvarado", clave: "VZIM000254" },
  { nombre: "Hospital de la Comunidad de Cerro Azul", clave: "VZIM006180" },
  { nombre: "Hospital de la Comunidad de Entabladero", clave: "VZIM006163" },
  { nombre: "Hospital de la Comunidad de Gutierrez Zamora", clave: "VZIM001794" },
  { nombre: "Hospital de la Comunidad de Huayacocotla", clave: "VZIM001922" },
  { nombre: "Hospital de la Comunidad de Jose Azueta", clave: "VZIM007860" },
  { nombre: "Hospital de la Comunidad de Llano de en medio", clave: "VZIM006151" },
  { nombre: "Hospital de la Comunidad de Naolinco", clave: "VZIM007732" },
  { nombre: "Hospital de la Comunidad de Tempoal", clave: "VZIM004710" },
  { nombre: "Hospital de la Comunidad de Teocelo", clave: "VZIM004775" },
  { nombre: "Hospital de la Comunidad de Tezonapa", clave: "VZIM006146" },
  { nombre: "Hospital de la Comunidad de Tlaquilpan Vista Hermosa", clave: "VZIM006134" },
  { nombre: "Hospital de la Comunidad Dr.Pedro Coronel Perez", clave: "VZIM015425" },
  { nombre: "Hospital de la Comunidad La Laguna Poblado 6", clave: "VZIM007573" },
  { nombre: "Hospital de la Comunidad Naranjos", clave: "VZIM000416" },
  { nombre: "Hospital de la Comunidad Ozuluama de Mascareñas", clave: "VZIM004085" },
  { nombre: "Hospital de la Comunidad Playa Vicente", clave: "VZIM004674" },
  { nombre: "Hospital de la Comunidad Suchilapan del Rio Carmen Bouzas de Lopez Arias", clave: "VZIM002511" },
  { nombre: "Hospital de la Comunidad Tlacotalpan", clave: "VZIM005171" },
  { nombre: "Hospital de la Comunidad Tlapacoyan", clave: "VZIM005306" },
  { nombre: "Hospital de Salud Mental Orizaba Dr. Victor M. Concha Vasquez", clave: "VZIM004032" },
  { nombre: "Hospital General Alamo", clave: "VZIM016035" },
  { nombre: "Hospital General Altotonga Eufrosina Camacho", clave: "VZIM000230" },
  { nombre: "Hospital General Cordoba Yanga", clave: "VZIM000983" },
  { nombre: "Hospital General Cosamaloapan Dr.Victor Manuel Pitalua Gonzales", clave: "VZIM001000" },
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
// FILE STORAGE HELPERS
// ======================
async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(INVENT_DIR, { recursive: true });

  try {
    await fs.access(SUBMISSIONS_FILE);
  } catch {
    await fs.writeFile(SUBMISSIONS_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

async function readJsonSafe(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content || "[]");
  } catch {
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
// DB SCHEMA
// ======================
async function ensureDbSchema() {
  if (!USE_DB) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${INVENTORY_TABLE} (
      hospital_clave TEXT NOT NULL,
      hospital_nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      uid TEXT,
      clave TEXT NOT NULL,
      descripcion TEXT,
      stock INT,
      minimo INT,
      fecha DATE,
      dias_restantes INT,
      observaciones TEXT,
      color TEXT,
      manual BOOLEAN DEFAULT FALSE,
      saved_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE ${INVENTORY_TABLE}
    ADD COLUMN IF NOT EXISTS uid TEXT;
  `);

  await pool.query(`
    ALTER TABLE ${INVENTORY_TABLE}
    ADD COLUMN IF NOT EXISTS observaciones TEXT;
  `);

  await pool.query(`
    ALTER TABLE ${INVENTORY_TABLE}
    ADD COLUMN IF NOT EXISTS color TEXT;
  `);

  await pool.query(`
    ALTER TABLE ${INVENTORY_TABLE}
    ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT FALSE;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_${INVENTORY_TABLE}_hosp_cat
    ON ${INVENTORY_TABLE} (hospital_clave, categoria);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_${INVENTORY_TABLE}_uid
    ON ${INVENTORY_TABLE} (hospital_clave, categoria, uid);
  `);
}

// ======================
// TOKEN OPTIONAL
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
// NORMALIZERS
// ======================
function normalizeInventoryRow(row = {}) {
  return {
    uid: String(row.uid || "").trim(),
    clave: String(row.clave || "").trim(),
    descripcion: row.descripcion || "",
    stock: row.stock !== null && row.stock !== undefined ? String(row.stock) : "",
    minimo: row.minimo !== null && row.minimo !== undefined ? String(row.minimo) : "",
    fecha: row.fecha ? String(row.fecha).slice(0, 10) : "",
    dias: row.dias !== null && row.dias !== undefined
      ? String(row.dias)
      : (row.dias_restantes !== null && row.dias_restantes !== undefined ? String(row.dias_restantes) : ""),
    observaciones: row.observaciones || "",
    color: row.color || "",
    manual: !!row.manual
  };
}

// ======================
// ROUTES
// ======================
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), usingDb: USE_DB });
});

app.get("/hospitales", (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    if (!q) return res.json(HOSPITALES);

    const filtered = HOSPITALES.filter(h =>
      (h.nombre || "").toLowerCase().includes(q) ||
      (h.clave || "").toLowerCase().includes(q)
    );

    return res.json(filtered);
  } catch (e) {
    console.error("Error /hospitales:", e);
    return res.status(500).json({ ok: false, error: "error interno" });
  }
});

app.post("/submit", requireTokenIfSet, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "payload inválido" });
    }

    const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random() * 10000)}`);
    const receivedAt = new Date().toISOString();

    if (USE_DB) {
      await pool.query(
        `INSERT INTO submissions (id, payload, received_at)
         VALUES ($1, $2::json, $3)`,
        [id, JSON.stringify(payload), receivedAt]
      );
      return res.json({ ok: true, id, savedAt: receivedAt });
    }

    await ensureStorage();
    const existing = (await readJsonSafe(SUBMISSIONS_FILE)) || [];
    existing.push({ id, ...payload, receivedAt });
    await writeJsonSafe(SUBMISSIONS_FILE, existing);

    return res.json({ ok: true, id, savedAt: receivedAt });
  } catch (e) {
    console.error("Error /submit:", e);
    return res.status(500).json({ ok: false, error: "error guardando submission" });
  }
});

// ======================
// INVENTORY (única fuente: INVENTORY_TABLE)
// ======================
app.post("/inventory", requireTokenIfSet, async (req, res) => {
  try {
    const { hospitalClave, hospitalNombre, categoria, items } = req.body || {};

    if (!hospitalClave || !hospitalNombre || !categoria || !Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: "falta hospitalClave, hospitalNombre, categoria o items" });
    }

    if (!USE_DB) {
      return res.status(400).json({ ok: false, error: "Base de datos no conectada" });
    }

    const itemsWithUid = items.map(it => {
      const uid = String(it?.uid || "").trim() || (crypto.randomUUID ? crypto.randomUUID() : `uid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return {
        uid,
        clave: String(it?.clave || "").trim(),
        descripcion: String(it?.descripcion || ""),
        stock: it?.stock ?? "",
        minimo: it?.minimo ?? "",
        fecha: it?.fecha ?? "",
        dias: it?.dias ?? "",
        observaciones: it?.observaciones ?? "",
        color: it?.color ?? "",
        manual: !!it?.manual
      };
    });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Reemplaza el estado actual de esa categoría/hospital
      await client.query(
        `DELETE FROM ${INVENTORY_TABLE}
         WHERE hospital_clave = $1 AND categoria = $2`,
        [hospitalClave, categoria]
      );

      for (const it of itemsWithUid) {
        await client.query(
          `INSERT INTO ${INVENTORY_TABLE}
           (hospital_clave, hospital_nombre, categoria, uid, clave, descripcion, stock, minimo, fecha, dias_restantes, observaciones, color, manual, saved_at)
           VALUES
           ($1, $2, $3, $4, $5, $6,
            NULLIF($7, '')::int,
            NULLIF($8, '')::int,
            NULLIF($9, '')::date,
            NULLIF($10, '')::int,
            $11, $12, $13, NOW())`,
          [
            hospitalClave || "",
            hospitalNombre || "",
            categoria || "",
            it.uid || "",
            it.clave || "",
            it.descripcion || "",
            it.stock || "",
            it.minimo || "",
            it.fecha || "",
            it.dias || "",
            it.observaciones || "",
            it.color || "",
            !!it.manual
          ]
        );
      }

      await client.query("COMMIT");
      return res.json({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Error POST /inventory:", e);
    return res.status(500).json({ ok: false, error: "error guardando inventory" });
  }
});

app.get("/inventory", async (req, res) => {
  try {
    const hospitalClave = (req.query.hospitalClave || req.query.hospitalNombre || "").trim();
    const categoria = (req.query.categoria || "").trim();

    if (!hospitalClave || !categoria) {
      return res.json([]);
    }

    if (!USE_DB) {
      return res.status(400).json({ ok: false, error: "Base de datos no conectada" });
    }

    const { rows } = await pool.query(
      `SELECT
         hospital_clave,
         hospital_nombre,
         categoria,
         uid,
         clave,
         descripcion,
         stock,
         minimo,
         fecha,
         dias_restantes,
         observaciones,
         color,
         manual
       FROM ${INVENTORY_TABLE}
       WHERE hospital_clave = $1 AND categoria = $2
       ORDER BY descripcion ASC`,
      [hospitalClave, categoria]
    );

    return res.json(rows.map(normalizeInventoryRow));
  } catch (e) {
    console.error("Error GET /inventory:", e);
    return res.status(500).json({ ok: false, error: "error leyendo inventory" });
  }
});

app.post("/inventory/item/delete", requireTokenIfSet, async (req, res) => {
  try {
    const { hospitalClave, categoria, uids } = req.body || {};

    if (!hospitalClave || !categoria || !Array.isArray(uids) || uids.length === 0) {
      return res.status(400).json({ ok: false, error: "falta hospitalClave, categoria o uids" });
    }

    if (!USE_DB) {
      return res.status(400).json({ ok: false, error: "Base de datos no conectada" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Borra exactamente por uid en la tabla única
      await client.query(
        `DELETE FROM ${INVENTORY_TABLE}
         WHERE hospital_clave = $1
           AND categoria = $2
           AND uid = ANY($3::text[])`,
        [hospitalClave, categoria, uids.map(String)]
      );

      await client.query("COMMIT");
      return res.json({ ok: true, modified: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("Error POST /inventory/item/delete:", e);
    return res.status(500).json({ ok: false, error: "error eliminando items" });
  }
});

app.get("/inventory-base", async (req, res) => {
  try {
    const { hospitalClave } = req.query;
    if (!hospitalClave) {
      return res.status(400).json({ ok: false, error: "Falta hospitalClave" });
    }

    if (!USE_DB) {
      return res.status(400).json({ ok: false, error: "Base de datos no conectada" });
    }

    const { rows } = await pool.query(
      `SELECT
         LOWER(TRIM(categoria)) AS categoria,
         clave,
         descripcion,
         stock,
         minimo,
         fecha,
         dias_restantes
       FROM ${INVENTORY_TABLE}
       WHERE TRIM(LOWER(hospital_clave)) = TRIM(LOWER($1))
          OR TRIM(LOWER(hospital_nombre)) = TRIM(LOWER($1))
       ORDER BY descripcion ASC`,
      [hospitalClave]
    );

    return res.json(rows);
  } catch (e) {
    console.error("Error GET /inventory-base:", e);
    return res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
});

app.get("/submissions", async (req, res) => {
  if (API_TOKEN) {
    const authHeader = (req.headers.authorization || "").trim();
    const tokenQuery = (req.query.token || "").trim();
    let ok = false;

    if (authHeader.toLowerCase().startsWith("bearer ")) {
      ok = authHeader.slice(7).trim() === API_TOKEN;
    }
    if (!ok && tokenQuery) ok = tokenQuery === API_TOKEN;

    if (!ok) return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    if (USE_DB) {
      const { rows } = await pool.query(
        `SELECT id, payload, received_at FROM submissions ORDER BY received_at DESC`
      );

      const normalized = rows.map(r => {
        let payload = r.payload;
        try {
          if (typeof payload === "string") payload = JSON.parse(payload);
        } catch {}

        return {
          id: r.id,
          ...payload,
          receivedAt: r.received_at || payload.receivedAt
        };
      });

      return res.json(normalized);
    }

    await ensureStorage();
    const existing = (await readJsonSafe(SUBMISSIONS_FILE)) || [];

    existing.sort((a, b) => {
      const ta = a.receivedAt || a.fechaEnvio || "";
      const tb = b.receivedAt || b.fechaEnvio || "";
      return tb.localeCompare(ta);
    });

    return res.json(existing);
  } catch (e) {
    console.error("Error GET /submissions:", e);
    return res.status(500).json({ ok: false, error: "error leyendo submissions" });
  }
});

// ======================
// START
// ======================
const PORT = parseInt(process.env.PORT || "3000", 10);

(async () => {
  try {
    if (!USE_DB) {
      await ensureStorage();
      console.log("Modo FILE (fallback). Archivos en:", DATA_DIR);
    } else {
      await ensureDbSchema();
      console.log(`Modo DB: usando PostgreSQL con tabla ${INVENTORY_TABLE}.`);
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