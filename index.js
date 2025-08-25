// index.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Variables de entorno
const EVO_API_KEY = process.env.EVO_API_KEY; // tu API key de Evolution
const EVO_URL = process.env.EVOLUTION_API_URL; // https://api.evoapicloud.com
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE; // ID de tu instancia
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID; // agent_...
const RETELL_API_KEY = process.env.RETELL_API_KEY; // key_...

// Función para enviar mensaje a Evolution/Retell
async function sendMessageToRetell(sender, message) {
    try {
        const response = await axios.post(
            `${EVO_URL}/v1/agents/${RETELL_AGENT_ID}/create-chat`,
            {
                user_id: sender,
                message: message
            },
            {
                headers: {
                    'Authorization': `Bearer ${RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('✅ Mensaje enviado a Retell:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Error enviando mensaje a Evolution:', error.response ? error.response.data : error.message);
    }
}

// Endpoint principal para recibir mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
    const payload = req.body;
    console.log('📩 Webhook recibido:', JSON.stringify(payload));

    try {
        const messageData = payload.data;
        if (!messageData || !messageData.key) {
            console.warn('⚠️ Mensaje entrante inválido:', payload);
            return res.sendStatus(400);
        }

        const sender = messageData.key.remoteJid;
        const message = messageData.message.conversation;

        if (sender && message) {
            await sendMessageToRetell(sender, message);
            res.sendStatus(200);
        } else {
            console.warn('⚠️ No se pudo extraer sender o message:', messageData);
            res.sendStatus(400);
        }
    } catch (err) {
        console.error('❌ Error en /webhook:', err);
        res.sendStatus(500);
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});










