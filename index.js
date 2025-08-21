const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔥 VALORES HARDCODEADOS - NO SE HAN CAMBIADO
const EVO_API_KEY = "C25AE83B0559-4EB6-825A-10D9B745FD61";
const RETELL_API_KEY = "key_98bff79098c79f41ea2c02327ed2";  
const RETELL_AGENT_ID = "agent_0452f6bca77b7fd955d6316299";

// =======================================================================
// ✅ URL DEL PDF Y NOMBRE DE ARCHIVO - ACTUALIZADOS CON TU INFORMACIÓN
// =======================================================================
const PDF_MENU_URL = "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";
const PDF_FILENAME = "Carta_La_Rustica.pdf";

// Endpoints de Evolution API (extraídos de tu código para mayor claridad )
const EVO_SEND_TEXT_URL = `https://api.evoapicloud.com/message/sendText/f45cf2e8-1808-4379-a61c-88acd8e0625f`;
const EVO_SEND_MEDIA_URL = `https://api.evoapicloud.com/message/sendMedia/f45cf2e8-1808-4379-a61c-88acd8e0625f`;


// Storage para sesiones de chat con timestamps (sin cambios )
const chatSessions = {};
const sessionTimestamps = {};

// Configuración de inactividad (sin cambios)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; 
const CLEANUP_INTERVAL = 5 * 60 * 1000;   

// Función para limpiar sesiones inactivas (sin cambios)
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

// Iniciar limpieza automática (sin cambios)
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);
console.log(`🕐 Sistema de limpieza iniciado: ${INACTIVITY_TIMEOUT/60000} minutos de inactividad`);

console.log('🚀 SERVIDOR INICIADO CON VALORES HARDCODEADOS');
console.log('✅ EVO_API_KEY:', EVO_API_KEY.substring(0, 10) + '...');
console.log('✅ RETELL_API_KEY:', RETELL_API_KEY.substring(0, 10) + '...');  
console.log('✅ RETELL_AGENT_ID:', RETELL_AGENT_ID.substring(0, 10) + '...');
console.log('🔗 URL del Menú PDF:', PDF_MENU_URL);


// =======================================================================
// RUTA PRINCIPAL DEL WEBHOOK - GESTIONA LOS MENSAJES ENTRANTES
// =======================================================================
app.post('/webhook', async (req, res) => {
    console.log('-> Webhook principal [/webhook] recibido!');
    
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

        // PASO 1: CREAR O USAR SESIÓN DE CHAT EN RETELL (sin cambios)
        let chatId = chatSessions[senderNumber];
        if (!chatId) {
            console.log(`[${senderNumber}] 🚀 Creando nueva sesión de chat...`);
            const createChatResponse = await axios.post('https://api.retellai.com/create-chat', { agent_id: RETELL_AGENT_ID }, { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } } );
            chatId = createChatResponse.data.chat_id;
            chatSessions[senderNumber] = chatId;
            sessionTimestamps[senderNumber] = Date.now();
            console.log(`✅ Nueva sesión creada con ID: ${chatId}`);
        } else {
            console.log(`♻️ Usando sesión existente: ${chatId}`);
        }

        // =======================================================================
        // 🔥 MODIFICACIÓN 1: PASAR EL NÚMERO DEL USUARIO A RETELL
        // =======================================================================
        console.log(`[${senderNumber}] 💬 Enviando mensaje a Retell AI (con dynamic_variables)...`);
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            {
                chat_id: chatId,
                content: messageContent,
                dynamic_variables: {
                    user_phone_number: senderNumber 
                }
            },
            { headers: { 'Authorization': `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
         );

        // PASO 3: PROCESAR LA RESPUESTA DE RETELL
        const messages = chatCompletionResponse.data.messages;
        const lastMessage = messages[messages.length - 1];
        const responseMessage = lastMessage?.content;

        console.log(`🤖 Retell AI responde: "${responseMessage || '[Sin contenido de texto]'}"`);
        
        if (responseMessage) {
            console.log(`[${senderNumber}] 📱 Enviando respuesta de texto a WhatsApp...`);
            await axios.post(EVO_SEND_TEXT_URL, { number: senderNumber, text: responseMessage }, { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } });
            console.log(`✅ ¡Mensaje de texto enviado exitosamente a WhatsApp!`);
        }
        
        res.status(200).json({ status: 'success', chat_id: chatId, response: responseMessage });

    } catch (error) {
        console.error('!!! ERROR en el webhook [/webhook]:', error.response?.data || error.message);
        if (error.config) {
            console.error('--- Detalles del error ---');
            console.error('URL:', error.config.method?.toUpperCase(), error.config.url);
            console.error('Data:', error.config.data);
        }
        res.status(500).json({ status: 'error', message: error.response?.data || error.message });
    }
});


// =======================================================================
// 🔥 MODIFICACIÓN 2: AÑADIR LA NUEVA RUTA PARA LA CUSTOM FUNCTION
// =======================================================================
app.post('/send-menu', async (req, res) => {
    console.log('🚀 [Custom Function] Llamada recibida en /send-menu desde Retell!');

    try {
        const senderNumber = req.body.user_phone_number;

        if (!senderNumber) {
            console.error('!!! ERROR: [Custom Function] Retell no envió el user_phone_number.');
            return res.status(400).json({ error: 'Falta el número de teléfono del usuario en la solicitud.' });
        }

        console.log(`[Custom Function] ✅ Número de teléfono recibido: ${senderNumber}`);
        console.log('[Custom Function] Enviando el PDF del menú...');

        // Lógica para enviar el PDF usando la API de Evolution
        await axios.post(
            EVO_SEND_MEDIA_URL,
            {
                number: senderNumber,
                media: {
                    url: PDF_MENU_URL,       // <-- Tu URL real
                    mimetype: 'application/pdf',
                    filename: PDF_FILENAME  // <-- Tu nombre de archivo real
                },
                text: '¡Aquí tienes nuestra carta! Avísame cuando sepas qué quieres pedir.'
            },
            { headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' } }
        );

        console.log(`[Custom Function] ✅ ¡PDF del menú enviado exitosamente a ${senderNumber}!`);

        res.status(200).json({ status: 'success', message: 'Menú enviado correctamente.' });

    } catch (error) {
        console.error('!!! ERROR en la Custom Function [/send-menu]:', error.response?.data || error.message);
        res.status(500).json({ status: 'error', message: 'No se pudo enviar el menú.' });
    }
});


// Endpoints de utilidad (Health check y Cleanup) - sin cambios
app.get('/health', (req, res) => {
    const now = Date.now();
    const activeSessions = Object.keys(chatSessions).length;
    const sessionStats = Object.entries(sessionTimestamps).reduce((acc, [number, timestamp]) => {
        const inactiveMinutes = Math.floor((now - timestamp) / 60000);
        if (inactiveMinutes < 5) acc.recent++;
        else if (inactiveMinutes < 15) acc.moderate++;
        else acc.old++;
        return acc;
    }, { recent: 0, moderate: 0, old: 0 });
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), sessions: { total: activeSessions, recent: sessionStats.recent, moderate: sessionStats.moderate, old: sessionStats.old }, config: { inactivityTimeout: `${INACTIVITY_TIMEOUT/60000} minutos`, cleanupInterval: `${CLEANUP_INTERVAL/60000} minutos` } });
});

app.post('/cleanup', (req, res) => {
    const beforeCount = Object.keys(chatSessions).length;
    cleanupInactiveSessions();
    const afterCount = Object.keys(chatSessions).length;
    res.status(200).json({ status: 'OK', cleaned: beforeCount - afterCount, remaining: afterCount, timestamp: new Date().toISOString() });
});

// Iniciar el servidor (sin cambios)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health` );
});
