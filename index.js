const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const { RETELL_API_KEY, RETELL_AGENT_ID, EVO_URL, EVO_ID, EVO_TOKEN, PORT } = process.env;
const chatSessions = {};

app.post('/webhook', async (req, res) => {
  // --- LÍNEAS DE DEBUG PARA VER LAS CLAVES ---
  console.log("--- VERIFICANDO VARIABLES DE ENTORNO ---");
  console.log(`🔑 RETELL_API_KEY: ${RETELL_API_KEY ? 'RECIBIDA' : '!!! FALTANTE !!!'}`);
  console.log(`🤖 RETELL_AGENT_ID: ${RETELL_AGENT_ID ? 'RECIBIDO' : '!!! FALTANTE !!!'}`);
  console.log(`🌐 EVO_URL: ${EVO_URL ? 'RECIBIDA' : '!!! FALTANTE !!!'}`);
  console.log(`🆔 EVO_ID: ${EVO_ID ? 'RECIBIDO' : '!!! FALTANTE !!!'}`);
  console.log(`🔒 EVO_TOKEN: ${EVO_TOKEN ? 'RECIBIDO' : '!!! FALTANTE !!!'}`);
  console.log("------------------------------------");

  console.log("-> Webhook recibido!");
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
        {
          agent_id: RETELL_AGENT_ID
        },
        { 
          headers: { 
            'Authorization': `Bearer ${RETELL_API_KEY}`,
            'Content-Type': 'application/json'
          } 
        }
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
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ]
      },
      { 
        headers: { 
          'Authorization': `Bearer ${RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        } 
      }
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
      console.error("Headers:", JSON.stringify(error.config.headers, null, 2));
      console.error("Data:", JSON.stringify(error.config.data, null, 2));
      console.error("------------------------------------");
    }
    res.status(500).send("Internal Server Error");
  }
});

app.get('/ping', (req, res) => {
  res.status(200).send("Pong! El servidor del bot está activo y listo.");
});

const serverPort = PORT || 8080;
// LA LÍNEA CAMBIADA PARA VERIFICAR EL DEPLOY
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 v3.0 - DEBUG ACTIVADO - Servidor iniciado en puerto ${serverPort}`);
});
