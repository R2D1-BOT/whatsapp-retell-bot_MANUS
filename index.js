// index.js
const express = require("express");
const app = express();

app.use(express.json());

// Simulación: aquí pondrás la lógica real para obtener el número
// Ejemplo: lo recibes desde Retell o tu base de datos
app.get("/get-chat-id", (req, res) => {
  // ⚡ Aquí hardcodeo un número ejemplo, en producción lo devuelves dinámico
  const chatId = "346XXXXXXXX"; // <-- tu número real en formato internacional

  res.json({
    chat_id: chatId
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));




