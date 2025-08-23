const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ======================
// 🚀 Configuración
// ======================
const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// ======================
// ⚠ Verificación de variables
// ======================
if (!EVO_API_KEY || !EVO_URL || !EVO_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error('❌ Faltan variables de entorno necesarias. Verifica Railway.');
}

// ======================
// 💾 Sesiones y limpieza
// ======================
const chatSessions = {};
const sessionTimestamps = {};

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupInactiveSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [senderNumber, timestamp] of Object.entries(sessionTimestamps)) {
        if (now - timestamp > INACTIVITY_TIMEOUT) {
            delete chatSessions[senderNumber];
            delete sessionTimestamps[senderNumber];
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`🧹 Limpiadas ${cleanedCount} sesiones inactivas. Sesiones activas: ${Object.keys(chatSessions).length}`);
    }
}

setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

// ======================
// 🔹 Rutas
// ======================

// Ruta principal para Railway Healthcheck
app.get('/', (req, res) => {
    res.status(200).send('Bot is running 🚀');
});

// Ruta Health interna
app.get('/health', (req, res) => {
    const now = Date.now();
    const activeSessions = Object.keys(chatSessions).length;

    const sessionStats = Object.entries(sessionTimestamps).reduce((acc, [number, timestamp]) => {
        const inactiveMinutes = Math.floor((now - timestamp) / 60000);
        if (inactiveMinutes < 5) acc.recent++;
        else if (inactiveMinutes < 15) acc.moderate++;
        else acc.old++;
        return acc;
    }, { recent: 0, moderate: 0, old: 0 });

    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: {
            total: activeSessions,
            recent: sessionStats.recent,
            moderate: sessionStats.moderate,
            old: sessionStats.old
        },
        config: {
            inactivityTimeout: `${INACTIVITY_TIMEOUT/60000} minutos`,
            cleanupInterval: `${CLEANUP_INTERVAL/60000} minutos`
        }
    });
});

// Endpoint webhook para WhatsApp
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
        if (!chatId) {
            const createChatResponse = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            chatId = createChatResponse.data.chat_id;
            chatSessions[senderNumber] = chatId;
        }

        // Enviar mensaje a Retell AI
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const messages = chatCompletionResponse.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";

        // Enviar mensaje a WhatsApp
        await axios.post(
            `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: senderNumber, text: responseMessage },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });

    } catch (error) {
        console.error('❌ Error webhook:', error.response?.data || error.message);
        res.status(500).json({ status: 'error', message: error.response?.data || error.message });
    }
});

// Endpoint manual de limpieza
app.post('/cleanup', (req, res) => {
    const beforeCount = Object.keys(chatSessions).length;
    cleanupInactiveSessions();
    const afterCount = Object.keys(chatSessions).length;

    res.status(200).json({ status: 'OK', cleaned: beforeCount - afterCount, remaining: afterCount });
});

// ======================
// 🚀 Iniciar servidor
// ======================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bot corriendo en puerto ${PORT}`);
});


