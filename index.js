const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// =======================================================================
// 🔥 VARIABLES DE ENTORNO
// =======================================================================
const EVO_API_KEY = process.env.EVO_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE_ID = process.env.EVOLUTION_INSTANCE;
const PORT = process.env.PORT || 8080;

const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_API_KEY = process.env.RETELL_API_KEY;

// =======================================================================
// GESTIÓN DE SESIONES SIMPLES
// =======================================================================
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupInactiveSessions() {
    const now = Date.now();
    for (const number in sessionTimestamps) {
        if (now - sessionTimestamps[number] > INACTIVITY_TIMEOUT) {
            delete chatSessions[number];
            delete sessionTimestamps[number];
            console.log(`⏳ Sesión de ${number} eliminada por inactividad.`);
        }
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

console.log('🚀 Servidor iniciado');

// =======================================================================
// FUNCIONES PRINCIPALES
// =======================================================================
async function sendMessageToRetell(senderNumber, messageContent) {
    try {
        let chatId = chatSessions[senderNumber];
        if (!chatId) {
            // Crear nueva sesión
            const resCreate = await axios.post(
                `https://api.retellai.com/v1/agents/${RETELL_AGENT_ID}/create-chat`,
                {},
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } }
            );
            chatId = resCreate.data.chat_id;
            chatSessions[senderNumber] = chatId;
            console.log(`🚀 Nueva sesión en Retell para ${senderNumber}`);
        }

        // Enviar mensaje a Retell
        const resChat = await axios.post(
            `https://api.retellai.com/v1/chats/${chatId}/completions`,
            { content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } }
        );

        const lastMessage = resChat.data.messages?.slice(-1)[0]?.content;
        if (lastMessage) {
            console.log(`[${senderNumber}] 🤖 Retell responde: "${lastMessage}"`);
            // Enviar texto al usuario por Evo
            await axios.post(
                `${EVO_URL}/message/sendText/${EVO_INSTANCE_ID}`,
                { number: senderNumber, text: lastMessage },
                { headers: { 'apikey': EVO_API_KEY } }
            );
        }

    } catch (err) {
        console.error('❌ Error en sendMessageToRetell:', err.response?.data || err.message);
    }
}

// =======================================================================
// RUTA PRINCIPAL DEL BOT
// =======================================================================
app.post('/webhook', async (req, res) => {
    const messageData = req.body.data;
    const eventType = req.body.event;

    if (eventType !== 'messages.upsert' || !messageData) {
        console.warn('⚠️ Mensaje entrante inválido:', req.body);
        return res.status(200).send('OK');
    }

    const senderNumber = messageData.key?.remoteJid;
    const messageContent = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text;

    if (!senderNumber || !messageContent) return res.status(200).send('OK');

    console.log(`[${senderNumber}] dice: "${messageContent}"`);
    sessionTimestamps[senderNumber] = Date.now();

    await sendMessageToRetell(senderNumber, messageContent);

    res.status(200).send('OK');
});

// =======================================================================
// HEALTH CHECK
// =======================================================================
app.get('/', (req, res) => {
    res.status(200).send('Bot is alive!');
});

// =======================================================================
// INICIAR SERVIDOR
// =======================================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});










