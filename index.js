const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVO_TOKEN;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// 🔍 DEBUG - Mostrar TODAS las variables de entorno
console.log("🔍 DEBUG - Variables disponibles:");
console.log("- PORT:", process.env.PORT);
console.log("- EVO_TOKEN (primeros 10):", process.env.EVO_TOKEN?.substring(0, 10));
console.log("- RETELL_API_KEY (primeros 10):", process.env.RETELL_API_KEY?.substring(0, 10));
console.log("- RETELL_AGENT_ID (primeros 10):", process.env.RETELL_AGENT_ID?.substring(0, 10));
console.log("- Todas las env keys:", Object.keys(process.env).filter(key => key.includes('EVO') || key.includes('RETELL')));

const chatSessions = {};

app.post('/webhook', async (req, res) => {
    console.log("-> Webhook recibido! v8.0 CORREGIDO");
    
    try {
        const messageData = req.body.data;
        const eventType = req.body.event;
        const senderNumber = messageData?.key?.remoteJid;
        const messageContent = messageData?.message?.conversation || messageData?.message?.extendedTextMessage?.text;

        if (eventType !== 'messages.upsert' || !senderNumber || !messageContent) {
            return res.status(200).send("OK - Evento no procesable");
        }

        console.log(`[${senderNumber}] dice: "${messageContent}"`);

        if (!RETELL_API_KEY || !RETELL_AGENT_ID || !EVO_API_KEY) {
            console.error("❌ ERROR: Faltan variables de entorno");
            console.error("- RETELL_API_KEY:", !!RETELL_API_KEY);
            console.error("- RETELL_AGENT_ID:", !!RETELL_AGENT_ID); 
            console.error("- EVO_API_KEY:", !!EVO_API_KEY);
            return res.status(500).send("Error de configuración");
        }

        console.log("✅ Todas las variables presentes");

        let chatId = chatSessions[senderNumber];
        
        if (!chatId) {
            console.log(`🚀 Creando nueva sesión para ${senderNumber}...`);
            
            const createChatResponse = await axios.post(
                'https://api.retellai.com/v2/create-chat',
                {
                    agent_id: RETELL_AGENT_ID,
                    metadata: {
                        user_phone: senderNumber,
                        source: 'whatsapp'
                    }
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
            console.log(`✅ Sesión creada: ${chatId}`);
        }

        console.log(`💬 Enviando mensaje a chat ${chatId}...`);
        
        const chatCompletionResponse = await axios.post(
            'https://api.retellai.com/v2/create-chat-completion',
            {
                chat_id: chatId,
                message: messageContent
            },
            {
                headers: {
                    'Authorization': `Bearer ${RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const botReply = chatCompletionResponse.data.response;
        console.log(`🤖 [Retell AI] responde: "${botReply}"`);

        console.log(`📱 Enviando respuesta a WhatsApp...`);
        
        await axios.post('https://api.evoapicloud.com/message/sendText', {
            apikey: EVO_API_KEY,
            phone: senderNumber.replace('@s.whatsapp.net', ''),
            text: botReply
        });

        console.log("✅ Respuesta enviada a WhatsApp");
        res.status(200).send("OK");

    } catch (error) {
        console.error("!!! ERROR en el webhook:", error.response?.data || error.message);
        
        if (error.response) {
            console.error("--- Detalles del Error ---");
            console.error(`URL: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
            console.error(`Status: ${error.response.status}`);
            console.error(`Response:`, error.response.data);
        }
        
        res.status(500).send("Internal Server Error");
    }
});

app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp + Retell AI Bot v8.0 FUNCIONANDO!', 
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 v8.0 CORREGIDO - Servidor iniciado en puerto ${PORT}`);
});
