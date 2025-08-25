// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ------------------ VARIABLES ------------------
const EVO_API_KEY = "bd8e2dda-5ddd-424a-978c-476b562da116";
const EVOLUTION_API_URL = "https://api.evoapicloud.com";
const EVOLUTION_INSTANCE = "f45cf2e8-1808-4379-a61c-88acd8e0625f";
const PORT = process.env.PORT || 8080;

const RETELL_AGENT_ID = "agent_0452f6bca77b7fd955d6316299";
const RETELL_API_KEY = "key_98bff79098c79f41ea2c02327ed2";
const RETELL_URL = `https://api.retell.ai/v1/agents/${RETELL_AGENT_ID}/create-chat`;

// ------------------ FUNCIONES ------------------
async function sendMessageToRetell(message) {
  try {
    const response = await axios.post(
      RETELL_URL,
      { prompt: message },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );
    return response.data;
  } catch (err) {
    console.error("❌ Error enviando mensaje a Retell:", err.response ? err.response.data : err.message);
    return null;
  }
}

// Endpoint para recibir webhooks de EvoAPI
app.post("/webhook", async (req, res) => {
  const payload = req.body;

  if (!payload?.data?.message) {
    console.log("⚠️ Mensaje entrante inválido:", payload);
    return res.sendStatus(400);
  }

  const messageText = payload.data.message.conversation;
  const sender = payload.data.key.remoteJid;

  console.log(`[${sender}] dice: "${messageText}"`);

  // Reenviar a Retell
  const retellResponse = await sendMessageToRetell(messageText);
  if (retellResponse) {
    console.log("✅ Retell respondió:", retellResponse);
  }

  res.sendStatus(200);
});

// ------------------ SERVIDOR ------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});











