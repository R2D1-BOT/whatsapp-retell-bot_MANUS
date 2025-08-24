const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔥 VARIABLES DE ENTORNO / CONFIGURACIÓN
const EVOLUTION_API_KEY= process.env.EVOLUTION_API_KEY || "bd8e2dda-5..."; // tu key Evolution
const EVO_INSTANCE = process.env.EVO_INSTANCE || "f45cf2e8-1808-4379-a61c-88acd8e0625f";
const RETELL_API_KEY = process.env.RETELL_API_KEY || "key_98bff7...";
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID || "agent_0452f6bca77b7fd955d6316299";

// 🔹 Sesiones de chat y timestamps
const chatSessions = {};
const sessionTimestamps = {};

// 🎯 CONFIGURACIÓN DE INACTIVIDAD
const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // ⏰ 3 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000;   // 🧹 Limpiar cada 5 minutos

// 🔹 Limpieza de sesiones inactivas
function cleanupInactiveSessions() {
    const now = Date.now();
    let cleaned = 0;
    for (const [sender, timestamp] of Object.entries(sessionTimestamps)) {
        if (now - timestamp > INACTIVITY_TIMEOUT) {
            console.log(`🧹 Limpiando sesión inactiva: ${sender}`);
            delete chatSessions[sender];
            delete sessionTimestamps[sender];
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`🧹 ${cleaned} sesiones inactivas eliminadas`);
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);


// ==================== WEBHOOK ====================
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;

        if (eventType !== 'messages.upsert' || !messageData) return res.status(200).send('OK');

        const senderNumber = messageData.key?.remoteJid;
        const messageContent = messageData.message?.conversation ||
                               messageData.message?.extendedTextMessage?.text;

        if (!senderNumber || !messageContent) return res.status(200).send('OK');

        console.log(`[${senderNumber}] dice: "${messageContent}"`);
        sessionTimestamps[senderNumber] = Date.now();

        // 🔹 Crear chat en Retell si no existe
        let chatId = chatSessions[senderNumber];
        if (!chatId) {
            const createChat = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            chatId = createChat.data.chat_id;
            chatSessions[senderNumber] = chatId;
            console.log(`🆕 Nueva sesión Retell: ${chatId}`);
        }

        // 🔹 Enviar mensaje a Retell
        const chatCompletion = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const messages = chatCompletion.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";

        // 🔹 Enviar respuesta a WhatsApp
        await axios.post(
            `${EVOLUTION_API_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: senderNumber, text: responseMessage },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Mensaje enviado a WhatsApp: "${responseMessage}"`);

        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });
    } catch (error) {
        console.error('!!! ERROR webhook:', error.response?.data || error.message);
        res.status(500).json({ status: 'error', message: error.response?.data || error.message });
    }
});

// ==================== GET CHAT ID (Custom Function para Retell) ====================
app.get('/get-chat-id', (req, res) => {
    try {
        // Retell enviará parámetros si lo necesitas, aquí devolvemos el número del usuario
        const phone = req.query.phone; // opcional si Retell lo pasa
        if (!phone) return res.status(400).json({ error: 'Se requiere parámetro phone' });

        console.log(`🔹 GET CHAT ID solicitado para: ${phone}`);
        res.status(200).json({ chat_id: phone });
    } catch (err) {
        console.error('!!! ERROR get-chat-id:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==================== HEALTHCHECK ====================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: { total: Object.keys(chatSessions).length }
    });
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});




