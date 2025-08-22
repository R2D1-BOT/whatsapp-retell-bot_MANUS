const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const EVOLUTION_API_KEY = process.env.EVO_API_KEY;

app.post('/send-menu', async (req, res) => {
  try {
    const { user_number } = req.body;

    if (!user_number) return res.status(400).json({ success: false, message: "Falta user_number" });

    const evoPayload = {
      number: user_number,
      mediatype: "document",
      mimetype: "application/pdf",
      url: "https://ruta-a-tu-pdf.com/menu.pdf",
      caption: "¡Aquí tienes nuestro menú!"
    };

    await axios.post(
      "https://api.evoapicloud.com/message/sendMedia/f45cf2e8-1808-4379-a61c-88acd8e0625f",
      evoPayload,
      { headers: { "Authorization": `Bearer ${EVOLUTION_API_KEY}`, "Content-Type": "application/json" } }
    );

    res.json({ success: true, message: "Menú enviado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error enviando menú", error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
