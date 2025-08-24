// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔑 Configuración
const RETELL_API_KEY = process.env.RETELL_API_KEY; // tu API Key de Retell
const AGENT_ID = process.env.RETELL_AGENT_ID; // ej. "agent_0452f6bca77b7fd955d6316299"
const EVO_API_KEY = process.env.EVO_API_KEY; // API Key EvolutionAPI
const EVO_INSTANCE = process.env.EVO_INSTANCE; // ej. f45cf2e8-1808-4379-a61c-88acd8e0625f
const EVO_URL = "https://api.evoapicloud.com";

// =========================
// Endpoint de Webhook
// =========================
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.event !== "messages.upsert") {
      console.log("⚠️ Evento no procesado:", body.event);
      return res.sendStatus(200);
    }

    const data = body.data || {};
    const remoteJid = data.key?.remoteJid; // remitente real
    const pushName = data.pushName || "Usuario";
    const text = data.message?.conversation;

    if (!remoteJid || !text) {
      console.log("⚠️ Payload incompleto:", JSON.stringify(body, null, 2));
      return res.sendStatus(200);
    }

    console.log(`[${remoteJid}] ${pushName} dice: "${text}"`);

    // 1️⃣ Crear sesión en Retell
    const sessionResp = await axios.post(
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

    const reply =
      sessionResp.data?.choices?.[0]?.message?.content || "Lo siento, no tengo respuesta.";

    console.log(`🤖 Respuesta de Retell: ${reply}`);

    // 2️⃣ Enviar respuesta a WhatsApp por EvolutionAPI
    await axios.post(
      `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
      {
        number: remoteJid.replace("@s.whatsapp.net", ""),
        text: reply,
      },
      {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Respuesta enviada a ${remoteJid}`);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ ERROR en el webhook [/webhook]:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// =========================
// Start server
// =========================
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});







