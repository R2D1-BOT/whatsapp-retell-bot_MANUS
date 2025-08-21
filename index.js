const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔥 VALORES HARDCODEADOS - FUNCIONARÁ INMEDIATAMENTE
const EVO_API_KEY = "C25AE83B0559-4EB6-825A-10D9B745FD61";
const RETELL_API_KEY = "key_98bff79098c79f41ea2c02327ed2";  
const RETELL_AGENT_ID = "agent_0452f6bca77b7fd955d6316299";

// Storage para sesiones de chat con timestamps
const chatSessions = {};
const sessionTimestamps = {};

// 🎯 CONFIGURACIÓN DE INACTIVIDAD - CAMBIADO A 5 MINUTOS
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // ⏰ 5 MINUTOS (era 30 minutos)
const CLEANUP_INTERVAL = 5 * 60 * 1000;   // 🧹 Limpiar cada 5 minutos

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

// Iniciar limpieza automática
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);
console.log(`🕐 Sistema de limpieza iniciado: ${INACTIVITY_TIMEOUT/60000} minutos de inactividad`);

console.log('🚀 SERVIDOR INICIADO CON VALORES HARDCODEADOS');
console.log('✅ EVO_API_KEY:', EVO_API_KEY.substring(0, 10) + '...');
console.log('✅ RETELL_API_KEY:', RETELL_API_KEY.substring(0, 10) + '...');  
console.log('✅ RETELL_AGENT_ID:', RETELL_AGENT_ID.substring(0, 10) + '...');

app.post('/webhook', async (req, res) => {
    console.log('-> Webhook recibido! VERSIÓN DEFINITIVA');
    
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

        // Actualizar timestamp de actividad
        sessionTimestamps[senderNumber] = Date.now();

        // ============================================
        // 🔥 PASO 1: CREAR SESIÓN DE CHAT EN RETELL AI  
        // ============================================
        let chatId = chatSessions[senderNumber];
        
        if (!chatId) {
            console.log(`[${senderNumber}] 🚀 Creando nueva sesión de chat...`);
            
            const createChatResponse = await axios.post(
                'https://api.retellai.com/create-chat',
                {
                    agent_id: RETELL_AGENT_ID
                },
                {
                    headers: {
                        'Authorization': `Bearer ${RETELL_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
             );

            chatId = createChatResponse.data.chat_id;
            chatSessions[senderNumber] = chatId;
            sessionTimestamps[senderNumber] = Date.now();
            
            console.log(`✅ Nueva sesión creada con ID: ${chatId}`);
        } else {
            console.log(`♻️ Usando sesión existente: ${chatId}`);
        }

        // ============================================
        // 💬 PASO 2: ENVIAR MENSAJE A RETELL AI
        // ============================================
        console.log(`[${senderNumber}] 💬 Enviando mensaje a Retell AI...`);
        
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/create-chat-completion',
            {
                chat_id: chatId,
                content: messageContent
            },
            {
                headers: {
                    'Authorization': `Bearer ${RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
         );

        // La respuesta viene en el array messages, buscamos el último mensaje del agent
        const messages = chatCompletionResponse.data.messages;
        const responseMessage = messages[messages.length - 1]?.content || "Sin respuesta del agente";
        console.log(`🤖 Retell AI responde: "${responseMessage}"`);

        // ============================================
        // 📱 PASO 3: ENVIAR RESPUESTA A WHATSAPP
        // ============================================
        console.log(`[${senderNumber}] 📱 Enviando respuesta a WhatsApp...`);
        
        await axios.post(
            `https://api.evoapicloud.com/message/sendText/f45cf2e8-1808-4379-a61c-88acd8e0625f`,
            {
                number: senderNumber,
                text: responseMessage
            },
            {
                headers: {
                    'apikey': EVO_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
         );

        console.log(`✅ ¡Mensaje enviado exitosamente a WhatsApp!`);
        
        res.status(200).json({
            status: 'success',
            chat_id: chatId,
            response: responseMessage
        });

    } catch (error) {
        console.error('!!! ERROR en el webhook:', error.response?.data || error.message);
        
        if (error.config) {
            console.error('--- Detalles del error ---');
            console.error('URL:', error.config.method?.toUpperCase(), error.config.url);
            console.error('Data:', error.config.data);
        }
        
        res.status(500).json({
            status: 'error',
            message: error.response?.data || error.message
        });
    }
});

// Health check endpoint con información de sesiones
app.get('/health', (req, res) => {
    const now = Date.now();
    const activeSessions = Object.keys(chatSessions).length;
    
    // Calcular sesiones por tiempo de inactividad
    const sessionStats = Object.entries(sessionTimestamps).reduce((acc, [number, timestamp]) => {
        const inactiveMinutes = Math.floor((now - timestamp) / 60000);
        if (inactiveMinutes < 5) acc.recent++;
        else if (inactiveMinutes < 15) acc.moderate++;
        else acc.old++;
        return acc;
    }, { recent: 0, moderate: 0, old: 0 });
    
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: {
            total: activeSessions,
            recent: sessionStats.recent,      // < 5 min
            moderate: sessionStats.moderate, // 5-15 min  
            old: sessionStats.old           // > 15 min
        },
        config: {
            inactivityTimeout: `${INACTIVITY_TIMEOUT/60000} minutos`,
            cleanupInterval: `${CLEANUP_INTERVAL/60000} minutos`
        }
    });
});

// Endpoint para forzar limpieza manual
app.post('/cleanup', (req, res) => {
    const beforeCount = Object.keys(chatSessions).length;
    cleanupInactiveSessions();
    const afterCount = Object.keys(chatSessions).length;
    
    res.status(200).json({
        status: 'OK',
        cleaned: beforeCount - afterCount,
        remaining: afterCount,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health` );
});


