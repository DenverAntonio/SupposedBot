/**
 * WhatsApp Support Ticket System - Server
 * 
 * Main Express.js server application that handles all WhatsApp Business API interactions,
 * message routing, ticket management, and serves the web interface. This server acts as
 * the central hub for all system functionality.
 * 
 * Core Responsibilities:
 * - WhatsApp Business API integration
 * - Webhook handling and verification
 * - Message routing and processing
 * - Ticket management and storage
 * - Static file serving
 * - Environment configuration
 * - Media handling (images)
 * 
 * Technical Implementation:
 * - Express.js web server
 * - WhatsApp Business API client
 * - File-based storage systems
 * - RESTful API endpoints
 * - Webhook integration
 * - Media upload handling
 * 
 * Key Features:
 * - Real-time message processing
 * - Automated webhook verification
 * - Secure environment configuration
 * - Message history management
 * - Ticket system integration
 * - Image upload and sending
 * - Error handling and logging
 * 
 * API Endpoints:
 * 1. WhatsApp Integration:
 *    - POST /webhook: Receive WhatsApp messages
 *    - GET /webhook: Verify WhatsApp webhook
 *    - POST /send-message: Send text messages
 *    - POST /send-image: Send images
 *    - POST /upload-media: Upload media to WhatsApp
 * 
 * 2. Ticket Management:
 *    - GET /tickets: Retrieve all tickets
 *    - POST /save-ticket: Create/update tickets
 *    - POST /api/clear-tickets: Clear ticket history
 *    - GET /check-tickets: Get ticket status
 * 
 * 3. Message Management:
 *    - GET /messages: Retrieve messages
 *    - POST /api/clear-chat-history: Clear message history
 *    - GET /debug/chat-history: Debug message history
 * 
 * 4. System Management:
 *    - GET /health: System health check
 *    - GET /environment: Environment variables
 *    - GET /test-message: Test message sending
 * 
 * Dependencies:
 * - express: Web server framework
 * - dotenv: Environment configuration
 * - axios: HTTP client
 * - form-data: Multipart form handling
 * - fs/promises: File system operations
 * 
 * Environment Variables:
 * - WHATSAPP_TOKEN: WhatsApp API authentication token
 * - PHONE_NUMBER_ID: WhatsApp Business Account ID
 * - VERSION: WhatsApp API version
 * - WEBHOOK_VERIFY_TOKEN: Webhook verification token
 * - PORT: Server port number
 * 
 * Error Handling:
 * - Detailed error logging
 * - Error response formatting
 * - Graceful error recovery
 * - Debug information
 * 
 * Security Features:
 * - Environment variable protection
 * - Webhook verification
 * - Token validation
 * - Error message sanitization
 * 
 * @module server
 * @requires express
 * @requires dotenv
 * @requires axios
 * @requires fs/promises
 */

import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import fs from 'fs/promises';
import path from "path";
import { fileURLToPath } from 'url';
import MessageStorage from './public/messageStorage.js';
import FormData from 'form-data';

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

// Initialize message storage
const messageStorage = new MessageStorage();
await messageStorage.initialize();

/**
 * Server Configuration
 * Loads and validates essential environment variables
 */
const config = {
    TOKEN: process.env.WHATSAPP_TOKEN,
    PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID || '541998855653030',
    VERSION: process.env.VERSION || 'v21.0',
    PORT: process.env.PORT || 3001
};

// Validate required configuration
if (!config.TOKEN) {
    console.error('Missing required WHATSAPP_TOKEN');
    process.exit(1);
}

console.log('Token loaded:', config.TOKEN ? 'Yes (length: ' + config.TOKEN.length + ')' : 'No');
console.log('Configuration loaded:', {
    hasToken: !!config.TOKEN,
    tokenLength: config.TOKEN ? config.TOKEN.length : 0,
    phoneNumberId: config.PHONE_NUMBER_ID,
    version: config.VERSION
});

// Parse JSON bodies (must be before routes)
app.use(express.json());

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// Add this middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
});

// Group all API routes together at the top
// API Routes
const apiRouter = express.Router();

// Clear tickets endpoint
apiRouter.post('/clear-tickets', async (req, res) => {
    try {
        console.log('Received clear tickets request');
        const ticketsPath = path.join(__dirname, 'public', 'tickets.json');
        
        // Create empty tickets structure
        const emptyTickets = {
            tickets: []
        };
        
        // Write empty tickets to file
        await fs.writeFile(
            ticketsPath, 
            JSON.stringify(emptyTickets, null, 2)
        );
        
        console.log('All tickets cleared successfully');
        res.status(200).json({ 
            success: true, 
            message: 'All tickets cleared successfully' 
        });
    } catch (error) {
        console.error('Error clearing tickets:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to clear tickets',
            details: error.message 
        });
    }
});

// Clear chat history endpoint
apiRouter.post('/clear-chat-history', async (req, res) => {
    try {
        await messageStorage.clearMessages();
        messages = [];
        console.log('Chat history cleared successfully');
        res.status(200).json({ 
            success: true, 
            message: 'Chat history cleared successfully' 
        });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to clear chat history',
            details: error.message 
        });
    }
});

// Mount the API router
app.use('/api', apiRouter);

/**
 * Sends a message via WhatsApp API
 * @route POST /send-message
 * @param {Object} req.body.message - Message content
 * @param {string} req.body.to - Recipient phone number
 */
app.post('/send-message', async (req, res) => {
    try {
        const { message, to } = req.body;
        const url = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/messages`;

        console.log('Sending message with config:', {
            url,
            phoneNumberId: config.PHONE_NUMBER_ID,
            version: config.VERSION,
            to,
            message,
            tokenLength: config.TOKEN ? config.TOKEN.length : 0
        });

        const response = await axios({
            method: 'POST',
            url: url,
            headers: {
                'Authorization': `Bearer ${config.TOKEN}`,
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

        // Store the outgoing message
        await messageStorage.addOutgoingMessage(to, message);

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

/**
 * Verifies WhatsApp webhook
 * @route GET /webhook
 */
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

/**
 * Receives WhatsApp messages
 * @route POST /webhook
 */
app.post('/webhook', async (req, res) => {
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

            // Store in messages array and in storage
            messages.push(messageData);
            await messageStorage.addIncomingMessage(messageData.from, messageData.text.body);
            
            console.log('✅ Stored message:', messageData);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(200).send('OK');
    }
});

// Endpoint to get messages (for polling)
app.get('/messages', async (req, res) => {
    try {
        const since = req.query.since;
        console.log('Messages request received with timestamp:', since);
        
        if (!since) {
            // If no timestamp provided, return all messages
            const allMessages = await messageStorage.getAllMessages();
            return res.json({ messages: allMessages });
        }

        // Get messages since the specified timestamp
        const newMessages = await messageStorage.getMessagesSince(since);
        
        // Combine and sort incoming and outgoing messages
        const combinedMessages = [
            ...newMessages.incoming.map(msg => ({
                ...msg,
                text: { body: msg.content },
                timestamp: msg.timestamp,
                from: msg.from
            })),
            ...newMessages.outgoing.map(msg => ({
                ...msg,
                text: { body: msg.content },
                timestamp: msg.timestamp,
                from: msg.to
            }))
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log('Returning messages:', {
            sinceTimestamp: since,
            messageCount: combinedMessages.length,
            messages: combinedMessages
        });

        res.json({ messages: combinedMessages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ 
            error: 'Failed to fetch messages',
            details: error.message 
        });
    }
});

// Add this test endpoint to your server.js
app.get('/test-message', async (req, res) => {
    try {
        // Test message to your WhatsApp number
        const testMessage = {
            message: "Hello, this is a test message!",
            to: "264814067806"  // Replace with your test number
        };

        const url = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/messages`;
        
        console.log('Sending test message:', testMessage);
        
        const response = await axios({
            method: 'POST',
            url: url,
            headers: {
                'Authorization': `Bearer ${config.TOKEN}`,
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
            hasToken: !!config.TOKEN,
            phoneNumberId: config.PHONE_NUMBER_ID,
            version: config.VERSION
        }
    });
});

// Add this environment endpoint
app.get('/environment', (req, res) => {
    try {
        const envVars = {
            Version: config.VERSION,
            PhoneNumberID: config.PHONE_NUMBER_ID,
            AccessToken: config.TOKEN,
            RecipientPhone: process.env.RECIPIENT_PHONE
        };

        console.log('Loaded environment variables:', {
            Version: envVars.Version,
            PhoneNumberID: envVars.PhoneNumberID,
            hasAccessToken: !!envVars.AccessToken,
            tokenLength: envVars.AccessToken ? envVars.AccessToken.length : 0,
            RecipientPhone: envVars.RecipientPhone
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

        // Read existing tickets
        let ticketData = { tickets: [] };
        try {
            const existingData = await fs.readFile(ticketsPath, 'utf8');
            ticketData = JSON.parse(existingData);
            console.log('Existing ticket data:', ticketData);
        } catch (error) {
            console.log('No existing tickets file or error reading it:', error.message);
        }

        // Ensure tickets is an array
        if (!Array.isArray(ticketData.tickets)) {
            ticketData.tickets = [];
        }

        // Create a Map to track unique tickets by their number
        const uniqueTickets = new Map();

        // First, add existing tickets to the Map (keeping only the first occurrence)
        ticketData.tickets.forEach(ticket => {
            if (!uniqueTickets.has(ticket.ticketNumber)) {
                uniqueTickets.set(ticket.ticketNumber, ticket);
            }
        });

        // Then try to add new tickets (only if they don't exist)
        const newTickets = Array.isArray(req.body.tickets) ? req.body.tickets : [req.body.tickets];
        let duplicatesFound = false;
        
        newTickets.forEach(newTicket => {
            if (!uniqueTickets.has(newTicket.ticketNumber)) {
                uniqueTickets.set(newTicket.ticketNumber, newTicket);
            } else {
                duplicatesFound = true;
                console.log(`Duplicate ticket prevented: ${newTicket.ticketNumber}`);
            }
        });

        // Convert Map back to array and sort by creation date
        const finalTickets = Array.from(uniqueTickets.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Save the deduplicated tickets
        await fs.writeFile(
            ticketsPath, 
            JSON.stringify({ tickets: finalTickets }, null, 2)
        );

        res.json({ 
            success: true, 
            ticketCount: finalTickets.length,
            duplicatesFound
        });
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

// Add this endpoint to check current tickets
app.get('/check-tickets', async (req, res) => {
    try {
        const ticketsPath = path.join(__dirname, 'public', 'tickets.json');
        const data = await fs.readFile(ticketsPath, 'utf8');
        const tickets = JSON.parse(data);
        res.json({
            ticketCount: tickets.tickets.length,
            tickets: tickets
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Add debug endpoint for chat history
app.get('/debug/chat-history', async (req, res) => {
    try {
        const chatHistory = await messageStorage.getAllMessages();
        res.json(chatHistory);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ 
            error: 'Failed to fetch chat history',
            details: error.message 
        });
    }
});

// Add image sending endpoint
app.post('/send-image', async (req, res) => {
    try {
        const { to, media_id } = req.body;
        const url = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/messages`;

        const whatsappData = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to,
            type: "image",
            image: {
                id: media_id,
                caption: "Sprout - Green Enterprise Solutions Support"
            }
        };

        const response = await axios({
            method: 'POST',
            url: url,
            headers: {
                'Authorization': `Bearer ${config.TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: whatsappData
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Error sending image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update the upload-media endpoint to properly handle the file upload
app.post('/upload-media', async (req, res) => {
    try {
        const uploadUrl = `https://graph.facebook.com/${config.VERSION}/${config.PHONE_NUMBER_ID}/media`;
        
        // Read the image file - updated to use new Sprout Bot official image
        const imagePath = path.join(__dirname, 'public', 'images', 'Sprout bot official.png');
        const imageBuffer = await fs.readFile(imagePath);
        
        // Create form data with proper structure
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', 'image/png');
        form.append('file', imageBuffer, {
            filename: 'Sprout bot official.png',
            contentType: 'image/png',
            knownLength: imageBuffer.length
        });

        console.log('Uploading media to WhatsApp...', {
            url: uploadUrl,
            fileSize: imageBuffer.length,
            headers: form.getHeaders()
        });

        const uploadResponse = await axios({
            method: 'POST',
            url: uploadUrl,
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${config.TOKEN}`,
                'Content-Length': form.getLengthSync()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            data: form
        });

        console.log('Media upload response:', uploadResponse.data);

        if (!uploadResponse.data || !uploadResponse.data.id) {
            throw new Error('Invalid media upload response: missing media ID');
        }

        res.json({
            success: true,
            data: {
                id: uploadResponse.data.id
            }
        });
    } catch (error) {
        console.error('Media upload error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            config: error.config
        });
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// Add static routes for serving files
app.use('/images', express.static('public/images'));
app.use('/responses.json', express.static('public/responses.json'));

// Place static file serving AFTER all API routes
app.use(express.static('public'));

// Start server
const PORT = config.PORT;
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
   - Phone Number ID: ${config.PHONE_NUMBER_ID}
   - API Version: ${config.VERSION}
   - Token Present: ${!!config.TOKEN}

🔍 Test URLs:
   - Health: http://localhost:${PORT}/health
   - Test Message: http://localhost:${PORT}/test-message
   - Messages: http://localhost:${PORT}/messages
=========================================
`);
});
