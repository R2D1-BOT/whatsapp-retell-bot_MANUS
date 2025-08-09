// 1. IMPORTACIÓN DE MÓDULOS
const express = require('express');
const axios = require('axios');
require('dotenv').config();

// 2. CONFIGURACIÓN INICIAL
const app = express();
app.use(express.json());

// 3. CARGA DE VARIABLES DE ENTORNO
const {
  RETELL_API_KEY,
  RETELL_AGENT_ID,
  EVO_URL,
  EVO_ID,
  EVO_TOKEN,
  PORT
} = process.env;

// Almacenamiento de sesiones en memoria.
const chatSessions = {};

// 4. ENDPOINT PRINCIPAL: EL WEBHOOK
app.post('/webhook', async (req, res) => {
  // --- VERIFICACIÓN DEL WEBHOOK DE RETELL ---
  // Retell envía la API Key en la cabecera 'Authorization' para verificar la llamada.
  const authHeader = req.headers['authorization'];
  const providedKey = authHeader && authHeader.split(' ')[1]; // Extrae la clave del "Bearer <key>"

  if (providedKey !== RETELL_API_KEY) {
    console.error("!!! ERROR: Webhook recibido con API Key incorrecta o faltante.");
    console.error(`Cabecera recibida: ${authHeader}`);
    return res.status(401).send("Unauthorized"); // Rechaza la petición si la clave no coincide.
  }
  
  console.log("-> Webhook de Retell verificado y recibido!");

  try {
    // El resto del código asume que el cuerpo del webhook de Retell contiene la información.
    // Necesitamos ajustar esto al formato real que envía Retell.
    // Por ahora, vamos a loguear el cuerpo para ver qué nos manda.
    console.log("Cuerpo del webhook de Retell:", JSON.stringify(req.body, null, 2));

    // --- LÓGICA TEMPORAL ---
    // Como no sabemos qué hacer con la llamada de Retell todavía,
    // simplemente respondemos OK para que no dé error.
    
    res.status(200).send("OK - Webhook recibido y verificado.");

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
    console.error("!!! ERROR en el webhook:", errorMessage);
    res.status(500).send("Internal Server Error");
  }
});


// --- CÓDIGO ANTERIOR PARA EVOLUTION API (LO DEJAMOS POR SI ACASO) ---
// Este es el webhook que llama Evolution, no Retell. Necesitamos dos webhooks.
// Vamos a renombrar el webhook de Evolution a /evolution-webhook

app.post('/evolution-webhook', async (req, res) => {
    // ... todo el código que teníamos para hablar con Evolution y Retell ...
});


app.get('/ping', (req, res) => {
  res.status(200).send("Pong! El servidor del bot está activo y listo.");
});

const serverPort = PORT || 8080;
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 Servidor del bot iniciado y escuchando en el puerto ${serverPort}`);
});

