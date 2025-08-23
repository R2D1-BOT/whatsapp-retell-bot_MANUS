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

// Storage de sesiones
const chatSessions = {};
const sessionTimestamps = {};

// ⏰ Configuración de inactividad
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 min
const CLEANUP_INTERVAL = 5 * 60 * 1000;   // Limpiar cada 5 min

function cleanupInactiveSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [sender, timestamp] of Object.entries(sessionTimestamps)) {
        if (now - timestamp > INACTIVITY_TIMEOUT) {
            delete chatSessions[sender];
            delete sessionTimestamps[sender];
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) {
        console.log(`🧹 Limpiadas ${cleanedCount} sesiones inactivas. Activas: ${Object.keys(chatSessions).length}`);
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

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

        // Si el mensaje incluye la palabra "menú", se podría activar la ruta /send-menu vía función Custom
        if (messageContent.toLowerCase().includes('menú')) {
            await axios.post(`${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`, {
                number: senderNumber,
                mediatype: "document",
                mimetype: "application/pdf",
                url: "https://tudominio.com/tu-menu.pdf", // <-- tu PDF real
                caption: "Aquí tienes el menú completo"
            }, { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' }});
            return res.status(200).send('Menú enviado');
        }

        // 🔥 Sesión Retell AI
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

        // 📱 Respuesta a WhatsApp
        await axios.post(
            `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: senderNumber, text: responseMessage },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        console.log(`✅ Mensaje enviado: "${responseMessage}"`);
        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });

    } catch (error) {
        console.error('!!! ERROR webhook:', error.response?.data || error.message);
        res.status(500).json({ status: 'error', message: error.response?.data || error.message });
    }
});

// ==================== RUTA PARA ENVIAR PDF (Custom Function) ====================
app.post('/send-menu', async (req, res) => {
    try {
        const { args } = req.body;
        if (!args || !args.number) return res.status(400).json({ status: 'error', message: 'Falta número de teléfono en args' });

        await axios.post(
            `${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`,
            {
                number: args.number,
                mediatype: "document",
                mimetype: "application/pdf",
                url: "https://tudominio.com/tu-menu.pdf",
                caption: "Aquí tienes el menú completo"
            },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        res.status(200).json({ status: 'success', message: 'PDF enviado' });
    } catch (err) {
        console.error('!!! ERROR send-menu:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: err.response?.data || err.message });
    }
});

// ==================== HEALTHCHECK ====================
app.get('/health', (req, res) => {
    const activeSessions = Object.keys(chatSessions).length;
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: { total: activeSessions },
        config: {
            inactivityTimeout: `${INACTIVITY_TIMEOUT/60000} min`,
            cleanupInterval: `${CLEANUP_INTERVAL/60000} min`
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});




