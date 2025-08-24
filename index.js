const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================= VARIABLES DE ENTORNO =================
const EVO_API_KEY = process.env.EVO_API_KEY; // bd8e2dda-5...
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL; // https://api.evoapicloud.com
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE; // f45cf2e8-1808-4379-a61c-88acd8e0625f
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID; // agent_0452f6bca77b7fd955d6316299
const RETELL_API_KEY = process.env.RETELL_API_KEY; // key_98bff79098c79f41ea2c02327ed2

if (!EVO_API_KEY || !EVOLUTION_API_URL || !EVO_INSTANCE || !RETELL_AGENT_ID || !RETELL_API_KEY) {
    console.error('❌ Faltan variables de entorno necesarias. Configura EVO y RETELL correctamente.');
    process.exit(1);
}

// ================= GESTIÓN DE SESIONES =================
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutos
const CLEANUP_INTERVAL = 60 * 1000; // 1 minuto

function cleanupInactiveSessions() {
    const now = Date.now();
    for (const [number, timestamp] of Object.entries(sessionTimestamps)) {
        if (now - timestamp > INACTIVITY_TIMEOUT) {
            console.log(`🧹 Limpiando sesión inactiva: ${number}`);
            delete chatSessions[number];
            delete sessionTimestamps[number];
        }
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

// ================= WEBHOOK =================
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

        // ==================== DISPARAR SEND PDF ====================
        // Aquí lanzamos Retell Custom Function vía POST a Make.com
        if (messageContent.toLowerCase().includes('menu') || messageContent.toLowerCase().includes('pdf')) {
            console.log(`📄 Disparando envío de PDF para ${senderNumber}...`);
            try {
                await axios.post(
                    'https://hook.eu2.make.com/xxxxxxxxx', // Tu webhook de Make.com
                    {
                        number: senderNumber,
                        pdf_url: "https://raw.githubusercontent.com/R2D1-BOT/whatsapp-retell-bot_MANUS/main/menu.pdf"
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                console.log(`✅ PDF solicitado para ${senderNumber}`);
                return res.status(200).json({ status: 'PDF solicitado' });
            } catch (err) {
                console.error(`❌ Error enviando PDF a Make.com:`, err.message);
                return res.status(500).json({ status: 'error', message: err.message });
            }
        }

        // ==================== SESIÓN RETELL ====================
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

        // ==================== ENVIAR RESPUESTA A WHATSAPP ====================
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

// ================= HEALTHCHECK =================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: Object.keys(chatSessions).length
    });
});

// ================= INICIAR SERVIDOR =================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});





