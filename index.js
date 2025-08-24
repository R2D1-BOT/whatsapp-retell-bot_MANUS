const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ✅ Variables de entorno
const EVO_API_KEY = process.env.EVO_API_KEY;
const EVO_ID = process.env.EVO_ID;
const EVO_URL = process.env.EVO_URL;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_API_KEY = process.env.RETELL_API_KEY;

// 🟢 Webhook de EvolutionAPI (entrada de mensajes de WhatsApp)
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    const from = data.key?.remoteJid; // 📌 <- aquí estaba petando si no venía definido
    const text = data.message?.conversation;

    if (!from || !text) {
      console.log("⚠️ Mensaje entrante inválido:", JSON.stringify(data));
      return res.sendStatus(200);
    }

    console.log(`[${from}] dice: "${text}"`);

    // 🚀 Crear sesión en Retell
    console.log(`🚀 Creando nueva sesión en Retell para ${from}`);

    const retellResp = await fetch("https://api.retellai.com/v2/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: RETELL_AGENT_ID,
        user_id: from,
        message: text,
      }),
    });

    if (!retellResp.ok) {
      const errText = await retellResp.text();
      console.error("❌ Error creando chat en Retell:", errText);
      return res.sendStatus(500);
    }

    const retellData = await retellResp.json();
    const reply = retellData.reply || "⚠️ El bot no respondió.";

    // 📤 Responder por EvolutionAPI (WhatsApp)
    await fetch(`${EVO_URL}/message/sendText/${EVO_ID}`, {
      method: "POST",
      headers: {
        apikey: EVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: from,
        text: reply,
      }),
    });

    console.log(`✅ Respondido a ${from}: "${reply}"`);
    res.sendStatus(200);
  } catch (err) {
    console.error("!!! ERROR en el webhook [/webhook]:", err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});







