const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔥 VARIABLES HARDCODEADAS - SUSTITUIR POR LAS DE RENDER SI QUIERES
const EVOLUTION_API_KEY= "bd8e2dda-5ddd-424a-978c-476b562da116";
const EVOLUTION_API_URL = "https://api.evoapicloud.com";
const EVOLUTION_INSTANCE = "f45cf2e8-1808-4379-a61c-88acd8e0625f";
const RETELL_API_KEY = "key_98bff79098c79f41ea2c02327ed2";  
const RETELL_AGENT_ID = "agent_0452f6bca77b7fd955d6316299";

// Sesiones de chat con timestamps
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

console.log('🚀 Servidor iniciado');
console.log('✅ EVOLUTION_API_KEY:', EVOLUTION_API_KEY.substring(0,10)+'...');
console.log('✅ RETELL_API_KEY:', RETELL_API_KEY.substring(0,10)+'...');

// ==================== WEBHOOK ====================
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;

        if (eventType !== 'messages.upsert' || !messageData) return res.status(200).send('OK');

        const senderNumber = messageData.key?.remoteJid;
        const messageContent = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text;

        if (!senderNumber || !messageContent) return res.status(200).send('OK');

        console.log(`[${senderNumber}] dice: "${messageContent}"`);
        sessionTimestamps[senderNumber] = Date.now();

        // 🔹 Detectar palabra clave para enviar PDF
        const lowerMsg = messageContent.toLowerCase();
        if (lowerMsg.includes('menu') || lowerMsg.includes('carta')) {
            console.log(`📄 Detectada palabra clave "menu/carta". Solicitando chat ID...`);

            // GET a /get-chat-id para obtener el ID (Custom Function)
            const getIdRes = await axios.get(`https://whatsapp-retell-bot-manus.onrender.com/get-chat-id?phone=${senderNumber}`, {
                headers: { 'Content-Type': 'application/json' }
            });

            const chatId = getIdRes.data.chat_id;
            console.log(`🆔 Chat ID obtenido: ${chatId}`);

            // Aquí podrías disparar otra función para enviar el PDF vía Make.com con ese chatId

            return res.status(200).json({ status: 'chat_id_obtenido', chat_id: chatId });
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
            `${EVOLUTION_API_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: senderNumber, text: responseMessage },
            { headers: { 'apikey':EVOLUTION_API_KEY, 'Content-Type': 'application/json' } }
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
        sessions: { total: Object.keys(chatSessions).length }
    });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});



