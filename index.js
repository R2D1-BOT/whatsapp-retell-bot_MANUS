// index.js - bot simple con timeout 5 min
const axios = require("axios");

// 🔑 Variables
const EVO_API_KEY = "C25AE83B0559-4EB6-825A-10D9B745FD61"; 
const RETELL_API_KEY = "key_98bff79098c79f41ea2c02327ed2"; 
const AGENT_ID = "agent_0452f6bca77b7fd955d6316299"; 
const EVO_INSTANCE_ID = "f45cf2e8-1808-4379-a61c-88acd8e0625f"; 

// Sesiones
const chatSessions = {};
const sessionTimestamps = {};
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 min

// Limpiar sesiones inactivas cada 5 min
setInterval(() => {
  const now = Date.now();
  for (const from in sessionTimestamps) {
    if (now - sessionTimestamps[from] > INACTIVITY_TIMEOUT) {
      console.log(`⏳ Sesión de ${from} eliminada por inactividad.`);
      delete chatSessions[from];
      delete sessionTimestamps[from];
    }
  }
}, INACTIVITY_TIMEOUT);

async function sendMessageToRetell(from, text) {
  try {
    sessionTimestamps[from] = Date.now();

    let chatId = chatSessions[from];
    if (!chatId) {
      const createChatResp = await axios.post(
        "https://api.retellai.com/v1/agents/" + AGENT_ID + "/create-chat",
        {},
        { headers: { Authorization: `Bearer ${RETELL_API_KEY}` } }
      );
      chatId = createChatResp.data.chat_id;
      chatSessions[from] = chatId;
      console.log(`🚀 Nueva sesión creada para ${from}`);
    }

    const chatResp = await axios.post(
      `https://api.retellai.com/v1/agents/${AGENT_ID}/chat-completions`,
      { chat_id: chatId, messages: [{ role: "user", content: text }] },
      { headers: { Authorization: `Bearer ${RETELL_API_KEY}` } }
    );

    const reply = chatResp.data.output_text || "⚠️ Sin respuesta del bot";
    console.log(`🤖 Respuesta de Retell: ${reply}`);

    await axios.post(
      `https://api.evoapicloud.com/message/sendText/${EVO_INSTANCE_ID}`,
      { number: from, text: reply },
      { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
    );

    console.log(`✅ Mensaje enviado a ${from}`);

  } catch (err) {
    console.error("❌ Error en sendMessageToRetell:", err.response?.data || err.message);
  }
}

// Simulación de mensaje
(async () => {
  const testNumber = "34625186415@s.whatsapp.net";
  const testMessage = "Hola, quiero la carta";
  await sendMessageToRetell(testNumber, testMessage);
})();









