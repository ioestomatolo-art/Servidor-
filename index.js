// index.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: parse JSON bodies
app.use(express.json());

// === CORS sencillo (ajusta ORIGIN para seguridad) ===
// Para pruebas puedes usar "*" pero en producción establece "https://<usuario>.github.io"
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  // Preflight
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Servir archivos estáticos (tu frontend local durante pruebas)
app.use(express.static(path.join(__dirname, 'public')));

// Ping
app.get('/ping', (req, res) => res.json({ ok: true, node: process.version }));

// Endpoint para recibir formulario
app.post('/submit', (req, res) => {
  console.log('Datos recibidos /submit:', JSON.stringify(req.body, null, 2));
  // Aquí insertas la lógica: guardar en base de datos, supabase, enviar correo, etc.
  // Devolver respuesta
  res.json({ status: 'ok', received: Array.isArray(req.body.items) ? req.body.items.length : 0 });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}  (Node ${process.version})`);
  console.log('ALLOWED_ORIGIN =', ALLOWED_ORIGIN);
});
