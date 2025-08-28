# WhatsApp Bot (Evolution + AI)

Complete project structure for a WhatsApp bot that integrates Evolution API with AI services.

## 📁 Project Structure

```
whatsapp-bot/
├─ index.js
├─ package.json
├─ README.md
└─ .env.example
```

## 📄 Files Content

### index.js

```javascript
// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ===== ENV =====
const PORT = process.env.PORT || 8080;

// Evolution (WhatsApp)
const EVO_API_URL      = process.env.EVO_API_URL;           // e.g. https://api.evoapicloud.com
const EVO_API_KEY      = process.env.EVO_API_KEY;           // Evolution token
const EVO_INSTANCE_ID  = process.env.EVO_INSTANCE_ID;       // Evolution instance id

// Retell (or any AI you want to connect)
const RETELL_API_URL   = process.env.RETELL_API_URL || "https://api.retellai.com";
const RETELL_API_KEY   = process.env.RETELL_API_KEY;

// Assets
const PDF_MENU_URL     = process.env.PDF_MENU_URL || "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf";
const PDF_FILENAME     = process.env.PDF_FILENAME || "Carta_La_Rustica.pdf";

// ===== Utilities =====
function logEnv() {
  console.log("🌍 EVO_API_URL:", EVO_API_URL);
  console.log("🔧 EVO_INSTANCE_ID:", EVO_INSTANCE_ID ? "OK" : "MISSING");
  console.log("🔑 EVO_API_KEY:", EVO_API_KEY ? "OK" : "MISSING");
  console.log("🌍 RETELL_API_URL:", RETELL_API_URL);
  console.log("🔑 RETELL_API_KEY:", RETELL_API_KEY ? "OK" : "MISSING");
  console.log("📄 PDF_MENU_URL:", PDF_MENU_URL);
}

function pickTextFromEvolution(body) {
  // Supports Evolution "cloud" payloads and variants
  try {
    // 1) Direct form { from, body }
    if (body?.from && body?.body) {
      return { from: body.from, text: body.body };
    }
    // 2) "messages.upsert" form
    if (body?.event === "messages.upsert" && body?.data) {
      const from = body.data.key?.remoteJid || body.sender || body.data?.from;
      let text = null;

      // conversation
      if (body.data.message?.conversation) text = body.data.message.conversation;

      // extendedTextMessage
      if (!text && body.data.message?.extendedTextMessage?.text) {
        text = body.data.message.extendedTextMessage.text;
      }

      return { from, text };
    }
  } catch (_) {}
  return { from: undefined, text: undefined };
}

async function sendTextToWhatsApp(number, text) {
  if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE_ID) {
    throw new Error("Incomplete Evolution variables");
  }
  await axios.post(
    `${EVO_API_URL}/message/sendText/${EVO_INSTANCE_ID}`,
    { number, text },
    { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
  );
}

async function sendPdfToWhatsApp(number, caption) {
  if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE_ID) {
    throw new Error("Incomplete Evolution variables");
  }
  await axios.post(
    `${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE_ID}`,
    {
      number,
      media: { url: PDF_MENU_URL, mimetype: "application/pdf", filename: PDF_FILENAME },
      text: caption || "Here's the menu."
    },
    { headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" } }
  );
}

async function askRetell(userText) {
  if (!RETELL_API_KEY) throw new Error("Missing RETELL_API_KEY");
  const url = `${RETELL_API_URL.replace(/\/$/, "")}/v1/chat/completions`;

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a WhatsApp assistant for a restaurant. Respond short and clear." },
      { role: "user", content: userText }
    ]
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      "Content-Type": "application/json"
    },
    validateStatus: () => true
  });

  if (res.status >= 400) {
    throw new Error(`Retell ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res.data?.choices?.[0]?.message?.content || "";
}

// ===== Health Check =====
app.get("/healthz", (req, res) => res.status(200).json({ ok: true }));

// ===== Webhook =====
app.post("/webhook", async (req, res) => {
  try {
    const { from, text } = pickTextFromEvolution(req.body);
    console.log("📩 Webhook received:", JSON.stringify(req.body));
    console.log(`[${from}] says: "${text}"`);

    if (!from || !text) {
      console.warn("⚠️ Invalid payload (from/text undefined).");
      return res.sendStatus(200);
    }

    // Tactical fallback: if asking for menu, send PDF without going through AI
    const normalized = (text || "").toLowerCase();
    if (normalized.includes("carta") || normalized.includes("menú") || normalized.includes("menu")) {
      await sendPdfToWhatsApp(from, "Here's the menu. Tell me what you'd like.");
      return res.sendStatus(200);
    }

    // AI flow (Retell or whatever you connect)
    let aiReply = "";
    try {
      aiReply = await askRetell(text);
    } catch (err) {
      console.error("❌ Retell Error:", err.message);
      aiReply = "I can't consult the assistant right now. Can I help you with something specific?";
    }

    if (!aiReply || typeof aiReply !== "string") {
      aiReply = "Could you repeat that? I didn't understand you well.";
    }

    await sendTextToWhatsApp(from, aiReply);
  } catch (err) {
    console.error("❌ Error in /webhook:", err.response?.data || err.message);
  }
  res.sendStatus(200);
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  logEnv();
});
```

### package.json

```json
{
  "name": "whatsapp-bot",
  "version": "1.0.0",
  "description": "WhatsApp Bot via Evolution + AI proxy (Retell or any other)",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "NODE_ENV=development node index.js"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "express": "^4.19.2"
  }
}
```

### .env.example

```bash
# Server
PORT=8080

# Evolution (WhatsApp)
EVO_API_URL=https://api.evoapicloud.com
EVO_API_KEY=REPLACE_WITH_YOUR_TOKEN
EVO_INSTANCE_ID=REPLACE_WITH_YOUR_INSTANCE_ID

# AI (Retell by default; you can plug in another)
RETELL_API_URL=https://api.retellai.com
RETELL_API_KEY=REPLACE_WITH_YOUR_KEY

# Assets
PDF_MENU_URL=https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf
PDF_FILENAME=Carta_La_Rustica.pdf
```

## 🚀 Quick Start

### Environment Variables Setup
Copy `.env.example` to `.env` and fill in your actual values:
- `EVO_API_URL` = https://api.evoapicloud.com
- `EVO_API_KEY` = Your Evolution API token
- `EVO_INSTANCE_ID` = Your Evolution instance ID  
- `RETELL_API_KEY` = Your AI service API key
- `PORT` = 8080 (or your preferred port)

### Local Development
```bash
npm install
npm run dev
```

### Health Check
```
GET /healthz → Returns 200 OK
```

### Webhook Configuration
Configure your Evolution API webhook to point to:
```
POST https://<your-host>/webhook
```

## 🤖 Bot Behavior

The bot operates with these rules:

1. **Menu Requests**: If the message contains "carta", "menú", or "menu" → sends PDF directly without AI processing
2. **General Messages**: All other messages → forwards to AI service and responds with AI reply
3. **Error Handling**: If AI fails → sends fallback message
4. **Logging**: All interactions are logged for debugging

## 🔧 Key Features

- **Robust Message Parsing**: Handles different Evolution API payload formats
- **Fallback PDF Delivery**: Direct menu delivery for common requests
- **AI Integration**: Easy to swap AI services by modifying the `askRetell()` function
- **Error Resilience**: Graceful degradation when services fail
- **Environment Validation**: Startup checks for required variables

## 🔄 Switching AI Services

To use a different AI service, simply modify the `askRetell()` function in `index.js`. The current implementation uses Retell AI's OpenAI-compatible endpoint.

## 📝 Logs and Debugging

The server logs:
- Environment variable status on startup
- All incoming webhook payloads
- Message processing flow  
- API errors and responses

Perfect for debugging and monitoring your bot's performance!










