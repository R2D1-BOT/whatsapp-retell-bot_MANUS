const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// OPCIÓN 1: Si usas headers desde Evolution API
const getRetellCredentials = (req) => {
    const apiKey = req.headers['authorization']?.replace('Bearer ', '');
    const agentId = req.headers['x-agent-id'];
    
    // Fallback a hardcoded si no vienen en headers
    return {
        apiKey: apiKey || 'key_45537c9b9dd8e7d97dae0c7a5e',
        agentId: agentId || 'agent_f1ac3e5aff6ed5a42dd09a05bb'
    };
};

// Evolution API config (hardcoded para que funcione)
const EVO_CONFIG = {
    url: 'https://api.evoapicloud.com',
    token: 'B4BBB16CEEA8-42A1-A6ED-04D81D9B42F1',
    instanceId: '756d5e00-dcf5-4e67-84de-29d71fd279a3'
};

app.post('/webhook', async (req, res) => {
    try {
        console.log('-> Webhook recibido!', JSON.stringify(req.body, null, 2));
        
        const { data } = req.body;

        // Validaciones básicas
        if (!data?.message || !data?.key?.remoteJid) {
            console.log('❌ Webhook inválido: faltan datos esenciales');
            return res.status(400).json({ error: 'Webhook inválido' });
        }

        const message = data.message;
        const from = data.key.remoteJid;
        const pushName = data.pushName || 'Usuario';

        // Extraer texto del mensaje
        let text = '';
        if (message.conversation) {
            text = message.conversation;
        } else if (message.extendedTextMessage?.text) {
            text = message.extendedTextMessage.text;
        } else {
            console.log(`⚠️ Tipo de mensaje no soportado de ${from}`);
            return res.status(200).json({ status: 'Mensaje no procesado' });
        }

        console.log(`[${from} - ${pushName}] dice: "${text}"`);

        // Obtener credenciales de Retell AI
        const { apiKey, agentId } = getRetellCredentials(req);
        
        console.log('🔑 API Key:', apiKey ? 'RECIBIDA' : 'FALTA');
        console.log('🤖 Agent ID:', agentId ? 'RECIBIDO' : 'FALTA');

        if (!apiKey || !agentId) {
            throw new Error('Faltan credenciales de Retell AI');
        }

        // CREAR CHAT EN RETELL AI (endpoint correcto)
        console.log(`[${from}] Creando chat en Retell AI...`);
        
        const retellResponse = await axios.post('https://api.retellai.com/create-chat', {
            agent_id: agentId,
            retell_llm_dynamic_variables: {
                customer_name: pushName,
                whatsapp_number: from,
                initial_message: text
            },
            metadata: {
                whatsapp_number: from,
                push_name: pushName,
                platform: 'whatsapp'
            }
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Chat creado en Retell AI:', retellResponse.data);

        // RESPONDER A WHATSAPP (usando Evolution API)
        const phoneNumber = from.replace('@s.whatsapp.net', '');
        const responseMessage = `¡Hola ${pushName}! He recibido tu mensaje: "${text}". Procesando con Retell AI...`;
        
        console.log(`[${from}] Enviando respuesta a WhatsApp...`);
        
        await axios.post(`${EVO_CONFIG.url}/message/sendText/${EVO_CONFIG.instanceId}`, {
            number: phoneNumber,
            textMessage: {
                text: responseMessage
            }
        }, {
            headers: {
                'apikey': EVO_CONFIG.token,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Respuesta enviada a WhatsApp');
        
        res.status(200).json({ 
            status: 'success',
            chat_id: retellResponse.data.chat_id || 'unknown'
        });
        
    } catch (error) {
        console.log('!!! ERROR en el webhook:', error.response?.data || error.message);
        console.log('--- Detalles del Error ---');
        if (error.config) {
            console.log('URL:', error.config.method?.toUpperCase(), error.config.url);
            console.log('Headers:', JSON.stringify(error.config.headers, null, 2));
            console.log('Data:', error.config.data);
        }
        console.log('-------------------------');
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot funcionando', 
        timestamp: new Date().toISOString() 
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor del bot iniciado y escuchando en el puerto ${PORT}`);
});
