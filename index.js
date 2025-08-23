/console.log('PORT:', process.env.PORT);
console.log('EVO_API_KEY:', process.env.EVOLUTION_API_KEY ? 'OK' : 'MISSING');
console.log('EVO_URL:', process.env.EVOLUTION_API_URL);
console.log('EVO_INSTANCE:', process.env.EVOLUTION_INSTANCE);
console.log('RETELL_AGENT_ID:', process.env.RETELL_AGENT_ID);
console.log('RETELL_API_KEY:', process.env.RETELL_API_KEY ? 'OK' : 'MISSING');
/ index.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔹 Variables de entorno
const PORT = process.env.PORT || 8080;

const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;

const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_API_KEY = process.env.RETELL_API_KEY;

// 🔹 Healthcheck básico
app.get('/health', (req, res) => res.send('OK'));

// 🔹 Endpoint para recibir mensajes de WhatsApp (simulado)
app.post('/webhook', async (req, res) => {
    try {
        const { number, message } = req.body;

        // Construir URL EvoAPI correctamente
        const evoUrl = `${EVO_URL}/message/sendText/${EVO_INSTANCE}`;

        const response = await axios.post(evoUrl, {
            number,
            message
        }, {
            headers: { 'Authorization': `Bearer ${EVO_API_KEY}` }
        });

        res.json({ status: 'success', data: response.data });
    } catch (err) {
        console.error('Error webhook:', err.response?.data || err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 🔹 Arrancar servidor
app.listen(PORT, () => {
    console.log(`🚀 Bot corriendo en puerto ${PORT}`);
});


