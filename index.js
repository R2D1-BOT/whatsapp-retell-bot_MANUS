const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔑 VARIABLES DESDE RAILWAY
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE_ID = process.env.EVOLUTION_INSTANCE;
const EVO_BASE_URL = process.env.EVOLUTION_API_URL;  // nunca va a ser undefined porque ya está en Railway
const RETELL_API_KEY = process.env.RETELL_API_KEY;  
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// Debug para verificar
console.log("🔧 DEBUG VARIABLES:");
console.log("EVO_API_KEY:", EVO_API_KEY ? EVO_API_KEY.substring(0,8)+"..." : "undefined");
console.log("EVO_BASE_URL:", EVO_BASE_URL);
console.log("EVO_INSTANCE_ID:", EVO_INSTANCE_ID);
console.log("RETELL_AGENT_ID:", RETELL_AGENT_ID);


// 📂 URL DEL PDF
const MENU_PDF_URL = "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";

// Storage para sesiones de chat con timestamps
const chatSessions = {};
const sessionTimestamps = {};

// 🎯 CONFIGURACIÓN DE INACTIVIDAD
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

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
        console.log(`✅ Limpiadas ${cleanedCount} sesiones. Activas: ${Object.keys(chatSessions).length}`);
    }
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

console.log('🚀 SERVIDOR INICIADO CON VARIABLES DE ENTORNO');

// ============================================
// 🔹 WEBHOOK DE EVOLUTION → RETELL
// ============================================
app.post('/webhook', async (req, res) => {
    console.log('-> Webhook recibido!');

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

        let chatId = chatSessions[senderNumber];
        if (!chatId) {
            console.log(`[${senderNumber}] 🚀 Creando nueva sesión de chat...`);
            
            const createChatResponse = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } }
            );

            chatId = createChatResponse.data.chat_id;
            chatSessions[senderNumber] = chatId;
            sessionTimestamps[senderNumber] = Date.now();
            console.log(`✅ Nueva sesión creada con ID: ${chatId}`);
        }

        console.log(`[${senderNumber}] 💬 Enviando mensaje a Retell AI...`);
        
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            { chat_id: chatId, content: messageContent },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } }
        );

        const messages = chatCompletionResponse.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";

        console.log(`🤖 Retell AI responde: "${responseMessage}"`);

        console.log(`[${senderNumber}] 📱 Enviando respuesta a WhatsApp...`);

        await axios.post(
            `${EVO_BASE_URL}/message/sendText/${EVO_INSTANCE_ID}`,
            { number: senderNumber, text: responseMessage },
            { headers: { 'apikey': EVO_API_KEY } }
        );

        console.log(`✅ ¡Mensaje enviado a WhatsApp!`);
        
        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });

    } catch (error) {
        console.error('!!! ERROR en webhook:', error.response?.data || error.message);
        res.status(500).json({ status: 'error', message: error.response?.data || error.message });
    }
});

// ============================================
// 🔹 CUSTOM FUNCTION → ENVIAR PDF DEL MENÚ
// ============================================
app.post("/retell-function/send-menu", async (req, res) => {
    try {
        const { number } = req.body;

        if (!number) {
            return res.status(400).json({ error: "Número requerido" });
        }

        console.log(`📤 Enviando PDF a ${number}`);

        await axios.post(
            `${EVO_BASE_URL}/message/sendMedia/${EVO_INSTANCE_ID}`,
            {
                number,
                mediatype: "document",
                mimetype: "application/pdf",
                url: MENU_PDF_URL,
                caption: "Aquí tienes el menú en PDF 📋"
            },
            { headers: { 'apikey': EVO_API_KEY } }
        );

        res.json({ success: true, message: "PDF enviado" });
    } catch (error) {
        console.error("❌ Error enviando PDF:", error.response?.data || error.message);
        res.status(500).json({ error: "Fallo al enviar PDF" });
    }
});

// ============================================
// 🔹 HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        activeSessions: Object.keys(chatSessions).length
    });
});

// ============================================
// 🚀 INICIAR SERVIDOR
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

