// index.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// =======================================================================
// CONFIG
// =======================================================================
const PORT = process.env.PORT || 8080;
const EVO_API_KEY = "C25AE83B0559-4EB6-825A-10D9B745FD61";
const EVO_INSTANCE_ID = "756d5e00-dcf5-4e67-84de-29d71fd279a3";
const EVO_SEND_TEXT_URL = `https://api.evoapicloud.com/message/sendText/${EVO_INSTANCE_ID}`;
const EVO_SEND_MEDIA_URL = `https://api.evoapicloud.com/message/sendMedia/${EVO_INSTANCE_ID}`;
const PDF_MENU_URL = "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";
const PDF_FILENAME = "Carta_La_Rustica.pdf";

// =======================================================================
// SESIONES
// =======================================================================
const chatSessions = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 min

setInterval(() => {
    const now = Date.now();
    for (const number in chatSessions) {
        if (now - chatSessions[number].lastActive > INACTIVITY_TIMEOUT) {
            console.log(`⏳ Sesión de ${number} eliminada por inactividad.`);
            delete chatSessions[number];
        }
    }
}, 60 * 1000);

// =======================================================================
// FUNCIONES AUXILIARES
// =======================================================================
async function sendText(number, text) {
    try {
        await axios.post(EVO_SEND_TEXT_URL, { number, text }, { headers: { apikey: EVO_API_KEY } });
        console.log(`[${number}] ✅ Texto enviado: ${text}`);
    } catch (err) {
        console.error(`[${number}] ❌ Error enviando texto:`, err.response?.data || err.message);
    }
}

async function sendPDF(number) {
    try {
        await axios.post(EVO_SEND_MEDIA_URL, {
            number,
            media: { url: PDF_MENU_URL, mimetype: "application/pdf", filename: PDF_FILENAME },
            text: "¡Aquí tienes nuestra carta!"
        }, { headers: { apikey: EVO_API_KEY } });
        console.log(`[${number}] ✅ PDF enviado`);
    } catch (err) {
        console.error(`[${number}] ❌ Error enviando PDF:`, err.response?.data || err.message);
    }
}

// =======================================================================
// RUTA PRINCIPAL - SOLO RECIBE MENSAJES DE EVO API
// =======================================================================
app.post('/', async (req, res) => {
    const { event, data } = req.body;
    if (!event || !data || !data.key || !data.key.remoteJid) {
        console.warn("⚠️ Mensaje entrante inválido:", req.body);
        return res.status(400).send("Invalid payload");
    }

    const number = data.key.remoteJid;
    const message = data.message?.conversation || "";

    console.log(`[${number}] dice: "${message}"`);

    // Registrar última actividad
    if (!chatSessions[number]) chatSessions[number] = {};
    chatSessions[number].lastActive = Date.now();

    // Responder automáticamente al mensaje
    if (message.toLowerCase().includes("carta")) {
        await sendPDF(number);
    } else {
        await sendText(number, `Recibido: "${message}"`);
    }

    res.status(200).send("OK");
});

// =======================================================================
// HEALTH CHECK
// =======================================================================
app.get('/', (req, res) => res.send("Bot is alive!"));

// =======================================================================
// INICIAR SERVIDOR
// =======================================================================
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor escuchando en el puerto ${PORT}`);
});









