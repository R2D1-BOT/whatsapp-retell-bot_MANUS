const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const RETELL_API_KEY = "key_69ff78a84a56c5dd3ea71be37b6f";
const RETELL_AGENT_ID = "agent_0452f6bca77b7fd955d6316299";
const EVO_URL = "https://api.evoapicloud.com";
const EVO_ID = "756d5e00-dcf5-4e67-84de-29d71fd279a3";
const EVO_TOKEN = "B4BBB16CEEA8-42A1-A6ED-04D81D9B42F1";
const PORT = process.env.PORT || 8080;
const chatSessions = {};

app.post('/webhook', async (req, res) => {
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
    
    // Si no existe sesión, crear una nueva
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

    // Enviar mensaje y obtener respuesta
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

    // Enviar respuesta por WhatsApp
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
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 Servidor del bot iniciado y escuchando en el puerto ${serverPort}`);
});
