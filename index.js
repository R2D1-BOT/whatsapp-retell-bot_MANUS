const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

let lastRecipient = null; // 👉 Guardamos el último remoteJid aquí

// Healthcheck
app.get("/health", (req, res) => {
  res.send("✅ OK");
});

// Webhook de Evolution
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    console.log("📩 Webhook recibido:", JSON.stringify(data, null, 2));

    // Extraer número remoto (chat activo)
    if (data.key && data.key.remoteJid) {
      lastRecipient = data.key.remoteJid;
      console.log("👉 Último destinatario actualizado:", lastRecipient);
    }

    // Aquí tu lógica normal del bot...
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook:", err.message);
    res.sendStatus(500);
  }
});

// Endpoint para enviar PDF al último chat activo
app.post("/send-pdf", async (req, res) => {
  try {
    const { pdf_url } = req.body;

    if (!lastRecipient) {
      return res.status(400).json({ ok: false, error: "No hay destinatario activo" });
    }

    console.log(`📄 Enviando PDF a ${lastRecipient}...`);

    const evoRes = await axios.post(
      `${process.env.EVOLUTION_API_URL}/message/sendMedia/${process.env.EVOLUTION_INSTANCE}`,
      {
        number: lastRecipient, // 👈 se reutiliza el chat activo
        mediatype: "document",
        mimetype: "application/pdf",
        caption: "Aquí tienes la carta 📑",
        file: pdf_url
      },
      {
        headers: {
          apikey: process.env.EVO_API_KEY
        }
      }
    );

    console.log("✅ PDF enviado:", evoRes.data);
    res.json({ ok: true, data: evoRes.data });

  } catch (err) {
    console.error("❌ Error enviando PDF:", err.response?.data || err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});






