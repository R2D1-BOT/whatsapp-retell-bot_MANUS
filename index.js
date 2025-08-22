// index.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 🔥 Endpoint /send-menu que activa el envío del PDF
app.post('/send-menu', async (req, res) => {
  try {
    // Aquí recibes el contexto del usuario desde tu bot
    const { args, user_number } = req.body; // user_number se puede extraer de tu sistema

    // Ejemplo de payload para Evolution API
    const evoPayload = {
      number: user_number, // número de WhatsApp del usuario
      mediatype: "document",
      mimetype: "application/pdf",
      url: "https://ruta-a-tu-pdf.com/menu.pdf", // reemplaza con la URL real del PDF
      caption: "¡Aquí tienes nuestro menú!"
    };

    // POST a Evolution API
    await axios.post(
      "https://api.evoapicloud.com/message/sendMedia/f45cf2e8-1808-4379-a61c-88acd8e0625f",
      evoPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer TU_API_KEY" // reemplaza con tu API Key
        }
      }
    );

    // Respuesta al bot
    res.json({ success: true, message: "Menú enviado correctamente" });
  } catch (error) {
    console.error("Error enviando menú:", error);
    res.status(500).json({ success: false, message: "Error enviando menú", error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
