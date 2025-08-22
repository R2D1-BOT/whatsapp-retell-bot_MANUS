const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const EVOLUTION_API_KEY = process.env.EVO_API_KEY;

if (!EVOLUTION_API_KEY) {
  console.error("❌ FALTA la variable de entorno EVO_API_KEY");
  process.exit(1);
}

// Endpoint para enviar PDF
app.post('/send-menu', async (req, res) => {
  try {
    const { user_number } = req.body;
    if (!user_number) return res.status(400).json({ success: false, message: "Falta user_number" });

    await axios.post(
      "https://api.evoapicloud.com/message/sendMedia/f45cf2e8-1808-4379-a61c-88acd8e0625f",
      {
        number: user_number,
        mediatype: "document",
        mimetype: "application/pdf",
        url: "https://ruta-a-tu-pdf.com/menu.pdf", // reemplaza con tu PDF real
        caption: "¡Aquí tienes nuestro menú!"
      },
      {
        headers: {
          "Authorization": `Bearer ${EVOLUTION_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ success: true, message: "Menú enviado correctamente" });
  } catch (err) {
    console.error("Error enviando menú:", err.message);
    res.status(500).json({ success: false, message: "Error enviando menú", error: err.message });
  }
});

// Puerto Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Mantener alive el contenedor para evitar SIGTERM
  setInterval(() => console.log("Container alive"), 30000);
});
