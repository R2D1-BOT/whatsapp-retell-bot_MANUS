const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Tu API Key de Evolution API
const EVOLUTION_API_KEY = process.env.EVO_API_KEY;

if (!EVOLUTION_API_KEY) {
  console.error("❌ FALTA la variable de entorno EVO_API_KEY");
  process.exit(1);
}

// Endpoint POST /send-menu
app.post('/send-menu', async (req, res) => {
  try {
    const { user_number } = req.body;

    if (!user_number) {
      return res.status(400).json({ success: false, message: "Falta user_number" });
    }

    // Payload Evolution API
    const evoPayload = {
      number: user_number,
      mediatype: "document",
      mimetype: "application/pdf",
      url: "https://ruta-a-tu-pdf.com/menu.pdf", // reemplaza con tu PDF real
      caption: "¡Aquí tienes nuestro menú!"
    };

    await axios.post(
      "https://api.evoapicloud.com/message/sendMedia/f45cf2e8-1808-4379-a61c-88acd8e0625f",
      evoPayload,
      {
        headers: {
          "Authorization": `Bearer ${EVOLUTION_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ success: true, message: "Menú enviado correctamente" });
  } catch (error) {
    console.error("Error enviando menú:", error.message);
    res.status(500).json({ success: false, message: "Error enviando menú", error: error.message });
  }
});

// Puerto Railway
const PORT = process.env.PORT || 8080;

// Mantener alive el contenedor para evitar SIGTERM
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  setInterval(() => console.log("Container alive"), 30000);
});
