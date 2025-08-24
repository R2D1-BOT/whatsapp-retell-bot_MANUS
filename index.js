const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ======== ENV (acepta ambos nombres para evitar confusiones) ========
const EVO_API_KEY = process.env.EVOLUTION_API_KEY || process.env.EVO_API_KEY;
const EVO_API_URL = process.env.EVOLUTION_API_URL || process.env.EVO_API_URL;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || process.env.EVO_INSTANCE;
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

// URL del PDF (puedes sobreescribir con PDF_URL en Render)
const PDF_URL =
  process.env.PDF_URL ||
  'https://raw.githubusercontent.com/R2D1-BOT/whatsapp-retell-bot_MANUS/main/menu.pdf';

// ======== Validación de env ========
if (!EVO_API_KEY || !EVO_API_URL || !EVO_INSTANCE || !RETELL_API_KEY || !RETELL_AGENT_ID) {
  console.error('❌ Faltan variables de entorno: EVOLUTION_API_KEY, EVOLUTION_API_URL, EVOLUTION_INSTANCE, RETELL_API_KEY, RETELL_AGENT_ID');
  process.exit(1);
}

// ======== Sesiones y estado ========
const chatSessions = {};              // senderNumber -> chatId
const retellToSender = {};            // chatId -> senderNumber
let lastSenderGlobal = null;          // fallback si no hay chatId
let lastSenderAt = 0;

const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutos
const CLEANUP_INTERVAL = 3 * 60 * 1000;

function cleanupInactive() {
  const now = Date.now();
  let cleaned = 0;

  // Limpiar pares chatId<->sender si hace mucho que no hay mensajes
  for (const [sender, chatId] of Object.entries(chatSessions)) {
    // si el sender ya no es el último y han pasado más de 3 min, lo removemos
    if (sender !== lastSenderGlobal && now - lastSenderAt > INACTIVITY_TIMEOUT) {
      const cid = chatSessions[sender];
      delete chatSessions[sender];
      if (cid) delete retellToSender[cid];
      cleaned++;
    }
  }
  if (cleaned) console.log(`🧹 Sesiones limpiadas: ${cleaned}`);
}
setInterval(cleanupInactive, CLEANUP_INTERVAL);

// ======== Logs de arranque ========
console.log('🚀 Servidor iniciado con variables de entorno');
console.log('✅ EVOLUTION_API_KEY:', (EVO_API_KEY || '').slice(0, 10) + '...');
console.log('✅ RETELL_API_KEY:', (RETELL_API_KEY || '').slice(0, 10) + '...');
console.log('📄 PDF_URL:', PDF_URL);

// ======== Util ========
function extractText(msg) {
  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    msg?.message?.videoMessage?.caption ||
    ''
  );
}

async function sendWhatsText(number, text) {
  try {
    await axios.post(
      `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`,
      { number, text },
      { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Mensaje enviado: "${text}"`);
  } catch (e) {
    console.error('❌ Error enviando texto:', e.response?.data || e.message);
  }
}

async function sendWhatsPdf(number, pdfUrl) {
  try {
    const body = {
      number,
      mediatype: 'document',
      mimetype: 'application/pdf',
      fileName: 'Carta_La_Rustica.pdf',
      caption: 'Aquí tienes nuestra carta en PDF 📄',
      mediaUrl: pdfUrl // <- como pediste
    };
    const { data } = await axios.post(
      `${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`,
      body,
      { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } }
    );
    console.log('📎 PDF enviado OK → Evolution:', data);
    return true;
  } catch (e) {
    console.error('❌ Error enviando PDF:', e.response?.data || e.message);
    return false;
  }
}

// ======== Webhook Evolution ========
app.post('/webhook', async (req, res) => {
  try {
    const eventType = req.body.event;
    const data = req.body.data;
    if (eventType !== 'messages.upsert' || !data) return res.status(200).send('OK');

    const senderNumber = data.key?.remoteJid; // p.ej. "346xxxx@s.whatsapp.net"
    const text = extractText(data);

    if (!senderNumber || !text) return res.status(200).send('OK');

    console.log(`[${senderNumber}] dice: "${text}"`);
    lastSenderGlobal = senderNumber;
    lastSenderAt = Date.now();

    // Crear chat de Retell si no existe
    let chatId = chatSessions[senderNumber];
    if (!chatId) {
      const r = await axios.post(
        'https://api.retellai.com/create-chat',
        { agent_id: RETELL_AGENT_ID },
        { headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      chatId = r.data.chat_id;
      chatSessions[senderNumber] = chatId;
      retellToSender[chatId] = senderNumber;
      console.log(`🔗 Retell chat creado: ${chatId} ⇄ ${senderNumber}`);
    }

    // Pasar el mensaje a Retell
    const comp = await axios.post(
      'https://api.retellai.com/create-chat-completion',
      { chat_id: chatId, content: text },
      { headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    const msgs = comp.data.messages || [];
    const reply = msgs.length ? msgs[msgs.length - 1].content : '...';
    if (reply && reply.trim()) {
      await sendWhatsText(senderNumber, reply);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('!!! ERROR webhook:', e.response?.data || e.message);
    return res.status(200).send('OK'); // no cortar reintentos de Evolution
  }
});

// ======== Endpoint que invoca Retell (Custom Function) ========
// Configura en Retell: POST https://<tu-render>/send-pdf
// Headers (opcional): X-Retell-Chat-Id: {{chat_id}}
app.post('/send-pdf', async (req, res) => {
  try {
    // 1) Prioridad: header con número (si algún día lo pasas)
    let target = req.headers['x-user-number'];

    // 2) Si viene chat_id por header, resolvemos a número
    const headerChatId = req.headers['x-retell-chat-id'];
    if (!target && headerChatId && retellToSender[headerChatId]) {
      target = retellToSender[headerChatId];
      console.log(`📌 Destinatario por chatId (${headerChatId}) → ${target}`);
    }

    // 3) Fallback: último remitente (≤ 3 minutos)
    if (!target && lastSenderGlobal && Date.now() - lastSenderAt <= INACTIVITY_TIMEOUT) {
      target = lastSenderGlobal;
      console.log(`📌 Destinatario por último remitente reciente → ${target}`);
    }

    if (!target) {
      console.error('❌ No se pudo resolver destinatario para enviar PDF');
      return res.status(400).json({ ok: false, error: 'NO_RECIPIENT' });
    }

    const ok = await sendWhatsPdf(target, PDF_URL);
    if (!ok) return res.status(500).json({ ok: false });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('❌ Error en /send-pdf:', e.response?.data || e.message);
    return res.status(500).json({ ok: false });
  }
});

// ======== (Opcional) servir menu.pdf local si lo subes al repo ========
app.get('/menu.pdf', (req, res) => {
  const file = path.join(process.cwd(), 'menu.pdf');
  if (fs.existsSync(file)) return res.sendFile(file);
  return res.status(404).send('menu.pdf no encontrado en el servidor');
});

// ======== Health ========
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    ts: new Date().toISOString(),
    sessions: Object.keys(chatSessions).length,
    timeoutMin: INACTIVITY_TIMEOUT / 60000
  });
});

// ======== Start ========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});





