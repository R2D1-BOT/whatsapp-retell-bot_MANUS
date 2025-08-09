const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔍 MOSTRAR TODAS LAS VARIABLES AL INICIO
console.log("=== DEBUG COMPLETO DE VARIABLES ===");
console.log("TODAS LAS VARIABLES:", Object.keys(process.env));
console.log("EVO_TOKEN:", process.env.EVO_TOKEN);
console.log("RETELL_API_KEY:", process.env.RETELL_API_KEY);
console.log("RETELL_AGENT_ID:", process.env.RETELL_AGENT_ID);
console.log("=====================================");

app.post('/webhook', async (req, res) => {
    console.log("-> Mensaje recibido!");
    
    const messageData = req.body.data;
    const messageContent = messageData?.message?.conversation;
    const senderNumber = messageData?.key?.remoteJid;
    
    console.log(`Usuario: ${senderNumber}`);
    console.log(`Mensaje: "${messageContent}"`);
    
    // HARDCODEAMOS LOS VALORES EXACTOS DE RAILWAY
    const EVO_API_KEY = "C25AE83B0559-4EB6-825A-10D9B745FD61";
    const RETELL_API_KEY = "key_98bff79098c79f41ea2c02327ed2";
    const RETELL_AGENT_ID = "agent_0452f6bca77b7fd955d6316299";
    
    try {
        // PASO 1: Crear sesión
        console.log("🚀 Creando sesión...");
        const createChatResponse = await axios.post(
            'https://api.retellai.com/v2/create-chat',
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
        
        const chatId = createChatResponse.data.chat_id;
        console.log(`✅ Chat creado: ${chatId}`);
        
        // PASO 2: Enviar mensaje
        console.log("💬 Enviando mensaje...");
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
        console.log(`🤖 Respuesta: "${botReply}"`);
        
        // PASO 3: Enviar a WhatsApp
        console.log("📱 Enviando a WhatsApp...");
        await axios.post('https://api.evoapicloud.com/message/sendText', {
            apikey: EVO_API_KEY,
            phone: senderNumber.replace('@s.whatsapp.net', ''),
            text: botReply
        });
        
        console.log("✅ ¡FUNCIONÓ!");
        res.status(200).send("OK");
        
    } catch (error) {
        console.error("❌ ERROR:", error.response?.data || error.message);
        res.status(500).send("Error");
    }
});

app.get('/', (req, res) => {
    res.json({ status: 'Test Bot - Funcionando' });
});

app.listen(8080, () => {
    console.log("🔥 Bot de prueba iniciado");
});
