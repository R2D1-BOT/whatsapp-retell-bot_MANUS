const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// KEYS HARDCODEADAS
const RETELL_API_KEY = 'key_45537c9b9dd8e7d97dae0c7a5e';
const RETELL_AGENT_ID = 'agent_f1ac3e5aff6ed5a42dd09a05bb';

app.post('/webhook', async (req, res) => {
    try {
        console.log('-> Webhook recibido!', JSON.stringify(req.body, null, 2));
        
     const message = req.body.data.message;        // NO req.body.data
const messageType = req.body.data.messageType; // NO message.messageType  
const from = req.body.data.key.remoteJid;      // NO key.remoteJid
        
        if (message?.messageType === 'conversation' && message?.conversation) {
            const from = data.key.remoteJid;  // Directamente data.key
            const text = message.conversation;
            
            console.log(`[${from}] dice: "${text}"`);
            
            console.log(`[${from}] Creando nueva sesión de chat...`);
            
            const chatResponse = await axios.post('https://api.retellai.com/create-chat', {
                agent_id: RETELL_AGENT_ID,
                metadata: {
                    whatsapp_number: from,
                    message: text
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Sesión creada exitosamente:', chatResponse.data);
        }
        
        res.status(200).json({ status: 'ok' });
        
    } catch (error) {
        console.log('!!! ERROR en el webhook:', error.response?.data || error.message);
        console.log('--- Detalles de la Petición Fallida ---');
        if (error.config) {
            console.log('URL:', error.config.method.toUpperCase(), error.config.url);
            console.log('Headers:', JSON.stringify(error.config.headers, null, 2));
            console.log('Data:', error.config.data);
        }
        console.log('------------------------------------');
        res.status(500).json({ error: 'Error interno' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor del bot iniciado y escuchando en el puerto ${PORT}`);
});
