const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// --- VALORES CONSTANTES ---
const EVO_API_KEY = "C25AE83B0559-4EB6-825A-10D9B745FD61";
const RETELL_API_KEY = "key_98bff79098c79f41ea2c02327ed2";  
const RETELL_AGENT_ID = "agent_0452f6bca77b7fd955d6316299";
const PDF_MENU_URL = "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";
const PDF_FILENAME = "Carta_La_Rustica.pdf";
const EVO_INSTANCE_ID = "f45cf2e8-1808-4379-a61c-88acd8e0625f";
const EVO_SEND_TEXT_URL = `https://api.evoapicloud.com/message/sendText/${EVO_INSTANCE_ID}`;
const EVO_SEND_MEDIA_URL = `https://api.evoapicloud.com/message/sendMedia/${EVO_INSTANCE_ID}`;

// --- GESTIÓN DE SESIONES ---
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; 
const CLEANUP_INTERVAL = 5 * 60 * 1000;   

function cleanupInactiveSessions( ) { /* ...código sin cambios... */ }
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

console.log('🚀 [DIAG] SERVIDOR INICIADO');

// =======================================================================
// 🔥🔥 DIAGNÓSTICO: Ruta raíz para health check y logs
// =======================================================================
app.get('/', (req, res) => {
    console.log('🩺 [DIAG] Petición recibida en la ruta raíz "/"');
    res.status(200).send('Bot is alive!');
});

// =======================================================================
// RUTA PRINCIPAL DEL WEBHOOK
// =======================================================================
app.post('/webhook', async (req, res) => {
    console.log('-> [DIAG] Petición recibida en /webhook');
    
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;
        if (eventType !== 'messages.upsert' || !messageData) {
            console.log('-> [DIAG] Evento no procesable, saliendo.');
            return res.status(200).send('OK');
        }

        const senderNumber = messageData.key?.remoteJid;
        const messageContent = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text;
        if (!senderNumber || !messageContent) {
            console.log('-> [DIAG] Mensaje sin contenido o remitente, saliendo.');
            return res.status(200).send('OK');
        }

        console.log(`[${senderNumber}] dice: "${messageContent}"`);
        sessionTimestamps[senderNumber] = Date.now();

        let chatId = chatSessions[senderNumber];
        if (!chatId) {
            console.log(`[${senderNumber}] 🚀 Creando nueva sesión de chat...`);
            const createChatResponse = await axios.post('https://api.retellai.com/create-chat', { agent_id: RETELL_AGENT_ID }, { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } } );
            chatId = createChatResponse.data.chat_id;
            chatSessions[senderNumber] = chatId;
        }

        console.log(`[${senderNumber}] 💬 Enviando mensaje a Retell AI...`);
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            {
                chat_id: chatId,
                content: messageContent,
                dynamic_variables: { user_phone_number: senderNumber }
            },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}` } }
         );

        const lastMessage = chatCompletionResponse.data.messages[chatCompletionResponse.data.messages.length - 1];
        const responseMessage = lastMessage?.content;

        if (responseMessage) {
            console.log(`🤖 Retell AI responde (texto): "${responseMessage}"`);
            await axios.post(EVO_SEND_TEXT_URL, { number: senderNumber, text: responseMessage }, { headers: { 'apikey': EVO_API_KEY } });
        }
        
        console.log('-> [DIAG] Finalizando /webhook correctamente.');
        res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error('!!! ERROR CATASTRÓFICO en /webhook:', error.response?.data || error.message);
        res.status(500).json({ status: 'error' });
    }
});

// =======================================================================
// RUTA PARA LA CUSTOM FUNCTION
// =======================================================================
app.post('/send-menu', async (req, res) => {
    console.log('🚀 [DIAG] Petición recibida en /send-menu');

    try {
        const senderNumber = req.body.user_phone_number;
        if (!senderNumber) {
            console.error('!!! ERROR: [Custom Function] Retell no envió el user_phone_number.');
            return res.status(400).json({ error: 'Falta el número de teléfono.' });
        }

        console.log(`[Custom Function] ✅ Número recibido: ${senderNumber}. Enviando PDF...`);
        await axios.post(
            EVO_SEND_MEDIA_URL,
            {
                number: senderNumber,
                media: { url: PDF_MENU_URL, mimetype: 'application/pdf', filename: PDF_FILENAME },
                text: '¡Aquí tienes nuestra carta! Avísame cuando sepas qué quieres pedir.'
            },
            { headers: { 'apikey': EVO_API_KEY } }
        );

        console.log(`[Custom Function] ✅ ¡PDF enviado a ${senderNumber}!`);
        console.log('-> [DIAG] Finalizando /send-menu correctamente.');
        res.status(200).json({ status: 'success' });

    } catch (error) {
        console.error('!!! ERROR CATASTRÓFICO en /send-menu:', error.response?.data || error.message);
        res.status(500).json({ status: 'error' });
    }
});

// --- ENDPOINTS DE UTILIDAD (Sin cambios) ---
app.get('/health', (req, res) => {
    console.log('🩺 [DIAG] Petición recibida en la ruta /health');
    res.status(200).json({ status: 'OK' });
});
app.post('/cleanup', (req, res) => { /* ...código sin cambios... */ });

// --- INICIAR SERVIDOR ---
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ [DIAG] Servidor escuchando en puerto ${PORT}`);
});

// =======================================================================
// 🔥🔥 DIAGNÓSTICO: Capturador global de errores no controlados
// =======================================================================
process.on('uncaughtException', (error, origin) => {
    console.error('🔥🔥🔥 ERROR GLOBAL NO CAPTURADO 🔥🔥🔥');
    console.error('Error:', error);
    console.error('Origen:', origin);
    process.exit(1); // Salir de forma controlada para que Railway muestre el error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥🔥🔥 PROMESA RECHAZADA NO CAPTURADA 🔥🔥🔥');
    console.error('Razón:', reason);
});

