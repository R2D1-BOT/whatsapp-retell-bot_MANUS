const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.post("/webhook", async (req, res) => {
  try {
    const { from, message } = req.body;

    console.log(`[${from}] dice: "${message}"`);

    const retellResponse = await axios.post(
      `${process.env.RETELL_API_URL}/v2/agent/${process.env.RETELL_AGENT_ID}/message`,
      {
        message: message,
        user: from,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Respuesta Retell:", retellResponse.data);
    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error enviando mensaje a Retell:", error.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});










