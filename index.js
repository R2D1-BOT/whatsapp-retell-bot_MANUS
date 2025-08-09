const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ✅ USAR VARIABLES DE ENTORNO CORRECTAS (las que tienes en Railway)
const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVO_TOKEN; // ✅ La que tienes en Railway
const RETELL_API_KEY = process.env.RETELL_API_KEY; // ✅ 
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID; // ✅

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

        // ✅ VERIFICAR VARIABLES
        if (!RETELL_API_KEY || !RETELL_AGENT_ID || !EVO_API_KEY) {
            console.error("❌ ERROR: Faltan variables de entorno");
            console.error("- RETELL_API_KEY:", !!RETELL_API_KEY);
            console.error("- RETELL_AGENT_ID:", !!RETELL_AGENT_ID); 
            console.error("- EVO_API_KEY:", !!EVO_API_KEY);
            return res.status(500).send("Error de configuración");
        }

        console.log("✅ Todas las variables presentes");

        // ============================================
        // 🔥 PASO 1: CREAR SESIÓN DE CHAT (SI NO EXISTE)
        // ============================================
        let chatId = chatSessions[senderNumber];
        
        if (!chatId) {
            console.log(`🚀 Creando nueva sesión para ${senderNumber}...`);
            
            const createChatResponse = await axios.post(
                'https://api.retellai.com/v2/create-chat', // ✅ CON /v2
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

