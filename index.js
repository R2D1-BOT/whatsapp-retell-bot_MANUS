const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

console.log('🚀 Servidor del bot iniciado y escuchando en el puerto', PORT);

// 🎯 ENDPOINT CORRECTO - RETELL AI BASE URL
const RETELL_API_BASE = 'https://api.retellai.com/v2'; // ⭐ ESTA ERA LA URL QUE FALTABA

app.post('/webhook', async (req, res) => {
    try {
        console.log('-> Webhook recibido!', JSON.stringify(req.body, null, 1));

        // Extraer datos del mensaje
        const messageData = req.body.data;
        const from = messageData?.key?.remoteJid;
        const senderName = req.body.pushName || 'Usuario';
        const messageContent = messageData?.message?.conversation;
        const messageType = req.body.messageType;

        if (!messageContent || messageType !== 'conversation') {
            return res.status(200).json({ status: 'ignored', reason: 'No es mensaje de texto' });
        }

        console.log(`[${from} - ${senderName}] dice: "${messageContent}"`);

        // Obtener credenciales desde variables de entorno
        const retellApiKey = process.env.RETELL_API_KEY;
        const retellAgentId = process.env.RETELL_AGENT_ID;
        const evoApiKey = process.env.EVO_API_KEY;

        console.log('🔑 API Key:', retellApiKey ? 'RECIBIDA' : 'FALTANTE');
        console.log('🤖 Agent ID:', retellAgentId ? 'RECIBIDO' : 'FALTANTE');

        if (!retellApiKey || !retellAgentId || !evoApiKey) {
            throw new Error('Faltan variables de entorno requeridas');
        }

        // ============================================
        // 🔥 PASO 1: CREAR SESIÓN DE CHAT EN RETELL AI
        // ============================================
        console.log(`[${from}] Creando sesión de chat en Retell AI...`);
        const createChatResponse = await axios.post(`${RETELL_API_BASE}/create-chat`, {
            agent_id: retellAgentId,
            metadata: {
                user_phone: from,
                user_name: senderName,
                source: 'whatsapp'
            }
        }, {
            headers: {
                'Authorization': `Bearer ${retellApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const chatId = createChatResponse.data.chat_id;
        console.log(`✅ Sesión creada con ID: ${chatId}`);

        // ================================================
        // 🔥 PASO 2: ENVIAR MENSAJE Y OBTENER RESPUESTA
        // ================================================
        console.log(`[${from}] Enviando mensaje a Retell AI...`);
        const chatCompletionResponse = await axios.post(`${RETELL_API_BASE}/create-chat-completion`, {
            chat_id: chatId,
            message: messageContent
        }, {
            headers: {
                'Authorization': `Bearer ${retellApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const responseMessage = chatCompletionResponse.data.response;
        console.log(`🤖 Respuesta del agente: "${responseMessage}"`);

        // ===============================================
        // 🔥 PASO 3: ENVIAR RESPUESTA DE VUELTA A WHATSAPP
        // ===============================================
        console.log(`[${from}] Enviando respuesta a WhatsApp...`);
        await axios.post('https://api.evoapicloud.com/message/sendText', {
            apikey: evoApiKey,
            phone: from.replace('@s.whatsapp.net', ''),
            text: responseMessage
        });

        console.log(`✅ Mensaje enviado exitosamente a ${senderName}`);

        res.status(200).json({
            status: 'success',
            chat_id: chatId,
            agent_response: responseMessage
        });

    } catch (error) {
        console.error('!!! ERROR en el webhook:', error.response?.data || error.message);
        console.log('--- Detalles del Error ---');
        
        if (error.response) {
            console.log(`URL: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
            console.log(`Status: ${error.response.status}`);
            console.log(`Headers: ${JSON.stringify(error.config?.headers, null, 2)}`);
            console.log(`Response:`, error.response.data);
        }
        
        res.status(500).json({
            status: 'error',
            message: error.response?.data || error.message
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'WhatsApp + Retell AI Bot está funcionando!', 
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🔥 Servidor corriendo en puerto ${PORT}`);
});
