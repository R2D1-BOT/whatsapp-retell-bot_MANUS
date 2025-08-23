const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔥 VARIABLES OBLIGATORIAS DE ENTORNO
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_API_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

if (!EVO_API_KEY || !EVO_API_URL || !EVO_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error('❌ Faltan variables de entorno necesarias. Verifica Railway.');
    process.exit(1);
}

// Storage para sesiones de chat con timestamps
const chatSessions = {};
const sessionTimestamps = {};

// ⏰ CONFIGURACIÓN DE INACTIVIDAD
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000;   // Limpiar cada 5 minutos

// Función para limpiar sesiones inactivas
function cleanupInactiveSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [senderNumber, timestamp] of Object.entries(sessionTimestamps)) {
        if (now - timestamp > INACTIVITY_TIMEOUT) {
            console.log(`🧹 Limpiando sesión inactiva: ${senderNumber}`);
            delete chatSessions[senderNumber];
            delete sessionTimestamps[senderNumber];
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`✅ Limpiadas ${cleanedCount} sesiones inactivas. Sesiones activas: ${Object.keys(chatSessions).length}`);
    }
}

// Iniciar limpieza automática
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);
console.log(`🕐 Sistema de limpieza iniciado: ${INACTIVITY_TIMEOUT/60000} minutos de inactividad`);

console.log('🚀 Servidor iniciado con variables de entorno');
console.log('✅ EVO_API_KEY:', EVO_API_KEY.substring(0, 10) + '...');
console.log('✅ RETELL_API_KEY:', RETELL_API_KEY.substring(0, 10) + '...');
console.log('✅ RETELL_AGENT_ID:', RETELL_AGENT_ID.substring(0, 10) + '...');

// ==================== WEBHOOK ====================
app.post('/webhook', async (req, res) => {
    console.log('-> Webhook recibido');

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

        // 🔥 Crear sesión en Retell AI si no existe
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

        // 💬 Enviar mensaje a Retell AI
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const messages = chatCompletionResponse.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";

        // 📱 Enviar respuesta a WhatsApp
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
    const now = Date.now();
    const activeSessions = Object.keys(chatSessions).length;

    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: {
            total: activeSessions
        },
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



