// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔑 Variables de entorno necesarias
const EVO_API_URL = process.env.EVO_API_URL;       // ej: https://api.evoapicloud.com
const EVO_API_KEY = process.env.EVO_API_KEY;       // tu key de Evolution
const RETELL_API_URL = process.env.RETELL_API_URL; // ej: https://api.retellai.com
const RETELL_API_KEY = process.env.RETELL_API_KEY; // tu key de Retell

// 🚀 Función: enviar mensaje a Retell
async function enviarARetell(mensaje) {
  try {
    const response = await axios.post(
      `${RETELL_API_URL}/v1/chat/completions`,
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un bot conectado a WhatsApp." },
          { role: "user", content: mensaje }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("❌ Error enviando mensaje a Retell:", error.response?.data || error.message);
    return null;
  }
}

// 🚀 Función: enviar respuesta a WhatsApp via Evolution API
async function enviarAWhatsApp(numero, mensaje) {
  try {
    await axios.post(
      `${EVO_API_URL}/message/sendText/${process.env.EVO_INSTANCE_ID}`,
      {
        number: numero,
        text: mensaje
      },
      {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(`📩 Respuesta enviada a ${numero}: ${mensaje}`);
  } catch (error) {
    console.error("❌ Error enviando mensaje a WhatsApp:", error.response?.data || error.message);
  }
}

// 🚀 Webhook: recibe mensajes de Evolution y los reenvía a Retell
app.post("/webhook", async (req, res) => {
  try {
    const { from, body } = req.body;

    console.log(`[${from}] dice: "${body}"`);

    if (!body) {
      console.log("⚠️ Mensaje vacío, no se procesa");
      return res.sendStatus(200);
    }

    // Enviar mensaje a Retell
    const respuesta = await enviarARetell(body);

    if (respuesta) {
      await enviarAWhatsApp(from, respuesta);
    }
  } catch (error) {
    console.error("❌ Error en webhook:", error.message);
  }

  res.sendStatus(200);
});

// 🚀 Arranque
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});










