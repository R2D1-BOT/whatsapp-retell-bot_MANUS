const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check OBLIGATORIO para Railway
app.get('/', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Bot is alive!' });
});

// Webhook principal
app.post('/webhook', async (req, res) => {
    try {
        console.log('-> Webhook principal [/webhook] recibido!');
        console.log('DATOS WEBHOOK:', JSON.stringify(req.body, null, 2));
        
        const messageData = req.body.data || req.body;
        
        // Extraer número de teléfono de múltiples formatos posibles
        const senderNumber = messageData?.key?.remoteJid || 
                            messageData?.from || 
                            messageData?.sender ||
                            messageData?.phone ||
                            messageData?.number;
        
        // Extraer texto del mensaje de múltiples formatos posibles  
        const messageText = messageData?.message?.conversation || 
                           messageData?.message?.extendedTextMessage?.text ||
                           messageData?.text ||
                           messageData?.body ||
                           messageData?.content ||
                           '';

        console.log('DEBUG - messageData.message:', messageData?.message);
        console.log('DEBUG - messageText extraído:', messageText);

        if (!senderNumber) {
            console.error('!!! ERROR: No se pudo extraer el número de teléfono');
            return res.status(400).json({ error: 'No phone number found' });
        }

        if (!messageText) {
            console.error('!!! ERROR: No se pudo extraer el texto del mensaje');
            return res.status(400).json({ error: 'No message text found' });
        }

        console.log(`[${senderNumber}] dice: "${messageText}"`);
        console.log(`[${senderNumber}] 💬 Enviando mensaje a Retell AI...`);

        // Enviar a Retell con dynamic_variables
        const retellData = {
            user_input: messageText,
            dynamic_variables: {
                user_phone_number: senderNumber
            }
        };

        const retellResponse = await axios.post(
            `https://api.retellai.com/v2/agent/${process.env.RETELL_AGENT_ID}/chat`,
            retellData,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        console.log(`🤖 Retell AI responde (texto): "${retellResponse.data.response}"`);

        // Enviar respuesta de vuelta por WhatsApp
        if (retellResponse.data && retellResponse.data.response) {
            await sendWhatsAppMessage(senderNumber, retellResponse.data.response);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error(`!!! ERROR en el webhook [/webhook]:`, error.response?.data || error.message);
        res.status(200).json({ error: 'Error procesando webhook' });
    }
});

// Custom Function endpoint para enviar PDF
app.post('/send-menu', async (req, res) => {
    try {
        console.log('-> Endpoint [/send-menu] llamado:', req.body);
        
        const { user_phone_number } = req.body;
        
        if (!user_phone_number) {
            console.error('!!! ERROR: Falta user_phone_number');
            return res.status(400).json({ error: 'Missing user_phone_number' });
        }

        console.log(`📄 Enviando PDF a: ${user_phone_number}`);

        // Enviar PDF usando Evolution API
        const pdfData = {
            number: user_phone_number,
            mediaMessage: {
                mediatype: "document",
                media: "https://raw.githubusercontent.com/R2D1-BOT/larustica_carta/main/Carta_La_Rustica_Ace_y_Pb_Junio_24-3.pdf",
                fileName: "Carta_La_Rustica.pdf"
            }
        };

        const evolutionResponse = await axios.post(
            `${process.env.EVOLUTION_API_URL}/message/sendMedia/${process.env.EVOLUTION_INSTANCE}`,
            pdfData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EVOLUTION_API_KEY
                },
                timeout: 15000
            }
        );

        console.log('✅ PDF enviado correctamente:', evolutionResponse.data);
        
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('!!! ERROR enviando PDF:', error.response?.data || error.message);
        res.status(200).json({ success: false, error: error.message });
    }
});

// Función para enviar mensajes de WhatsApp
async function sendWhatsAppMessage(phoneNumber, message) {
    try {
        const messageData = {
            number: phoneNumber,
            text: message
        };

        const response = await axios.post(
            `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
            messageData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.EVOLUTION_API_KEY
                },
                timeout: 10000
            }
        );

        console.log('✅ Mensaje de WhatsApp enviado');
        return response.data;

    } catch (error) {
        console.error('!!! ERROR enviando mensaje WhatsApp:', error.response?.data || error.message);
        throw error;
    }
}

// Manejo graceful de SIGTERM
process.on('SIGTERM', () => {
    console.log('SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado correctamente');
        process.exit(0);
    });
});

// Iniciar servidor - BINDING CRÍTICO para Railway
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR INICIADO`);
    console.log(`✅ Servidor escuchando en el puerto ${PORT}. Vinculado a 0.0.0.0 para Railway.`);
});

// Iniciar servidor - BINDING CRÍTICO para Railway
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR INICIADO`);
    console.log(`✅ Servidor escuchando en el puerto ${PORT}. Vinculado a 0.0.0.0 para Railway.`);
});
