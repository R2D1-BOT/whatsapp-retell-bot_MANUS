const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔥 VARIABLES DE ENTORNO
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_API_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

if (!EVO_API_KEY || !EVO_API_URL || !EVO_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error('❌ Faltan variables de entorno necesarias. Verifica Render.');
    process.exit(1);
}

// Almacena sesiones activas
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Limpieza automática de sesiones inactivas
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
    if (cleanedCount > 0) console.log(`🧹 Limpiadas ${cleanedCount} sesiones inactivas.`);
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

console.log('🚀 Servidor iniciado con variables de entorno');
console.log('✅ EVO_API_KEY:', EVO_API_KEY.substring(0, 10) + '...');
console.log('✅ RETELL_API_KEY:', RETELL_API_KEY.substring(0, 10) + '...');

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

        // 🔹 Detectar palabras clave para enviar PDF
        const lowerMsg = messageContent.toLowerCase();
        if (lowerMsg.includes('menu') || lowerMsg.includes('carta')) {
            console.log(`📄 Detectada palabra clave "menu/carta". Enviando PDF...`);
            await axios.post('https://whatsapp-retell-botmanus-production-b05a.up.railway.app/send-menu', {
                args: {}
            }, {
                headers: { 'Content-Type': 'application/json' }
            });
            return res.status(200).json({ status: 'PDF enviado' });
        }

        // 🔹 Sesión Retell AI
        let chatId = chatSessions[senderNumber];
        if (!chatId) {
            const createChat = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            chatId = createChat.data.chat_id;
            chatSessions[senderNumber] = chatId;
        }

        const chatCompletion = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const messages = chatCompletion.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";

        // 🔹 Enviar respuesta a WhatsApp
        await axios.post(
            `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`,
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

// ==================== HEALTHCHECK ====================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: { total: Object.keys(chatSessions).length },
        config: {
            inactivityTimeout: `${INACTIVITY_TIMEOUT/60000} minutos`,
            cleanupInterval: `${CLEANUP_INTERVAL/60000} minutos`
        }
    });
});

// ==================== CLEANUP MANUAL ====================
app.post('/cleanup', (req, res) => {
    const beforeCount = Object.keys(chatSessions).length;
    cleanupInactiveSessions();
    const afterCount = Object.keys(chatSessions).length;
    res.status(200).json({
        status: 'OK',
        cleaned: beforeCount - afterCount,
        remaining: afterCount,
        timestamp: new Date().toISOString()
    });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});




