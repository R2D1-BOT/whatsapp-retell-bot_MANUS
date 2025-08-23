const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_API_KEY = process.env.RETELL_API_KEY;

// Almacena sesiones activas con chat_id
const chatSessions = {};

// ==================== ENDPOINT PRIMERA CUSTOM FUNCTION ====================
app.post('/get-chat-id', async (req, res) => {
    try {
        const userIdentifier = req.body.args?.userIdentifier; // Retell puede enviar algo único del usuario

        if (!userIdentifier) {
            return res.status(400).json({ error: 'Falta userIdentifier en args' });
        }

        // Verificar si ya existe chat_id
        let chatId = chatSessions[userIdentifier];
        if (!chatId) {
            // Crear chat en Retell AI
            const response = await axios.post(
                'https://api.retellai.com/create-chat',
                { agent_id: RETELL_AGENT_ID },
                { headers: { 
                    'Authorization': `Bearer ${RETELL_API_KEY}`, 
                    'Content-Type': 'application/json' 
                }}
            );

            chatId = response.data.chat_id;
            chatSessions[userIdentifier] = chatId;
        }

        return res.status(200).json({
            status: 'success',
            chat_id: chatId
        });

    } catch (error) {
        console.error('Error en get-chat-id:', error.response?.data || error.message);
        return res.status(500).json({
            status: 'error',
            message: error.response?.data || error.message
        });
    }
});

// ==================== HEALTHCHECK ====================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        sessions: Object.keys(chatSessions).length,
        timestamp: new Date().toISOString()
    });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});




