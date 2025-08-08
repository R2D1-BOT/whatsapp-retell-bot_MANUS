
// 1. IMPORTACIÓN DE MÓDULOS
const express = require('express');
const axios = require('axios');
// dotenv solo se usa para pruebas locales, pero es buena práctica incluirlo.
// En Railway, las variables se cargan automáticamente.
require('dotenv').config();

// 2. CONFIGURACIÓN INICIAL
const app = express();
app.use(express.json()); // Middleware para entender JSON

// 3. CARGA DE VARIABLES DE ENTORNO
// Railway leerá estas variables desde su propio dashboard.
const {
  RETELL_API_KEY,
  RETELL_AGENT_ID,
  EVO_URL,
  EVO_ID,
  EVO_TOKEN,
  PORT
} = process.env;

// Almacenamiento de sesiones en memoria. Asocia un número de WhatsApp con un ID de chat de Retell.
const chatSessions = {};

// 4. ENDPOINT PRINCIPAL: EL WEBHOOK
// Esta es la URL que Evolution API llamará con cada mensaje nuevo.
app.post('/webhook', async (req, res) => {
  console.log("-> Webhook recibido!");

  try {
    // Extraemos los datos que nos interesan del cuerpo (body) de la petición
    const messageData = req.body.data;
    const eventType = req.body.event;
    const senderNumber = messageData?.key?.remoteJid;
    const messageContent = messageData?.message?.conversation || messageData?.message?.extendedTextMessage?.text;

    // Filtro para procesar solo mensajes de texto de usuarios.
    // Ignoramos notificaciones, cambios de estado, etc.
    if (eventType !== 'messages.upsert' || !senderNumber || !messageContent) {
      console.log("Evento ignorado (no es un mensaje de texto relevante).");
      return res.status(200).send("OK - Evento no procesable");
    }

    console.log(`[${senderNumber}] dice: "${messageContent}"`);

    // --- LÓGICA DE RETELL AI ---

    let retellChatId = chatSessions[senderNumber];

    if (!retellChatId) {
      console.log(`Creando nuevo chat en Retell para [${senderNumber}]...`);
      const createChatResponse = await axios.post(
        'https://api.retellai.com/create-chat',
        { agent_id: RETELL_AGENT_ID },
        { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } }
       );
      retellChatId = createChatResponse.data.chat_id;
      chatSessions[senderNumber] = retellChatId;
      console.log(`Nuevo chat creado. ID: ${retellChatId}`);
    }

    console.log(`Enviando mensaje a Retell (Chat ID: ${retellChatId})...`);
    const retellResponse = await axios.post(
      'https://api.retellai.com/create-chat-completion',
      {
        chat_id: retellChatId,
        content: messageContent
      },
      { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } }
     );

    const botReply = retellResponse.data.content;
    console.log(`[Retell AI] responde: "${botReply}"`);

    // --- LÓGICA DE EVOLUTION API ---

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
    console.error("!!! ERROR en el webhook:", error.response ? error.response.data : error.message);
    res.status(500).send("Internal Server Error");
  }
});

// 5. ENDPOINT DE VERIFICACIÓN (PING)
// Útil para comprobar rápidamente si el servidor está funcionando.
app.get('/ping', (req, res) => {
  res.status(200).send("Pong! El servidor del bot está activo y listo.");
});

// 6. INICIO DEL SERVIDOR
// Railway asignará un puerto automáticamente a través de la variable PORT.
const serverPort = PORT || 8080;
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 Servidor del bot iniciado y escuchando en el puerto ${serverPort}`);
});
