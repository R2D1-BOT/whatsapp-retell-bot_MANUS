// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || "MISSING";
const EVO_URL = process.env.EVOLUTION_API_URL || "MISSING";
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || "MISSING";
const RETELL_API_KEY = process.env.RETELL_API_KEY || "MISSING";
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID || "MISSING";

const MENU_PDF_URL = "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";

// Debug seguro: muestra si están cargadas
console.log("🚀 Servidor iniciando:");
console.log("PORT:", PORT);
console.log("EVO_API_KEY:", EVO_API_KEY !== "MISSING");
console.log("EVO_URL:", EVO_URL !== "MISSING");
console.log("EVO_INSTANCE:", EVO_INSTANCE !== "MISSING");
console.log("RETELL_API_KEY:", RETELL_API_KEY !== "MISSING");
console.log("RETELL_AGENT_ID:", RETELL_AGENT_ID !== "MISSING");

// Endpoint raíz para Railway
app.get("/", (req, res) => res.status(200).send("✅ Bot corriendo"));

// Healthcheck interno
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

// Webhook principal
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    const from = data?.data?.key?.remoteJid;
    const text = data?.data?.message?.conversation;
    if (!from || !text) return res.status(400).send("❌ Payload inválido");

    // Enviar a Retell AI
    const retellResp = await axios.post(
      "https://api.retellai.com/v2/messages",
      { agent_id: RETELL_AGENT_ID, message: text },
      { headers: { Authorization: `Bearer ${RETELL_API_KEY}`, "Content-Type": "application/json" } }
    );

    const reply = retellResp.data?.reply || "⚠️ Sin respuesta";

    // Enviar respuesta a Evolution
    await axios.post(
      `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
      { number: from.split("@")[0], textMessage: { text: reply } },
      { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
    );

    res.status(200).send("✅ Mensaje procesado");
  } catch (err) {
    console.error("❌ Error webhook:", err.message);
    res.status(500).send("❌ Error interno");
  }
});

// Custom Function Retell para enviar PDF
app.post("/retell-function/send-menu", async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: "Número requerido" });

    await axios.post(
      `${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`,
      {
        number,
        mediatype: "document",
        mimetype: "application/pdf",
        url: MENU_PDF_URL,
        caption: "📋 Aquí tienes el menú"
      },
      { headers: { apikey: EVO_API_KEY } }
    );

    res.json({ success: true, message: "PDF enviado" });
  } catch (err) {
    console.error("❌ Error enviando PDF:", err.message);
    res.status(500).json({ error: "Fallo al enviar PDF" });
  }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`✅ Servidor escuchando en puerto ${PORT}`));


