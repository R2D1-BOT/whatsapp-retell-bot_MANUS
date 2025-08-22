const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Bot is alive!' });
});

app.post('/webhook', async (req, res) => {
    try {
        const senderNumber = req.body.data.key.remoteJid;
        const messageText = req.body.data.message.conversation || '';

        console.log(`[${senderNumber}] dice: "${messageText}"`);

        // Enviar mensaje de vuelta
        await axios.post(
            `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
            {
                number: senderNumber,
                text: `Recibido: ${messageText}`
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EVOLUTION_API_KEY
                }
            }
        );

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(200).json({ error: 'Error' });
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR INICIADO`);
    console.log(`✅ Servidor escuchando en el puerto ${PORT}`);
});
