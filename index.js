// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Configuración
const PORT = process.env.PORT || 8080;
const EVO_API_KEY = process.env.EVO_API_KEY || "tu_clave";
const EVO_INSTANCE = process.env.EVO_INSTANCE || "f45cf2e8-1808-4379-a61c-88acd8e0625f";
const EVO_URL = process.env.EVO_URL || "https://api.evoapicloud.com";

// Webhook para recibir mensajes de WhatsApp
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    console.log("📩 Webhook recibido:", JSON.stringify(data, null, 2));

    // Verificar si hay mensaje de conversación
    const message = data?.data?.message?.conversation;
    const number = data?.data?.key?.remoteJid;

    if (message && number) {
      // Enviar mensaje a Evolution
      await sendToEvolution(message, number);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error en /webhook:", err.message || err);
    res.status(500).send("Error");
  }
});

// Función para enviar mensaje a Evolution API
async function sendToEvolution(message, number) {
  try {
    const response = await axios.post(
      `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
      {
        number: number,
        text: message,
      },
      {
        headers: {
          Authorization: `Bearer ${EVO_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Mensaje enviado a Evolution:", response.data);
  } catch (err) {
    console.error("❌ Error enviando mensaje a Evolution:", err.response?.data || err.message);
  }
}

// Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});










