// index.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// -------------------
// Configuración segura
// -------------------
const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_API_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_API_KEY = process.env.RETELL_API_KEY;

// -------------------
// Debug de variables
// -------------------
console.log('--- VARIABLES DE ENTORNO ---');
console.log('PORT:', PORT);
console.log('EVOLUTION_API_KEY:', EVO_API_KEY ? 'OK' : 'MISSING');
console.log('EVOLUTION_API_URL:', EVO_API_URL ? 'OK' : 'MISSING');
console.log('EVOLUTION_INSTANCE:', EVO_INSTANCE ? 'OK' : 'MISSING');
console.log('RETELL_AGENT_ID:', RETELL_AGENT_ID ? 'OK' : 'MISSING');
console.log('RETELL_API_KEY:', RETELL_API_KEY ? 'OK' : 'MISSING');
console.log('----------------------------');

// -------------------
// Función para enviar mensaje
// -------------------
async function sendTextToEvo(number, text) {
    if (!EVO_API_URL || !EVO_INSTANCE || !EVO_API_KEY) {
        console.error('❌ ERROR: EVOLUTION variables faltantes');
        return { status: 'error', message: 'EVOLUTION variables missing' };
    }

    const url = `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`;

    try {
        const res = await axios.post(url, {
            number,
            text
        }, {
            headers: {
                'Authorization': `Bearer ${EVO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return res.data;
    } catch (err) {
        console.error('❌ Error webhook:', err.response ? err.response.data : err.message);
        return { status: 'error', message: err.message };
    }
}

// -------------------
// Endpoints de prueba
// -------------------
app.get('/health', (req, res) => {
    res.send({ status: 'ok' });
});

app.post('/send', async (req, res) => {
    const { number, text } = req.body;
    if (!number || !text) {
        return res.status(400).send({ status: 'error', message: 'Missing number or text' });
    }
    const result = await sendTextToEvo(number, text);
    res.send(result);
});

// -------------------
// Arrancar servidor
// -------------------
app.listen(PORT, () => {
    console.log(`🚀 Bot corriendo en puerto ${PORT}`);
});



