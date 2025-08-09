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
  console.log("-> Webhook recibido!");

  try {
    const messageData = req.body.data;
    const eventType = req.body.event;
    const senderNumber = messageData?.key?.remoteJid;
    const messageContent = messageData?.message?.conversation || messageData?.message?.extendedTextMessage?.text;

    if (eventType !== 'messages.upsert' || !senderNumber || !messageContent) {
      console.log("Evento ignorado (no es un mensaje de texto relevante).");
      return res.status(200).send("OK - Evento no procesable");
    }

    console.log(`[${senderNumber}] dice: "${messageContent}"`);

    // --- LÓGICA CORRECTA DE RETELL AI ---
    
    const existingChatId = chatSessions[senderNumber];
    const retellPayload = {
      agent_id: RETELL_AGENT_ID,
      content: messageContent
    };

    if (existingChatId) {
      retellPayload.chat_id = existingChatId;
      console.log(`Continuando chat para [${senderNumber}] con ID: ${existingChatId}`);
    } else {
      console.log(`Iniciando nuevo chat para [${senderNumber}]...`);
    }

    const retellResponse = await axios.post(
      'https://api.retellai.com/create-chat-completion',
      retellPayload,
      { 
        headers: { 
          'Authorization': `Bearer ${RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        } 
      }
     );

    const newChatId = retellResponse.data.chat_id;
    if (newChatId && !existingChatId) {
      chatSessions[senderNumber] = newChatId;
      console.log(`Nuevo chat guardado con ID: ${newChatId}`);
    }

    const botReply = retellResponse.data.content;
    console.log(`[Retell AI] responde: "${botReply}"`);

    // --- ENVÍO DE RESPUESTA VÍA EVOLUTION API ---
    console.log(`Enviando respuesta a [${senderNumber}] vía Evolution API...`);
    await axios.post(
      `${EVO_URL}/message/sendText/${EVO_ID}`,
      {
        number: senderNumber,
        options: { delay: 1200, presence: "composing" },
        textMessage: { text: botReply }
      },
      { headers: { 'apikey': EVO_TOKEN } }
    );

    console.log("<- Respuesta enviada exitosamente a WhatsApp.");
    res.status(200).send("OK - Mensaje procesado");

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
    console.error("!!! ERROR en el webhook:", errorMessage);
    if (error.config) {
      console.error("--- Detalles de la Petición Fallida ---");
      console.error("URL:", error.config.method.toUpperCase(), error.config.url);
      console.error("------------------------------------");
    }
    res.status(500).send("Internal Server Error");
  }
});

app.get('/ping', (req, res) => {
  res.status(200).send("Pong! El servidor del bot está activo y listo.");
});

const serverPort = PORT || 8080;
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 Servidor del bot iniciado y escuchando en el puerto ${serverPort}`);
});
