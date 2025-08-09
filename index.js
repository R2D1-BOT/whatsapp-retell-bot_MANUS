const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Las variables de Evolution que SÍ necesitamos de Railway
const { EVO_URL, EVO_ID, EVO_TOKEN, PORT } = process.env;
const chatSessions = {};

app.post('/webhook', async (req, res) => {
  console.log("-> Webhook recibido! v7.0 FINAL");

  // --- 1. LEEMOS LAS CLAVES DE RETELL DE LOS HEADERS ---
  const RETELL_AGENT_ID = req.headers['x-agent-id'];
  const authHeader = req.headers['authorization'];
  const RETELL_API_KEY = authHeader && authHeader.split(' ')[1];

  if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error("!!! ERROR: Faltan cabeceras de Retell en la llamada de Evolution.");
    return res.status(400).send("Bad Request");
  }
  console.log("--- Claves de Headers de Retell RECIBIDAS ---");

  try {
    const messageData = req.body.data;
    const eventType = req.body.event;
    const senderNumber = messageData?.key?.remoteJid;
    const messageContent = messageData?.message?.conversation || messageData?.message?.extendedTextMessage?.text;

    if (eventType !== 'messages.upsert' || !senderNumber || !messageContent) {
      return res.status(200).send("OK - Evento no procesable");
    }
    console.log(`[${senderNumber}] dice: "${messageContent}"`);

    // --- 2. LÓGICA CORRECTA DE RETELL (UN SOLO POST) ---
    const existingChatId = chatSessions[senderNumber];
    // Usamos el formato de 'messages' que es el correcto
    const retellPayload = {
      agent_id: RETELL_AGENT_ID,
      messages: [{ role: "user", content: messageContent }] 
    };

    if (existingChatId) {
      retellPayload.chat_id = existingChatId;
    }

    // Hacemos la llamada al endpoint que SÍ existe
    const retellResponse = await axios.post(
      'https://api.retellai.com/create-chat-completion',
      retellPayload,
      { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
     );

    const newChatId = retellResponse.data.chat_id;
    if (newChatId && !existingChatId) {
      chatSessions[senderNumber] = newChatId;
    }

    // Leemos la respuesta del array de messages
    const botReply = retellResponse.data.messages.find(m => m.role === 'assistant')?.content;
    if (!botReply) {
        console.error("!!! ERROR: Retell no devolvió una respuesta de asistente.");
        return res.status(500).send("Error en la respuesta de Retell");
    }
    console.log(`[Retell AI] responde: "${botReply}"`);

    // --- 3. ENVÍO DE RESPUESTA VÍA EVOLUTION (USANDO VARIABLES DE ENTORNO) ---
    if (!EVO_URL || !EVO_ID || !EVO_TOKEN) {
        console.error("!!! ERROR: Faltan las variables de entorno de Evolution (EVO_URL, EVO_ID, EVO_TOKEN).");
        return res.status(500).send("Error de configuración del servidor");
    }

    await axios.post(
      `${EVO_URL}/message/sendText/${EVO_ID}`,
      {
        number: senderNumber,
        options: { delay: 1200, presence: "composing" },
        textMessage: { text: botReply }
      },
      { headers: { 'apikey': EVO_TOKEN } }
    );

    console.log("<- Respuesta enviada a WhatsApp.");
    res.status(200).send("OK");

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
    console.error("!!! ERROR en el webhook:", errorMessage);
    if (error.config) {
        console.error("--- Detalles de la Petición Fallida ---");
        console.error("URL:", error.config.method.toUpperCase(), error.config.url);
    }
    res.status(500).send("Internal Server Error");
  }
});

const serverPort = PORT || 8080;
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 v7.0 FINAL - Servidor iniciado en puerto ${serverPort}`);
});


