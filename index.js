const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Variables de entorno
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// ✅ Sesiones de chat
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupInactiveSessions() {
  const now = Date.now();
  for (const [number, timestamp] of Object.entries(sessionTimestamps)) {
    if (now - timestamp > INACTIVITY_TIMEOUT) {
      delete chatSessions[number];
      delete sessionTimestamps[number];
    }
  }
}

setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

// ------------------ WEBSOCKET ------------------
const wss = new WebSocket.Server({ port: 8081 });
wss.on('connection', ws => {
  ws.on('message', async message => {
    try {
      const { number, pdf_url } = JSON.parse(message);

      await axios.post(
        `${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`,
        {
          number,
          mediatype: 'document',
          mimetype: 'application/pdf',
          url: pdf_url
        },
        { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } }
      );

      ws.send(JSON.stringify({ status: 'success', number }));
    } catch (err) {
      ws.send(JSON.stringify({ status: 'error', error: err.message }));
    }
  });
});

// ------------------ ENDPOINTS ------------------
app.post('/webhook', async (req, res) => {
  try {
    const messageData = req.body.data;
    const eventType = req.body.event;

    if (!messageData || eventType !== 'messages.upsert') return res.status(200).send('OK');

    const senderNumber = messageData.key?.remoteJid;
    const messageContent = messageData.message?.conversation ||
                           messageData.message?.extendedTextMessage?.text;

    if (!senderNumber || !messageContent) return res.status(200).send('OK');

    // Sesión Retell
    let chatId = chatSessions[senderNumber];
    if (!chatId) {
      const createChatResponse = await axios.post(
        'https://api.retellai.com/create-chat',
        { agent_id: RETELL_AGENT_ID },
        { headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      chatId = createChatResponse.data.chat_id;
      chatSessions[senderNumber] = chatId;
    }

    const chatCompletionResponse = await axios.post(
      'https://api.retellai.com/create-chat-completion',
      { chat_id: chatId, content: messageContent },
      { headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    const messages = chatCompletionResponse.data.messages;
    const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta";

    await axios.post(
      `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
      { number: senderNumber, text: responseMessage },
      { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } }
    );

    res.status(200).json({ status: 'success', response: responseMessage });

  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Healthcheck
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Debug variables
app.get('/debug-env', (req, res) => {
  res.json({
    EVO_API_KEY: !!EVO_API_KEY,
    EVO_URL: !!EVO_URL,
    EVO_INSTANCE: !!EVO_INSTANCE,
    RETELL_API_KEY: !!RETELL_API_KEY,
    RETELL_AGENT_ID: !!RETELL_AGENT_ID
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Bot corriendo en puerto ${PORT}`));

