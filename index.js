const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Variables de entorno
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// Storage para sesiones de chat
const chatSessions = {};
const sessionTimestamps = {};

// Configuración de inactividad
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000;

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

// Limpieza automática
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);
console.log(`🕐 Sistema de limpieza iniciado: ${INACTIVITY_TIMEOUT/60000} minutos de inactividad`);

// Log de variables cargadas
console.log('🚀 Servidor iniciando con config:');
console.log('PORT:', PORT);
console.log('EVO_API_KEY:', EVO_API_KEY ? '✅' : '❌ MISSING');
console.log('EVO_URL:', EVO_URL ? '✅' : '❌ MISSING');
console.log('EVO_INSTANCE:', EVO_INSTANCE ? '✅' : '❌ MISSING');
console.log('RETELL_API_KEY:', RETELL_API_KEY ? '✅' : '❌ MISSING');
console.log('RETELL_AGENT_ID:', RETELL_AGENT_ID ? '✅' : '❌ MISSING');

// 🔹 Endpoint temporal para debug de variables de entorno
app.get("/debug-env", (req, res) => {
    res.json({
        EVO_API_KEY: EVO_API_KEY,
        EVO_URL: EVO_URL,
        EVO_INSTANCE: EVO_INSTANCE,
        RETELL_API_KEY: RETELL_API_KEY,
        RETELL_AGENT_ID: RETELL_AGENT_ID
    });
});

// Webhook principal
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;

        if (eventType !== 'messages.upsert' || !messageData) {
            return res.status(200).send('OK - Evento no procesable');
        }

        const senderNumber = messageData.key?.remoteJid;
        const messageContent = messageData.message?.conversation || 
                              messageData.message?.extendedTextMessage?.text;

        if (!senderNumber || !messageContent) {
            return res.status(200).send('OK - Sin mensaje válido');
        }

        console.log(`[${senderNumber}] dice: "${messageContent}"`);
        sessionTimestamps[senderNumber] = Date.now();

        // Crear sesión Retell AI si no existe
        let chatId = chatSessions[senderNumber];
        if (!chatId) {
            const createChatResponse = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            chatId = createChatResponse.data.chat_id;
            chatSessions[senderNumber] = chatId;
            sessionTimestamps[senderNumber] = Date.now();
            console.log(`✅ Nueva sesión Retell: ${chatId}`);
        }

        // Enviar mensaje a Retell AI
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const messages = chatCompletionResponse.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";
        console.log(`🤖 Retell AI responde: "${responseMessage}"`);

        // Enviar respuesta a WhatsApp
        await axios.post(
            `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: senderNumber, text: responseMessage },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        console.log(`✅ Mensaje enviado a WhatsApp`);
        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });

    } catch (error) {
        console.error('❌ Error webhook:', error.response?.data || error.message);
        res.status(500).json({ status: 'error', message: error.response?.data || error.message });
    }
});

// Healthcheck
app.get('/health', (req, res) => {
    const now = Date.now();
    const activeSessions = Object.keys(chatSessions).length;

    const sessionStats = Object.entries(sessionTimestamps).reduce((acc, [number, timestamp]) => {
        const inactiveMinutes = Math.floor((now - timestamp) / 60000);
        if (inactiveMinutes < 5) acc.recent = (acc.recent || 0) + 1;
        else if (inactiveMinutes < 15) acc.moderate = (acc.moderate || 0) + 1;
        else acc.old = (acc.old || 0) + 1;
        return acc;
    }, {});

    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: { total: activeSessions, ...sessionStats },
        config: { inactivityTimeout: `${INACTIVITY_TIMEOUT/60000} minutos`, cleanupInterval: `${CLEANUP_INTERVAL/60000} minutos` }
    });
});

// Forzar limpieza manual
app.post('/cleanup', (req, res) => {
    const beforeCount = Object.keys(chatSessions).length;
    cleanupInactiveSessions();
    const afterCount = Object.keys(chatSessions).length;

    res.status(200).json({ status: 'OK', cleaned: beforeCount - afterCount, remaining: afterCount, timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
