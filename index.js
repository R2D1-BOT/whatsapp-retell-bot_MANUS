const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const EVO_API_KEY = process.env.EVO_API_KEY;
const EVO_API_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

if (!EVO_API_KEY || !EVO_API_URL || !EVO_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error('❌ Faltan variables de entorno necesarias');
    process.exit(1);
}

// Almacena sesiones y timestamps
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutos
const CLEANUP_INTERVAL = 60 * 1000;      // 1 minuto

function cleanupInactiveSessions() {
    const now = Date.now();
    for (const [sender, ts] of Object.entries(sessionTimestamps)) {
        if (now - ts > INACTIVITY_TIMEOUT) {
            console.log(`🧹 Cerrando sesión inactiva: ${sender}`);
            delete chatSessions[sender];
            delete sessionTimestamps[sender];
        }
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

console.log('🚀 Servidor iniciado con variables de entorno');
console.log('✅ EVO_API_KEY:', EVO_API_KEY.substring(0,10)+'...');
console.log('✅ RETELL_API_KEY:', RETELL_API_KEY.substring(0,10)+'...');

// ================= WEBHOOK =================
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;

        if (eventType !== 'messages.upsert' || !messageData) return res.sendStatus(200);

        const sender = messageData.key?.remoteJid;
        const text = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text;
        if (!sender || !text) return res.sendStatus(200);

        sessionTimestamps[sender] = Date.now();
        console.log(`[${sender}] dice: "${text}"`);

        // 🔹 Detectar palabras clave "menu" o "carta"
        if (text.toLowerCase().includes('menu') || text.toLowerCase().includes('carta')) {
            console.log('📄 Solicitar chat ID y enviar PDF...');
            
            // 1️⃣ Obtener chat ID de Retell
            const chatIdResp = await axios.get('https://whatsapp-retell-bot-manus.onrender.com/get-chat-id', {
                headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
                params: { phone: sender }
            });
            const chatId = chatIdResp.data.chat_id;
            console.log('🆔 Chat ID recibido:', chatId);

            // 2️⃣ Trigger Make/Custom Function que envía PDF
            // Aquí Make.com hace POST a EvoAPI
            // Example payload:
            // {
            //   "number": chatId,
            //   "mediatype": "document",
            //   "mimetype": "application/pdf",
            //   "media": "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf",
            //   "fileName": "Carta_La_Rustica.pdf"
            // }
            
            return res.json({ status: 'ok', chat_id: chatId });
        }

        // 🔹 Conversación normal Retell AI
        let chatId = chatSessions[sender];
        if (!chatId) {
            const newChat = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            chatId = newChat.data.chat_id;
            chatSessions[sender] = chatId;
        }

        const response = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: text },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
        );

        const reply = response.data.messages?.[response.data.messages.length -1]?.content || "Sin respuesta";
        await axios.post(
            `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`,
            { number: sender, text: reply },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        console.log(`✅ Mensaje enviado: "${reply}"`);
        res.sendStatus(200);

    } catch (error) {
        console.error('!!! ERROR webhook:', error.response?.data || error.message);
        res.status(500).json({ status:'error', message: error.response?.data || error.message });
    }
});

// ================= HEALTHCHECK =================
app.get('/health', (req,res)=> {
    res.json({ status:'OK', timestamp: new Date(), sessions: Object.keys(chatSessions).length });
});

// ================= INICIAR SERVIDOR =================
app.listen(PORT, '0.0.0.0', ()=> {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});





