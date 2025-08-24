// index.js
const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Variables de entorno necesarias
const EVO_API_KEY = process.env.EVO_API_KEY;
const EVO_INSTANCE = process.env.EVO_INSTANCE; // ejemplo: f45cf2e8-1808-4379-a61c-88acd8e0625f
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID; // ejemplo: agent_0452f6bca77b7fd955d6316299

// ✅ Webhook que recibe mensajes de Evolution API
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    console.log("📩 Webhook recibido:", JSON.stringify(body, null, 2));

    // Validar que sea un evento de mensaje entrante
    if (body.event === "messages.upsert" && body.data) {
      const remoteJid = body.data.key?.remoteJid;
      const mensaje =
        body.data.message?.conversation ||
        body.data.message?.extendedTextMessage?.text;

      if (!remoteJid || !mensaje) {
        console.warn("⚠️ Payload sin remoteJid o mensaje válido");
        return res.sendStatus(200);
      }

      console.log(`[${remoteJid}] dice: "${mensaje}"`);

      // 🚀 Crear nueva sesión en Retell
      const retellResp = await fetch("https://api.retellai.com/v2/create-chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agent_id: RETELL_AGENT_ID,
          metadata: { remoteJid, mensaje }
        })
      });

      const dataRetell = await retellResp.json();
      console.log("✅ Respuesta Retell:", dataRetell);

      // 🔥 (Opcional) Responder a WhatsApp con un mensaje de confirmación
      await fetch(
        `https://api.evoapicloud.com/message/sendText/${EVO_INSTANCE}`,
        {
          method: "POST",
          headers: {
            apikey: EVO_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            number: remoteJid.replace("@s.whatsapp.net", ""),
            text: "✅ Tu mensaje ha sido recibido, estamos procesando con ClaraBot."
          })
        }
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("!!! ERROR en el webhook [/webhook]:", err);
    res.sendStatus(500);
  }
});

// ✅ Arranque del servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor escuchando en puerto ${PORT}`);
});







