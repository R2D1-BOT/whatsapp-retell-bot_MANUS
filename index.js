// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔑 Variables de entorno
const EVO_API_KEY = process.env.EVO_API_KEY;   // API Evolution
const RETELL_API_KEY = process.env.RETELL_API_KEY; // API Retell
const AGENT_ID = process.env.AGENT_ID; // ID del agente Retell

// ✅ Endpoint principal
app.get("/", (req, res) => {
  res.send("✅ Bot WhatsApp ↔ Retell funcionando");
});

// ✅ Webhook de Evolution API
app.post("/webhook", async (req, res) => {
  try {
    const payload = req.body;

    if (!payload?.data?.message?.conversation) {
      console.warn("⚠️ Mensaje entrante sin conversación:", JSON.stringify(payload));
      return res.sendStatus(200);
    }

    const from = payload.data.key.remoteJid;
    const text = payload.data.message.conversation;

    console.log(`[${from}] dice: "${text}"`);

    // 1️⃣ Mandamos mensaje a Retell
    const retellResp = await axios.post(
      "https://api.retellai.com/v2/chat/completions",
      {
        agent_id: AGENT_ID,
        messages: [{ role: "user", content: text }],
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const botReply = retellResp.data?.output_text || "⚠️ No tengo respuesta del agente";
    console.log(`🤖 Retell responde: "${botReply}"`);

    // 2️⃣ Enviamos respuesta al usuario por Evolution API
    await axios.post(
      `${payload.server_url}/message/sendText/${payload.instance}`,
      {
        number: from,
        text: botReply,
      },
      {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Respuesta enviada a WhatsApp (${from})`);
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ ERROR en /webhook:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});








