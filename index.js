const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================================
// 🔎 DEBUG de variables de entorno
// ================================
console.log(">>> ENV CHECK <<<");
console.log("EVO_API_KEY:", process.env.EVO_API_KEY ? "[OK]" : "[MISSING]");
console.log("RETELL_API_KEY:", process.env.RETELL_API_KEY ? "[OK]" : "[MISSING]");
console.log("RETELL_API_URL:", process.env.RETELL_API_URL || "NOT SET");
console.log("PORT:", process.env.PORT || "8080");

// ================================
// Variables principales
// ================================
const EVO_API_KEY = process.env.EVO_API_KEY;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_API_URL = process.env.RETELL_API_URL || "https://api.retellai.com";

const PORT = process.env.PORT || 8080;

// ================================
// Endpoint test
// ================================
app.get("/", (req, res) => {
  res.send("🚀 WhatsApp <-> Retell API Bot activo");
});

// ================================
// Función envío a Retell
// ================================
async function sendToRetell(sessionId, text) {
  try {
    console.log(`➡️ Enviando a Retell (${RETELL_API_URL}) → ${text}`);
    const response = await axios.post(
      `${RETELL_API_URL}/v1/message`,
      {
        session_id: sessionId,
        message: text,
      },
      {
        headers: {
          Authorization: `Bearer ${RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Respuesta de Retell:", response.data);
    return response.data;
  } catch (err) {
    console.error("❌ Error enviando mensaje a Retell:", err.message);
    return null;
  }
}

// ================================
// Simulación recepción mensaje (demo)
// ================================
app.post("/webhook", async (req, res) => {
  const { from, text } = req.body;

  console.log(`[${from}] dice: "${text}"`);

  const retellResponse = await sendToRetell(from, text);

  res.json({
    status: "ok",
    echo: text,
    retell: retellResponse,
  });
});

// ================================
// Servidor
// ================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});











