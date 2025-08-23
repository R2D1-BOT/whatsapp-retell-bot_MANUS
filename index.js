const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ============================================
// VARIABLES DE ENTORNO
// ============================================
const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// ============================================
// STORAGE DE SESIONES
// ============================================
const chatSessions = {};
const sessionTimestamps = {};

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000;   // Limpiar cada 5 minutos

function cleanupInactiveSessions() {
    const now = Date.now();
    for (const [sender, timestamp] of Object.entries(sessionTimestamps)) {
        if (now - timestamp > INACTIVITY_TIMEOUT) {
            delete chatSessions[sender];
            delete sessionTimestamps[sender];
            console.log(`🧹 Sesión inactiva eliminada: ${sender}`);
        }
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

// ============================================
// ENDPOINT RAÍZ PARA HEALTHCHECK
// ============================================
app.get('/', (req, res) => res.send('OK'));

app.get('/health', (req, res) => {
    const now = Date.now();
    const total = Object.keys(chatSessions).length;
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), sessions: total });
});

// ============================================
// ENDPOINT WEBHOOK DE MENSAJES
// ============================================
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;

        if (eventType !== 'messages.upsert' || !messageData) return res.status(200).send('OK');

        const senderNumber = messageData.key?.remoteJid;
        const messageContent = messageData.message?.conversation ||
                              messageData.message?.extendedTextMessage?.text;

        if (!senderNumber || !messageContent) return res.status(200).send('OK');

        sessionTimestamps[senderNumber] = Date.now();
        let chatId = chatSessions[senderNumber];

        // Crear sesión Retell si no existe
        if (!chatId) {
            const createChatResponse = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            chatId = createChatResponse.data.chat_id;
            chatSessions[senderNumber] = chatId;
        }

        // Comprobamos si el usuario pide menú
        if (/menu|carta|pdf/i.test(messageContent)) {
            // Enviar PDF vía Evolution
            await axios.post(
                `${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`,
                {
                    number: senderNumber,
                    mediatype: "document",
                    mimetype: "application/pdf",
                    url: "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf"
                },
                { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
            );
            return res.status(200).send('PDF enviado');
        }

        // Enviar mensaje a Retell AI
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const messages = chatCompletionResponse.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";

        // Enviar texto a WhatsApp
        await axios.post(
            `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: senderNumber, text: responseMessage },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });
    } catch (err) {
        console.error('Error webhook:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: err.response?.data || err.message });
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

