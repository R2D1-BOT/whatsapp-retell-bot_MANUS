const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

if (!EVO_API_KEY || !EVO_URL || !EVO_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error('❌ Faltan variables de entorno necesarias. Verifica Railway.');
    process.exit(1);
}

const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupInactiveSessions() {
    const now = Date.now();
    for (const [sender, ts] of Object.entries(sessionTimestamps)) {
        if (now - ts > INACTIVITY_TIMEOUT) {
            delete chatSessions[sender];
            delete sessionTimestamps[sender];
        }
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Webhook principal
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;
        if (eventType !== 'messages.upsert' || !messageData) return res.sendStatus(200);

        const senderNumber = messageData.key?.remoteJid;
        const messageContent = messageData.message?.conversation || 
                               messageData.message?.extendedTextMessage?.text;
        if (!senderNumber || !messageContent) return res.sendStatus(200);

        sessionTimestamps[senderNumber] = Date.now();
        let chatId = chatSessions[senderNumber];

        if (!chatId) {
            const createChat = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            chatId = createChat.data.chat_id;
            chatSessions[senderNumber] = chatId;
        }

        // Enviar mensaje a Retell AI
        const completion = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const messages = completion.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta";

        // Enviar a WhatsApp
        await axios.post(
            `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: senderNumber, text: responseMessage },
            { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });

    } catch (err) {
        console.error('❌ Error webhook:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: err.response?.data || err.message });
    }
});

// Endpoint para enviar PDF manualmente
app.post('/send-menu', async (req, res) => {
    const { number, pdf_url } = req.body;
    if (!number || !pdf_url) return res.status(400).json({ status: 'error', message: 'Faltan parámetros' });

    try {
        await axios.post(
            `${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`,
            { number, mediatype: 'document', mimetype: 'application/pdf', url: pdf_url },
            { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } }
        );
        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('❌ Error enviando PDF:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: err.response?.data || err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));

