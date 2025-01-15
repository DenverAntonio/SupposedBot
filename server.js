import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import fs from 'fs/promises';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// At the very top of server.js, after imports
console.log('Starting server...');
dotenv.config();
console.log('Environment check:', {
    hasToken: !!process.env.WHATSAPP_TOKEN,
    tokenLength: process.env.WHATSAPP_TOKEN ? process.env.WHATSAPP_TOKEN.length : 0,
    hasPhoneId: !!process.env.PHONE_NUMBER_ID,
    hasVersion: !!process.env.VERSION
});

const app = express();

// IMPORTANT: Declare messages array here, at the top level
let messages = [];

// Use the specific token
const TOKEN = process.env.WHATSAPP_TOKEN;
console.log('Token loaded:', TOKEN ? 'Yes (length: ' + TOKEN.length + ')' : 'No');
const PHONE_NUMBER_ID = '541998855653030';
const VERSION = 'v21.0';

console.log('Configuration loaded:', {
    hasToken: !!TOKEN,
    tokenLength: TOKEN ? TOKEN.length : 0,
    phoneNumberId: PHONE_NUMBER_ID,
    version: VERSION
});

// Parse JSON bodies
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            console.error('Invalid JSON received:', e);
            res.status(400).json({ 
                success: false, 
                error: 'Invalid JSON payload' 
            });
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express.static('public')); // Serve static files from 'public' directory

// Add this middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
});

// Endpoint to send messages
app.post('/send-message', async (req, res) => {
    try {
        const { message, to } = req.body;
        const url = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`;

        console.log('Sending message with config:', {
            url,
            phoneNumberId: PHONE_NUMBER_ID,
            version: VERSION,
            to,
            message,
            tokenLength: TOKEN ? TOKEN.length : 0
        });

        const response = await axios({
            method: 'POST',
            url: url,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: to,
                type: "text",
                text: { body: message }
            }
        });

        console.log('WhatsApp API Response:', response.data);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Detailed error:', {
            message: error.message,
            response: error.response?.data,
            config: {
                url: error.config?.url,
                method: error.config?.method,
                data: error.config?.data,
                headers: {
                    ...error.config?.headers,
                    'Authorization': error.config?.headers?.Authorization ? 'Bearer [REDACTED]' : undefined
                }
            }
        });
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data
        });
    }
});

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
    const verify_token = process.env.WEBHOOK_VERIFY_TOKEN;
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    // Add detailed logging
    console.log('Webhook Verification Details:', {
        expectedToken: verify_token,
        receivedToken: token,
        mode: mode,
        challenge: challenge,
        queryParams: req.query,
        headers: req.headers
    });

    // Check if all required parameters are present
    if (!mode || !token || !challenge) {
        console.log('Missing required parameters');
        return res.sendStatus(400);
    }

    if (mode === "subscribe" && token === verify_token) {
        console.log("WEBHOOK_VERIFIED Successfully");
        return res.status(200).send(challenge);
    } else {
        console.log("WEBHOOK_VERIFICATION_FAILED", {
            modeMatch: mode === "subscribe",
            tokenMatch: token === verify_token
        });
        return res.sendStatus(403);
    }
});

// Webhook for receiving messages
app.post('/webhook', (req, res) => {
    try {
        const data = req.body;
        
        if (data.entry && 
            data.entry[0].changes && 
            data.entry[0].changes[0].value.messages && 
            data.entry[0].changes[0].value.messages[0]) {
            
            const message = data.entry[0].changes[0].value.messages[0];
            
            // Store message with proper format
            const messageData = {
                from: message.from,
                text: {
                    body: message.text?.body || ''
                },
                timestamp: new Date().toISOString(),
                type: message.type,
                id: message.id
            };

            messages.push(messageData);
            console.log('✅ Stored message:', messageData);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(200).send('OK');
    }
});

// Endpoint to get messages (for polling)
app.get('/messages', (req, res) => {
    const since = req.query.since;
    console.log('Messages request received:', {
        since,
        totalMessages: messages.length,
        messages: messages
    });
    
    const newMessages = since 
        ? messages.filter(msg => new Date(msg.timestamp) > new Date(since))
        : messages;
    
    console.log('Returning messages:', newMessages);
    res.json({ messages: newMessages });
});

// Add this test endpoint to your server.js
app.get('/test-message', async (req, res) => {
    try {
        // Test message to your WhatsApp number
        const testMessage = {
            message: "Hello, this is a test message!",
            to: "264814067806"  // Replace with your test number
        };

        const url = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`;
        
        console.log('Sending test message:', testMessage);
        
        const response = await axios({
            method: 'POST',
            url: url,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: testMessage.to,
                type: "text",
                text: { body: testMessage.message }
            }
        });

        console.log('Test message response:', response.data);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Test message error:', {
            message: error.message,
            response: error.response?.data
        });
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data 
        });
    }
});

// Add a simple health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        config: {
            hasToken: !!TOKEN,
            phoneNumberId: PHONE_NUMBER_ID,
            version: VERSION
        }
    });
});

// Add this environment endpoint
app.get('/environment', (req, res) => {
    try {
        const envVars = {
            Version: process.env.VERSION || 'v21.0',
            PhoneNumberID: process.env.PHONE_NUMBER_ID,
            AccessToken: process.env.WHATSAPP_TOKEN
        };

        console.log('Loaded environment variables:', {
            Version: envVars.Version,
            PhoneNumberID: envVars.PhoneNumberID,
            hasAccessToken: !!envVars.AccessToken,
            tokenLength: envVars.AccessToken ? envVars.AccessToken.length : 0
        });

        // Log the actual token (first and last 5 characters)
        if (envVars.AccessToken) {
            console.log('Token check:', {
                firstFive: envVars.AccessToken.substring(0, 5),
                lastFive: envVars.AccessToken.substring(envVars.AccessToken.length - 5),
                length: envVars.AccessToken.length
            });
        } else {
            console.log('No token found in environment variables');
            console.log('Available env vars:', Object.keys(process.env));
        }

        res.json(envVars);
    } catch (error) {
        console.error('Error sending environment variables:', error);
        res.status(500).json({ error: 'Failed to load environment variables' });
    }
});

// Add this near your other static file serving configurations
app.use('/responses.json', express.static('public/responses.json'));

// Add this endpoint to handle ticket saving
app.post('/save-ticket', async (req, res) => {
    try {
        console.log('Received save ticket request:', req.body);
        
        if (!req.body || !req.body.tickets) {
            console.error('Invalid ticket data received');
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid ticket data' 
            });
        }

        const ticketsPath = path.join(__dirname, 'public', 'tickets.json');
        console.log('Saving to path:', ticketsPath);

        // Ensure the tickets array exists
        const ticketData = {
            tickets: Array.isArray(req.body.tickets) ? req.body.tickets : []
        };

        // Pretty print the JSON with 2 spaces indentation
        await fs.writeFile(
            ticketsPath, 
            JSON.stringify(ticketData, null, 2)
        );

        console.log('Ticket saved successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving ticket:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Add an endpoint to get tickets
app.get('/tickets', async (req, res) => {
    try {
        const ticketsPath = path.join(__dirname, 'public', 'tickets.json');
        const ticketsData = await fs.readFile(ticketsPath, 'utf8');
        res.json(JSON.parse(ticketsData));
    } catch (error) {
        console.error('Error reading tickets:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.clear(); // Clear the console
    console.log(`
=========================================
🚀 SERVER STARTED
=========================================
🌐 Server running at:
   http://localhost:${PORT}

📱 WhatsApp Webhook URL:
   ${process.env.WEBHOOK_URL || 'Not configured'}

⚙️ Configuration:
   - Port: ${PORT}
   - Phone Number ID: ${PHONE_NUMBER_ID}
   - API Version: ${VERSION}
   - Token Present: ${!!TOKEN}

🔍 Test URLs:
   - Health: http://localhost:${PORT}/health
   - Test Message: http://localhost:${PORT}/test-message
   - Messages: http://localhost:${PORT}/messages
=========================================
`);
});
