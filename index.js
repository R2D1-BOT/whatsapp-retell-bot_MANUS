const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_API_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

if (!EVO_API_KEY || !EVO_API_URL || !EVO_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error('❌ Faltan variables de entorno');
    process.exit(1);
}

const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupInactiveSessions() {
    const now = Date.now();
    for (const [num, ts] of Object.entries(sessionTimestamps)) {
        if (now - ts > INACTIVITY_TIMEOUT) {
            delete chatSessions[num];
            delete sessionTimestamps[num];
        }
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

// WEBHOOK
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body.data;
        const event = req.body.event;

        if (event !== 'messages.upsert' || !data) return res.sendStatus(200);

        const sender = data.key?.remoteJid;
        const msg = data.message?.conversation || data.message?.extendedTextMessage?.text;
        if (!sender || !msg) return res.sendStatus(200);

        console.log(`[${sender}] ${msg}`);
        sessionTimestamps[sender] = Date.now();

        // Enviar PDF si detecta menu/carta
        const low = msg.toLowerCase();
        if (low.includes('menu') || low.includes('carta')) {
            await axios.post(`${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`, {
                number: sender,
                mediatype: "document",
                mimetype: "application/pdf",
                caption: "Aquí tienes la carta",
                url: "https://restaurantelarustica.com/pizzaypasta/wp-content/uploads/2024/07/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf"
            }, { headers: { apikey: EVO_API_KEY } });
            return res.json({ status: 'PDF enviado' });
        }

        // Retell session
        let chatId = chatSessions[sender];
        if (!chatId) {
            const create = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { Authorization: `Bearer ${RETELL_API_KEY}` } }
            );
            chatId = create.data.chat_id;
            chatSessions[sender] = chatId;
        }

        const chat = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: msg },
            { headers: { Authorization: `Bearer ${RETELL_API_KEY}` } }
        );

        const responseMsg = chat.data.messages.slice(-1)[0]?.content || "Sin respuesta";
        await axios.post(
            `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: sender, text: responseMsg },
            { headers: { apikey: EVO_API_KEY } }
        );

        res.json({ status: 'success', chat_id: chatId, response: responseMsg });

    } catch (err) {
        console.error('Webhook error:', err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// Health
app.get('/health', (req, res) => {
    res.json({ status: "OK", sessions: Object.keys(chatSessions).length });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});




