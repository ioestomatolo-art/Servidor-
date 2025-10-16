// index.js - servidor mínimo compatible con Node 12 (Express 4)
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// parse JSON (para recibir tu payload desde frontend)
app.use(express.json());

// sirve archivos estáticos desde ./public (pon tu HTML/CSS/JS ahí)
app.use(express.static(path.join(__dirname, 'public')));

// endpoint de prueba
app.get('/ping', (req, res) => {
  res.json({ ok: true, node: process.version });
});

// endpoint simple para recibir form (ejemplo)
app.post('/submit', (req, res) => {
  console.log('POST /submit =>', req.body);
  // aquí podrías guardar en base de datos, supabase, etc.
  res.json({ status: 'ok', received: Array.isArray(req.body.items) ? req.body.items.length : 0 });
});

// iniciar server
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}  (Node ${process.version})`);
});
