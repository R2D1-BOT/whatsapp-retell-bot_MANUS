// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ✅ Variables de entorno
const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVOLUTION_API_KEY;
const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// 🚀 Debug de variables al iniciar
console.log("====================================");
console.log("🚀 Servidor iniciando con config:");
console.log("PORT:", PORT);
console.log("EVO_API_KEY:", EVO_API_KEY ? "✅ Cargada" : "❌ MISSING");
console.log("EVO_URL:", EVO_URL);
console.log("EVO_INSTANCE:", EVO_INSTANCE);
console.log("RETELL_API_KEY:", RETELL_API_KEY ? "✅ Cargada" : "❌ MISSING");
console.log("RETELL_AGENT_ID:", RETELL_AGENT_ID);
console.log("====================================");

// ✅ Endpoint raíz (para Railway healthcheck)
app.get("/", (req, res) => {
  res.status(200).send("✅ WhatsApp-Retell Bot corriendo");
});

// ✅ Endpoint de health check manual
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

// ✅ Webhook de mensajes entrantes desde Evolution API
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    console.log("📩 Mensaje entrante:", JSON.stringify(data, null, 2));

    const from = data?.data?.key?.remoteJid;
    const text = data?.data?.message?.conversation;

    if (!from || !text) {
      return res.status(400).send("❌ Payload inválido");
    }

    // 🔗 Mandar mensaje a Retell AI
    const retellResp = await axios.post(
      "https://api.retellai.com/v2/messages",
      {
        agent_id: RETELL_AGENT_ID,
        message: text,
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = retellResp.data?.reply || "⚠️ No hay respuesta del agente";

    console.log("🤖 Respuesta Retell:", reply);

    // 🔗 Enviar respuesta a Evolution API
    const evoUrl = `${EVO_URL}/message/sendText/${EVO_INSTANCE}`;
    console.log("➡️ Enviando a Evolution:", evoUrl);

    await axios.post(
      evoUrl,
      {
        number: from.split("@")[0], // limpiar el número
        textMessage: { text: reply },
      },
      {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).send("✅ Mensaje procesado");
  } catch (err) {
    console.error("❌ Error en webhook:", err.message);
    res.status(500).send("❌ Error interno");
  }
});

// 🚀 Arrancar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});

