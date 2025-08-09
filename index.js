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

// URL base de la API de Retell
const RETELL_API_BASE_URL = 'https://api.retellai.com/v1';

// 4. ENDPOINT PRINCIPAL: EL WEBHOOK
app.post('/webhook', async (req, res ) => {
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

    let retellChatId = chatSessions[senderNumber];

    // La lógica de creación de chat parece ser la que falla.
    // Vamos a verificar la documentación de Retell para el endpoint correcto.
    // El endpoint correcto para crear un chat es POST /chat
    // Y para enviar un mensaje es POST /chat/{chat_id}/completion
    // Vamos a ajustar el código a esta estructura.

    if (!retellChatId) {
      console.log(`Creando nuevo chat en Retell para [${senderNumber}]...`);
      // CORRECCIÓN: El endpoint correcto es /chat y se le pasa el agent_id en el cuerpo.
      const createChatResponse = await axios.post(
        `${RETELL_API_BASE_URL}/chat`, // Endpoint corregido
        { agent_id: RETELL_AGENT_ID },
        { 
          headers: { 
            'Authorization': `Bearer ${RETELL_API_KEY}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      retellChatId = createChatResponse.data.chat_id;
      chatSessions[senderNumber] = retellChatId;
      console.log(`Nuevo chat creado. ID: ${retellChatId}`);
    }

    console.log(`Enviando mensaje a Retell (Chat ID: ${retellChatId})...`);
    // CORRECCIÓN: El endpoint para enviar mensajes es /chat/{chat_id}/completion
    const retellResponse = await axios.post(
      `${RETELL_API_BASE_URL}/chat/${retellChatId}/completion`, // Endpoint corregido
      {
        completion_request: {
          text: messageContent
        }
      },
      { 
        headers: { 
          'Authorization': `Bearer ${RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        } 
      }
    );

    const botReply = retellResponse.data.content;
    console.log(`[Retell AI] responde: "${botReply}"`);

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
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error("!!! ERROR en el webhook:", errorMessage);
    // Imprimir detalles del error para una mejor depuración
    if (error.config) {
      console.error("Error en la petición a:", error.config.method.toUpperCase(), error.config.url);
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
