const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔥 VARIABLES DE ENTORNO
const EVO_API_KEY = process.env.EVO_API_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

if (!EVO_API_KEY || !EVOLUTION_API_URL || !EVOLUTION_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
    console.error('❌ Faltan variables de entorno necesarias. Verifica Render.');
    process.exit(1);
}

// 🔹 SESIONES DE CHAT Y Tiempos
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutos
const CLEANUP_INTERVAL = 3 * 60 * 1000;

function cleanupInactiveSessions() {
    const now = Date.now();
    let cleaned = 0;
    for (const [num, ts] of Object.entries(sessionTimestamps)) {
        if (now - ts > INACTIVITY_TIMEOUT) {
            console.log(`🧹 Cerrando sesión inactiva: ${num}`);
            delete chatSessions[num];
            delete sessionTimestamps[num];
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`🧹 Sesiones limpiadas: ${cleaned}`);
}
setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL);

console.log('🚀 Servidor iniciado con variables de entorno');
console.log('✅ EVO_API_KEY:', EVO_API_KEY.substring(0, 10) + '...');
console.log('✅ RETELL_API_KEY:', RETELL_API_KEY.substring(0, 10) + '...');

// ==================== ENDPOINT PDF ====================
app.post('/send_pdf', async (req, res) => {
    const userNumber = req.body.user_number; // Debe enviar Retell
    if (!userNumber) {
        console.error('❌ No se proporcionó user_number en el request');
        return res.status(400).json({ ok: false, error: 'No user_number provided' });
    }

    console.log(`📄 Solicitud de PDF recibida para: ${userNumber}`);

    try {
        const response = await axios.post(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
            number: userNumber,
            mediatype: "document",
            mimetype: "application/pdf",
            media: "https://raw.githubusercontent.com/R2D1-BOT/whatsapp-retell-bot_MANUS/main/menu.pdf",
            fileName: "Carta_La_Rustica.pdf"
        }, {
            headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' }
        });

        console.log(`✅ PDF enviado a ${userNumber}`);
        res.json({ ok: true, evo_response: response.data });

    } catch (err) {
        console.error("❌ Error enviando PDF:", err.response?.data || err.message);
        res.status(500).json({ ok: false, error: err.response?.data || err.message });
    }
});

// ==================== HEALTHCHECK ====================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessions: Object.keys(chatSessions).length
    });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});






