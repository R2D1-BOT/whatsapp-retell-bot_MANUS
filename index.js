const express = require('express');
const axios = require('axios');

require('dotenv').config(); // Cargar variables de entorno desde .env

const app = express();
app.use(express.json());

// Variables de entorno
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const EVO_TOKEN = process.env.EVO_TOKEN;
const EVO_ID = process.env.EVO_ID;
const EVO_URL = process.env.EVO_URL;

// Almacenamiento temporal para sesiones de Retell AI (en un entorno de producción se usaría una base de datos)
const retellSessions = {};

app.post('/webhook', async (req, res) => {
    try {
        console.log('-> Webhook recibido!', JSON.stringify(req.body, null, 2));
        
        const { data, instance, sender, server_url, apikey } = req.body;

        // Validar que el webhook proviene de Evolution API y que contiene un mensaje
        if (!data || !data.message || !data.key || !data.key.remoteJid) {
            console.log('Webhook inválido: faltan datos esenciales.');
            return res.status(400).json({ error: 'Webhook inválido' });
        }

        const message = data.message;
        const from = data.key.remoteJid; // Número de WhatsApp del remitente
        const pushName = data.pushName; // Nombre del remitente

        let text = '';
        if (message.conversation) {
            text = message.conversation;
        } else if (message.extendedTextMessage && message.extendedTextMessage.text) {
            text = message.extendedTextMessage.text;
        } else {
            console.log(`Mensaje de tipo no soportado o vacío de ${from}:`, message);
            return res.status(200).json({ status: 'Mensaje no procesado: tipo no soportado o vacío' });
        }

        console.log(`[${from} - ${pushName}] dice: "${text}"`);

        // Verificar si ya existe una sesión de Retell AI para este número de WhatsApp
        let retellChatId = retellSessions[from];

        if (!retellChatId) {
            console.log(`[${from}] Creando nueva sesión de chat en Retell AI...`);
            const chatResponse = await axios.post('https://api.retellai.com/create-chat', {
                agent_id: RETELL_AGENT_ID,
                metadata: {
                    whatsapp_number: from,
                    push_name: pushName,
                    initial_message: text
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${RETELL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            retellChatId = chatResponse.data.chat_id;
            retellSessions[from] = retellChatId; // Guardar la sesión para futuras interacciones
            console.log('✅ Sesión creada exitosamente:', chatResponse.data);
        } else {
            console.log(`[${from}] Usando sesión de chat existente en Retell AI: ${retellChatId}`);
        }

        // Enviar el mensaje del usuario a Retell AI
        console.log(`[${from}] Enviando mensaje a Retell AI para el chat ${retellChatId}...`);
        const retellResponse = await axios.post(`https://api.retellai.com/chat/${retellChatId}/message`, {
            message: text
        }, {
            headers: {
                'Authorization': `Bearer ${RETELL_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const retellReply = retellResponse.data.response;
        console.log(`[${from}] Respuesta de Retell AI: "${retellReply}"`);

        // Enviar la respuesta de Retell AI de vuelta a WhatsApp a través de Evolution API
        console.log(`[${from}] Enviando respuesta a WhatsApp a través de Evolution API...`);
        const evolutionApiUrl = `${EVO_URL}/message/sendText/${EVO_ID}`;
        await axios.post(evolutionApiUrl, {
            number: from.split('@')[0], // Extraer solo el número de teléfono
            textMessage: {
                text: retellReply
            },
            options: {
                delay: 1200,
                presence: 'composing',
                linkPreview: false
            }
        }, {
            headers: {
                'apikey': EVO_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ Mensaje enviado a WhatsApp exitosamente.');
        
        res.status(200).json({ status: 'ok', retell_chat_id: retellChatId });
        
    } catch (error) {
        console.log('!!! ERROR en el webhook:', error.response?.data || error.message);
        console.log('--- Detalles de la Petición Fallida ---');
        if (error.config) {
            console.log('URL:', error.config.method.toUpperCase(), error.config.url);
            console.log('Headers:', JSON.stringify(error.config.headers, null, 2));
            console.log('Data:', error.config.data);
        }
        console.log('------------------------------------');
        res.status(500).json({ error: 'Error interno en el servidor' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor del bot iniciado y escuchando en el puerto ${PORT}`);
});


