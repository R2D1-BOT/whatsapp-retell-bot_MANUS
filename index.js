const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// NO NECESITAMOS LAS VARIABLES DE RETELL AQUÍ
const { EVO_URL, EVO_ID, EVO_TOKEN, PORT } = process.env;
const chatSessions = {};

app.post('/webhook', async (req, res) => {
  console.log("-> Webhook recibido! Leyendo claves desde los Headers...");

  // --- LEEMOS LAS CLAVES DE LAS CABECERAS DE LA PETICIÓN ---
  const RETELL_AGENT_ID = req.headers['x-agent-id'];
  const authHeader = req.headers['authorization'];
  const RETELL_API_KEY = authHeader && authHeader.split(' ')[1]; // Extrae la clave del "Bearer <key>"

  // --- VERIFICAMOS QUE LAS CLAVES LLEGARON ---
  console.log("--- VERIFICANDO CLAVES DE HEADERS ---");
  console.log(`🔑 RETELL_API_KEY (de Header): ${RETELL_API_KEY ? 'RECIBIDA' : '!!! FALTANTE !!!'}`);
  console.log(`🤖 RETELL_AGENT_ID (de Header): ${RETELL_AGENT_ID ? 'RECIBIDO' : '!!! FALTANTE !!!'}`);
  console.log("------------------------------------");

  if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error("!!! ERROR: No se recibieron las claves de Retell en las cabeceras del webhook.");
    return res.status(400).send("Bad Request: Faltan cabeceras de autenticación de Retell.");
  }

  try {
    const messageData = req.body.data;
    const eventType = req.body.event;
    const senderNumber = messageData?.key?.remoteJid;
    const messageContent = messageData?.message?.conversation || messageData?.message?.extendedTextMessage?.text;

    if (eventType !== 'messages.upsert' || !senderNumber || !messageContent) {
      return res.status(200).send("OK - Evento no procesable");
    }
    console.log(`[${senderNumber}] dice: "${messageContent}"`);

    let chatId = chatSessions[senderNumber];
    
    if (!chatId) {
      console.log(`[${senderNumber}] Creando nueva sesión de chat...`);
      const createChatResponse = await axios.post(
        'https://api.retellai.com/create-chat',
        { agent_id: RETELL_AGENT_ID },
        { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
       );
      
      chatId = createChatResponse.data.chat_id;
      chatSessions[senderNumber] = chatId;
      console.log(`[${senderNumber}] Nueva sesión creada: ${chatId}`);
    }

    console.log(`[${senderNumber}] Enviando mensaje a chat ${chatId}...`);
    const chatCompletionResponse = await axios.post(
      'https://api.retellai.com/create-chat-completion',
      {
        chat_id: chatId,
        messages: [{ role: "user", content: messageContent }]
      },
      { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
     );

    const botReply = chatCompletionResponse.data.messages[0].content;
    console.log(`[Retell AI] responde: "${botReply}"`);

    await axios.post(
      `${EVO_URL}/message/sendText/${EVO_ID}`,
      {
        number: senderNumber,
        options: { delay: 1200, presence: "composing" },
        textMessage: { text: botReply }
      },
      { headers: { 'apikey': EVO_TOKEN } }
    );

    res.status(200).send("OK - Mensaje procesado");
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

app.get('/ping', (req, res) => {
  res.status(200).send("Pong! El servidor del bot está activo y listo.");
});

const serverPort = PORT || 8080;
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 v5.0 - LEYENDO HEADERS - Servidor iniciado en puerto ${serverPort}`);
});


