const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ===== ENV =====
const PORT = process.env.PORT || 8080;

// Evolution (WhatsApp)
const EVO_API_URL      = process.env.EVO_API_URL;
const EVO_API_KEY      = process.env.EVO_API_KEY;
const EVO_INSTANCE_ID  = process.env.EVO_INSTANCE_ID;

// Retell AI
const RETELL_API_URL   = process.env.RETELL_API_URL || "https://api.retellai.com";
const RETELL_API_KEY   = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID  = process.env.RETELL_AGENT_ID; // Nuevo: ID del agente

// Activos
const PDF_MENU_URL     = process.env.PDF_MENU_URL || "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";
const PDF_FILENAME     = process.env.PDF_FILENAME || "Carta_La_Rustica.pdf";

// ===== Utilidades =====
function logEnv() {
  console.log("🌍 EVO_API_URL:", EVO_API_URL);
  console.log("🔧 EVO_INSTANCE_ID:", EVO_INSTANCE_ID ? "OK" : "FALTA");
  console.log("🔑 EVO_API_KEY:", EVO_API_KEY ? "OK" : "FALTA");
  console.log("🌍 RETELL_API_URL:", RETELL_API_URL);
  console.log("🔑 RETELL_API_KEY:", RETELL_API_KEY ? "OK" : "FALTA");
  console.log("🤖 RETELL_AGENT_ID:", RETELL_AGENT_ID ? "OK" : "FALTA");
  console.log("📄 PDF_MENU_URL:", PDF_MENU_URL);
}

function pickTextFromEvolution(body) {
  try {
    if (body?.from && body?.body) {
      return { from: body.from, text: body.body };
    }
    if (body?.event === "messages.upsert" && body?.data) {
      const from = body.data.key?.remoteJid || body.sender || body.data?.from;
      let text = null;

      if (body.data.message?.conversation) text = body.data.message.conversation;

      if (!text && body.data.message?.extendedTextMessage?.text) {
        text = body.data.message.extendedTextMessage.text;
      }

      return { from, text };
    }
  } catch (_) {}
  return { from: undefined, text: undefined };
}

async function sendTextToWhatsApp(number, text) {
  if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE_ID) {
    throw new Error("Variables Evolution incompletas");
  }
  await axios.post(
    `${EVO_API_URL}/message/sendText/${EVO_INSTANCE_ID}`,
    { number, text },
    { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
  );
}

async function sendPdfToWhatsApp(number, caption) {
  if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE_ID) {
    throw new Error("Variables Evolution incompletas");
  }
  await axios.post(
    `${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE_ID}`,
    {
      number,
      media: { url: PDF_MENU_URL, mimetype: "application/pdf", filename: PDF_FILENAME },
      text: caption || "Aquí tienes la carta."
    },
    { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
  );
}

async function askRetell(userText) {
  if (!RETELL_API_KEY) throw new Error("Falta RETELL_API_KEY");
  
  try {
    // Crear un chat
    const createChatRes = await axios.post(
      `${RETELL_API_URL}/create-chat`,
      {
        agent_id: RETELL_AGENT_ID // Si necesitas especificar el agente
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json"
        },
        validateStatus: () => true
      }
    );

    if (createChatRes.status >= 400) {
      throw new Error(`Create Chat ${createChatRes.status}: ${JSON.stringify(createChatRes.data)}`);
    }

    const chatId = createChatRes.data.chat_id;
    
    // Crear completion
    const completionRes = await axios.post(
      `${RETELL_API_URL}/create-chat-completion`,
      {
        chat_id: chatId,
        content: userText
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json"
        },
        validateStatus: () => true
      }
    );

    if (completionRes.status >= 400) {
      throw new Error(`Chat Completion ${completionRes.status}: ${JSON.stringify(completionRes.data)}`);
    }

    return completionRes.data?.messages?.[0]?.content || "";
    
  } catch (error) {
    console.error("Error detallado Retell:", error.response?.data || error.message);
    throw error;
  }
}

app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ===== ENV =====
const PORT = process.env.PORT || 8080;

// Evolution (WhatsApp)
const EVO_API_URL      = process.env.EVO_API_URL;
const EVO_API_KEY      = process.env.EVO_API_KEY;
const EVO_INSTANCE_ID  = process.env.EVO_INSTANCE_ID;

// Retell AI
const RETELL_API_URL   = process.env.RETELL_API_URL || "https://api.retellai.com";
const RETELL_API_KEY   = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID  = process.env.RETELL_AGENT_ID; // Nuevo: ID del agente

// Activos
const PDF_MENU_URL     = process.env.PDF_MENU_URL || "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";
const PDF_FILENAME     = process.env.PDF_FILENAME || "Carta_La_Rustica.pdf";

// ===== Utilidades =====
function logEnv() {
  console.log("🌍 EVO_API_URL:", EVO_API_URL);
  console.log("🔧 EVO_INSTANCE_ID:", EVO_INSTANCE_ID ? "OK" : "FALTA");
  console.log("🔑 EVO_API_KEY:", EVO_API_KEY ? "OK" : "FALTA");
  console.log("🌍 RETELL_API_URL:", RETELL_API_URL);
  console.log("🔑 RETELL_API_KEY:", RETELL_API_KEY ? "OK" : "FALTA");
  console.log("🤖 RETELL_AGENT_ID:", RETELL_AGENT_ID ? "OK" : "FALTA");
  console.log("📄 PDF_MENU_URL:", PDF_MENU_URL);
}

function pickTextFromEvolution(body) {
  try {
    if (body?.from && body?.body) {
      return { from: body.from, text: body.body };
    }
    if (body?.event === "messages.upsert" && body?.data) {
      const from = body.data.key?.remoteJid || body.sender || body.data?.from;
      let text = null;

      if (body.data.message?.conversation) text = body.data.message.conversation;

      if (!text && body.data.message?.extendedTextMessage?.text) {
        text = body.data.message.extendedTextMessage.text;
      }

      return { from, text };
    }
  } catch (_) {}
  return { from: undefined, text: undefined };
}

async function sendTextToWhatsApp(number, text) {
  if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE_ID) {
    throw new Error("Variables Evolution incompletas");
  }
  await axios.post(
    `${EVO_API_URL}/message/sendText/${EVO_INSTANCE_ID}`,
    { number, text },
    { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
  );
}

async function sendPdfToWhatsApp(number, caption) {
  if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE_ID) {
    throw new Error("Variables Evolution incompletas");
  }
  await axios.post(
    `${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE_ID}`,
    {
      number,
      media: { url: PDF_MENU_URL, mimetype: "application/pdf", filename: PDF_FILENAME },
      text: caption || "Aquí tienes la carta."
    },
    { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
  );
}

async function askRetell(userText) {
  if (!RETELL_API_KEY) throw new Error("Falta RETELL_API_KEY");
  
  try {
    // Crear un chat
    const createChatRes = await axios.post(
      `${RETELL_API_URL}/create-chat`,
      {
        agent_id: RETELL_AGENT_ID // Si necesitas especificar el agente
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json"
        },
        validateStatus: () => true
      }
    );

    if (createChatRes.status >= 400) {
      throw new Error(`Create Chat ${createChatRes.status}: ${JSON.stringify(createChatRes.data)}`);
    }

    const chatId = createChatRes.data.chat_id;
    
    // Crear completion
    const completionRes = await axios.post(
      `${RETELL_API_URL}/create-chat-completion`,
      {
        chat_id: chatId,
        content: userText
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json"
        },
        validateStatus: () => true
      }
    );

    if (completionRes.status >= 400) {
      throw new Error(`Chat Completion ${completionRes.status}: ${JSON.stringify(completionRes.data)}`);
    }

    return completionRes.data?.messages?.[0]?.content || "";
    
  } catch (error) {
    console.error("Error detallado Retell:", error.response?.data || error.message);
    throw error;
  }
}

app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));

app.post("/webhook", async (req, res) => {
  try {
    const { from, text } = pickTextFromEvolution(req.body);
    console.log(`[${from}] dice: "${text}"`);

    if (!from || !text) {
      console.warn("⚠️ Mensaje vacío, no se procesa");
      return res.sendStatus(200);
    }

    const normalized = (text || "").toLowerCase();
    if (normalized.includes("carta") || normalized.includes("menú") || normalized.includes("menu")) {
      await sendPdfToWhatsApp(from, "Aquí tienes la carta. Dime qué te apetece.");
      return res.sendStatus(200);
    }

    let aiReply = "";
    try {
      aiReply = await askRetell(text);
    } catch (err) {
      console.error("❌ Error Retell:", err.message);
      aiReply = "Ahora mismo no puedo consultar el asistente. ¿Te ayudo con algo puntual?";
    }

    if (!aiReply || typeof aiReply !== "string") {
      aiReply = "¿Podrías repetirlo? No te he entendido bien.";
    }

    await sendTextToWhatsApp(from, aiReply);
  } catch (err) {
    console.error("❌ Error en /webhook:", err.response?.data || err.message);
  }
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  logEnv();
});
