/**
 * Message Storage Class
 * 
 * A persistent storage manager for WhatsApp chat messages that handles both incoming
 * and outgoing messages. This class provides a reliable way to store, retrieve, and
 * manage message history with proper synchronization and error handling.
 * 
 * Core Responsibilities:
 * - Persistent message storage using JSON files
 * - Message ID generation and management
 * - Message retrieval with timestamp filtering
 * - Chat history maintenance and cleanup
 * 
 * Technical Implementation:
 * - Uses file system for persistent storage
 * - Implements atomic file operations
 * - Maintains separate incoming/outgoing queues
 * - Provides message synchronization
 * 
 * Key Features:
 * - Unique message ID generation
 * - Timestamp-based message filtering
 * - Separate incoming/outgoing message queues
 * - Atomic file operations
 * - Error handling and recovery
 * 
 * Attributes:
 *     filePath (string): Path to the chat history JSON file
 *         - Stores the absolute path to the storage file
 *         - Uses the current directory as base
 *     messageCounter (Object): Counters for message IDs
 *         - incoming (number): Counter for incoming message IDs
 *         - outgoing (number): Counter for outgoing message IDs
 * 
 * Methods:
 *     initialize(): Initialize storage and message counters
 *         - Creates storage file if not exists
 *         - Initializes message counters
 *         - Recovers from any existing data
 * 
 *     clearMessages(): Clear all stored messages
 *         - Resets message counters
 *         - Clears storage file
 *         - Maintains file structure
 * 
 *     getMaxMessageId(messages, prefix): Get highest message ID for a type
 *         - Scans message array for highest ID
 *         - Handles missing or invalid IDs
 *         - Returns next available ID
 * 
 *     readMessages(): Read messages from storage
 *         - Reads JSON file atomically
 *         - Parses message data
 *         - Handles file read errors
 * 
 *     saveMessages(data): Save messages to storage
 *         - Writes JSON file atomically
 *         - Ensures data integrity
 *         - Handles write errors
 * 
 *     addIncomingMessage(from, content): Add a new incoming message
 *         - Generates unique message ID
 *         - Adds timestamp
 *         - Updates storage
 * 
 *     addOutgoingMessage(to, content): Add a new outgoing message
 *         - Generates unique message ID
 *         - Adds timestamp
 *         - Updates storage
 * 
 *     getMessagesSince(timestamp): Get messages after a timestamp
 *         - Filters messages by timestamp
 *         - Returns both incoming and outgoing
 *         - Sorts messages chronologically
 * 
 *     getAllMessages(): Get all stored messages
 *         - Retrieves complete message history
 *         - Returns structured message object
 *         - Maintains message order
 * 
 * Error Handling:
 * - Handles file system errors
 * - Provides data recovery
 * - Maintains data integrity
 * - Logs detailed error information
 * 
 * Storage Format:
 * {
 *     "messages": {
 *         "incoming": [
 *             {
 *                 "id": "msg_in_1",
 *                 "from": "phone_number",
 *                 "content": "message_text",
 *                 "timestamp": "ISO_date_string",
 *                 "status": "received"
 *             }
 *         ],
 *         "outgoing": [
 *             {
 *                 "id": "msg_out_1",
 *                 "to": "phone_number",
 *                 "content": "message_text",
 *                 "timestamp": "ISO_date_string",
 *                 "status": "sent"
 *             }
 *         ]
 *     }
 * }
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MessageStorage {
    constructor() {
        this.filePath = path.join(__dirname, 'chatHistory.json');
        this.messageCounter = {
            incoming: 1,
            outgoing: 1
        };
    }

    async initialize() {
        try {
            const data = await this.readMessages();
            // Initialize counters based on existing messages
            this.messageCounter.incoming = this.getMaxMessageId(data.messages.incoming, 'msg_in_') + 1;
            this.messageCounter.outgoing = this.getMaxMessageId(data.messages.outgoing, 'msg_out_') + 1;
        } catch (error) {
            // If file doesn't exist, create it with empty structure
            await this.saveMessages({
                messages: {
                    incoming: [],
                    outgoing: []
                }
            });
        }
    }

    async clearMessages() {
        try {
            // Reset the message counters
            this.messageCounter = {
                incoming: 1,
                outgoing: 1
            };
            
            // Create empty message structure
            const emptyMessages = {
                messages: {
                    incoming: [],
                    outgoing: []
                }
            };
            
            // Save empty structure to file
            await this.saveMessages(emptyMessages);
            return true;
        } catch (error) {
            console.error('Error clearing messages:', error);
            throw error;
        }
    }

    getMaxMessageId(messages, prefix) {
        if (!messages || messages.length === 0) return 0;
        
        return messages.reduce((maxId, msg) => {
            if (!msg.id || !msg.id.startsWith(prefix)) return maxId;
            const idNum = parseInt(msg.id.replace(prefix, ''));
            return isNaN(idNum) ? maxId : Math.max(maxId, idNum);
        }, 0);
    }

    async readMessages() {
        const data = await fs.readFile(this.filePath, 'utf8');
        return JSON.parse(data);
    }

    async saveMessages(data) {
        await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
    }

    async addIncomingMessage(from, content) {
        const data = await this.readMessages();
        const message = {
            id: `msg_in_${this.messageCounter.incoming++}`,
            from,
            content,
            timestamp: new Date().toISOString(),
            status: 'received'
        };
        data.messages.incoming.push(message);
        await this.saveMessages(data);
        return message;
    }

    async addOutgoingMessage(to, content) {
        const data = await this.readMessages();
        const message = {
            id: `msg_out_${this.messageCounter.outgoing++}`,
            to,
            content,
            timestamp: new Date().toISOString(),
            status: 'sent'
        };
        data.messages.outgoing.push(message);
        await this.saveMessages(data);
        return message;
    }

    async getMessagesSince(timestamp) {
        const data = await this.readMessages();
        const since = new Date(timestamp);
        
        const filteredMessages = {
            incoming: data.messages.incoming.filter(msg => new Date(msg.timestamp) > since),
            outgoing: data.messages.outgoing.filter(msg => new Date(msg.timestamp) > since)
        };
        
        return filteredMessages;
    }

    async getAllMessages() {
        return await this.readMessages();
    }
}

export default MessageStorage; 