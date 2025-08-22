const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔑 Variables de entorno
const EVO_URL = process.env.EVO_URL;
const EVO_ID = process.env.EVO_ID;
const EVO_API_KEY = process.env.EVO_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_API_KEY = process.env.RETELL_API_KEY;

// Sesiones por número de WhatsApp
const sessions = {};

app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body;
    const from = msg?.data?.key?.remoteJid; // número en WhatsApp
    const text = msg?.data?.message?.conversation || msg?.data?.message?.extendedTextMessage?.text;

    console.log(`[${from}] dice: "${text}"`);

    if (!from || !text) return res.sendStatus(200);

    // Si no hay sesión activa, creamos nueva
    if (!sessions[from] || sessions[from].ended) {
      console.log(`🚀 Creando nueva sesión en Retell para ${from}`);

      const chat = await axios.post(
        "https://api.retellai.com/v2/createChat",
        { agent_id: RETELL_AGENT_ID },
        { headers: { Authorization: `Bearer ${RETELL_API_KEY}` } }
      );

      sessions[from] = {
        chatId: chat.data.chat_id,
        ended: false,
      };
    }

    const chatId = sessions[from].chatId;

    // Enviar mensaje a Retell
 const response = await axios.post(
  "https://api.retellai.com/v2/chat/completions",
  {
    agent_id: process.env.RETELL_AGENT_ID,
    messages: [{ role: "user", content: message }],
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
      "Content-Type": "application/json"
    },
  }
);
  {
    headers: {
      Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
      "Content-Type": "application/json"
    },
  }
);


    const reply = response.data.reply || "🤖 (sin respuesta de Retell)";
    console.log(`🤖 Retell responde: "${reply}"`);

    // Enviar respuesta por Evolution
    await axios.post(
      `${EVO_URL}/message/sendText/${EVO_ID}`,
      {
        number: from.replace("@s.whatsapp.net", ""),
        textMessage: { text: reply },
      },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: EVO_API_KEY,
        },
      }
    );

  } catch (error) {
    console.error("!!! ERROR en el webhook [/webhook]:", error.response?.data || error.message);

    // 🔄 Manejo: si Retell devuelve "Chat already ended", reseteamos la sesión
    if (error.response?.data?.message === "Chat already ended") {
      const from = req.body?.data?.key?.remoteJid;
      if (from) {
        sessions[from].ended = true;
        console.log(`⚠️ Sesión cerrada para ${from}, se creará nueva en el próximo mensaje`);
      }
    }
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});


