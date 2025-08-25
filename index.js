// index.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVO_API_KEY; // tu token correcto
const EVO_URL = process.env.EVOLUTION_API_URL; // https://api.evoapicloud.com
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID; // agent_0452f6bca77b7fd955d6316299

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    if (!data?.data?.key?.remoteJid || !data?.data?.message?.conversation) {
      console.log('⚠️ Mensaje entrante inválido:', JSON.stringify(data));
      return res.status(400).send('Mensaje inválido');
    }

    const from = data.data.key.remoteJid;
    const message = data.data.message.conversation;

    console.log(`[${from}] dice: "${message}"`);

    // Enviar mensaje a Retell / Evolution
    const response = await axios.post(
      `${EVO_URL}/v1/agents/${RETELL_AGENT_ID}/create-chat`,
      {
        message: message,
        user: from
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVO_API_KEY
        }
      }
    );

    console.log('✅ Mensaje enviado a Evolution:', response.data);
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error enviando mensaje a Evolution:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});










