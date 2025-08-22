const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check para Railway
app.get('/', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Bot running' });
});

// Webhook principal
app.post('/webhook', async (req, res) => {
    try {
        const messageData = req.body;
        const senderNumber = messageData.key.remoteJid;
        const messageText = messageData.message.conversation || 
                           messageData.message.extendedTextMessage?.text || '';

        console.log(`Message from ${senderNumber}: ${messageText}`);

        // Enviar a Retell con dynamic_variables
        const retellData = {
            user_input: messageText,
            dynamic_variables: {
                user_phone_number: senderNumber
            }
        };

        const retellResponse = await axios.post(
            `https://api.retellai.com/v2/conversation/${process.env.RETELL_CONVERSATION_ID}/message`,
            retellData,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 8000
            }
        );

        // Enviar respuesta de vuelta
        if (retellResponse.data && retellResponse.data.response) {
            await sendWhatsAppMessage(senderNumber, retellResponse.data.response);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(500).json({ error: 'Error' });
    }
});

// Custom Function endpoint para enviar PDF
app.post('/send-menu', async (req, res) => {
    try {
        console.log('Send menu called:', req.body);
        
        const { user_phone_number } = req.body;
        
        if (!user_phone_number) {
            return res.status(400).json({ error: 'Missing user_phone_number' });
        }

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
                timeout: 10000
            }
        );

        console.log('PDF sent:', evolutionResponse.data);
        
        // CRÍTICO: Retell necesita status 200 y JSON response
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error sending PDF:', error.message);
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
                timeout: 8000
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.message);
        throw error;
    }
}

// Manejo de SIGTERM para Railway
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});

// CRÍTICO: Binding a 0.0.0.0 para Railway
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
