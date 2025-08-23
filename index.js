const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

// 🗂️ Aquí vamos a guardar temporalmente los chat_id asociados a cada usuario
// clave = userIdentifier (lo que te pase Retell), valor = chatId de Evolution
const sessions = {};

// 📩 Endpoint para recibir webhooks de EvolutionAPI y guardar chat_id
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    // ⚡ Extrae el chatId y el número de usuario
    const chatId = data?.key?.remoteJid;
    const userIdentifier = data?.messages?.[0]?.key?.participant || data?.messages?.[0]?.key?.fromMe;

    if (chatId && userIdentifier) {
      sessions[userIdentifier] = chatId;
      console.log("✅ Guardado en sesiones:", userIdentifier, "->", chatId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    res.sendStatus(500);
  }
});

// 📌 Endpoint GET que usa Retell como Custom Function para obtener el chat_id
app.get("/get-chat-id", async (req, res) => {
  try {
    const { userIdentifier } = req.query;

    if (!userIdentifier) {
      return res.status(400).json({ status: "error", message: "Falta userIdentifier" });
    }

    const chatId = sessions[userIdentifier];

    if (!chatId) {
      return res.status(404).json({ status: "error", message: "No se encontró chat_id para ese userIdentifier" });
    }

    return res.json({
      status: "success",
      chat_id: chatId,
    });
  } catch (error) {
    console.error("❌ Error en /get-chat-id:", error);
    return res.status(500).json({ status: "error", message: "Error interno del servidor" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});




