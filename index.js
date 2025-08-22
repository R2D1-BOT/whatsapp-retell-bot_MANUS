const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔑 Claves (ponlas en variables de entorno en Render)
const EVO_API_KEY = process.env.EVO_API_KEY; // Evolution API
const RETELL_API_KEY = process.env.RETELL_API_KEY; // Retell AI
const EVO_INSTANCE = process.env.EVO_INSTANCE; // ID de instancia Evolution

// 📌 Webhook de Evolution API (WhatsApp)
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body;
    const from = message.key.remoteJid;
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

    console.log(`[${from}] dice: "${text}"`);

    // 👉 Solo crear sesión si llega un mensaje de texto
    if (text) {
      console.log(`🚀 Creando nueva sesión en Retell para ${from}`);

      const response = await axios.post(
        "https://api.retellai.com/v2/sessions", // endpoint correcto
        {
          agent_id: "agent_0452f6bca77b7fd955d6316299", // ⚡️ tu Agent ID real
          metadata: { user: from }
        },
        {
          headers: {
            "Authorization": `Bearer ${RETELL_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("✅ Sesión creada en Retell:", response.data);

      // Enviar mensaje a WhatsApp confirmando
      await axios.post(
        `https://api.evoapicloud.com/message/sendText/${EVO_INSTANCE}`,
        {
          number: from.replace("@s.whatsapp.net", ""),
          text: "Tu sesión con ClaraBot ha sido creada 🚀"
        },
        {
          headers: {
            "apikey": EVO_API_KEY,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("!!! ERROR en el webhook [/webhook]:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// 🚀 Arranque
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});


