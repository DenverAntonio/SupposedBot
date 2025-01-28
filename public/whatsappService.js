/**
 * WhatsApp Service Class
 * 
 * A comprehensive service class that handles all WhatsApp-related functionality for the support ticket system.
 * This class serves as the core interface between the frontend and the WhatsApp Business API,
 * managing message flows, ticket generation, and automated responses.
 * 
 * Core Responsibilities:
 * - Message sending and receiving through WhatsApp Business API
 * - Ticket generation and management with department-based prefixes
 * - Automated response handling for greetings and support requests
 * - Image sending capability (Sprout Bot official logo)
 * - Real-time chat history management and synchronization
 * 
 * Key Features:
 * - Automatic greeting detection and response with logo
 * - Support keyword detection and menu generation
 * - Department-based ticket creation with unique numbering
 * - Real-time message polling and UI updates
 * - Message history tracking and persistence
 * - Error handling and logging
 * 
 * Technical Implementation:
 * - Uses WhatsApp Business API for message handling
 * - Implements polling mechanism for real-time updates
 * - Manages state through class properties
 * - Handles file uploads for image sending
 * - Provides error handling and logging
 * 
 * Attributes:
 *     envVars (Object): Environment variables for WhatsApp API configuration
 *         - AccessToken: WhatsApp API authentication token
 *         - PhoneNumberID: WhatsApp Business Account phone number ID
 *         - Version: API version being used
 *     recipientPhone (string): Default recipient phone number for messages
 *     lastMessageTimestamp (string): ISO timestamp of last received message
 *     onMessageReceived (function): Callback for message reception and UI updates
 *     responses (Object): Loaded response templates from sprout_commands.json
 *     lastSelectedIssue (string): Last issue selected by user for ticket creation
 *     ticketCounter (number): Counter for generating unique ticket numbers
 *     processedMessageIds (Set): Set to track processed message IDs
 *     recentlyProcessedMessages (Map): Map to track processed message contents to handle race conditions
 * 
 * Methods:
 *     initialize(): Initialize the service and load environment variables
 *         - Fetches environment configuration
 *         - Validates API tokens
 *         - Loads chat history
 * 
 *     loadChatHistory(): Load and display existing chat history
 *         - Retrieves messages from storage
 *         - Sorts by timestamp
 *         - Updates UI through callback
 * 
 *     sendMessage(message): Send a text message to WhatsApp
 *         - Validates service initialization
 *         - Sends message through API
 *         - Handles errors and logging
 * 
 *     loadResponses(): Load response templates from sprout_commands.json
 *         - Loads department and issue definitions
 *         - Caches responses for quick access
 * 
 *     generateTicketNumber(issue): Generate a unique ticket number with department prefix
 *         - Creates department-specific prefix
 *         - Includes timestamp in ticket number
 *         - Handles special cases (e.g., "Other" category)
 * 
 *     saveTicket(ticket): Save a ticket to storage with duplicate checking
 *         - Checks for existing tickets
 *         - Prevents duplicates
 *         - Maintains ticket history
 * 
 *     handleUserInput(message): Process user input and generate appropriate responses
 *         - Detects greetings and keywords
 *         - Manages ticket creation flow
 *         - Handles menu navigation
 * 
 *     handleIncomingMessage(message): Handle incoming WhatsApp messages and generate responses
 *         - Processes incoming messages
 *         - Generates appropriate responses
 *         - Manages conversation flow
 * 
 *     checkForNewMessages(): Poll for new messages and process them
 *         - Implements polling mechanism
 *         - Updates UI with new messages
 *         - Maintains message order
 * 
 *     startMessagePolling(callback): Start the message polling service with UI updates
 *         - Initializes polling interval
 *         - Sets up UI callback
 *         - Manages real-time updates
 * 
 *     sendImage(): Send the Sprout Bot official logo image with caption
 *         - Handles image upload to WhatsApp
 *         - Manages media IDs
 *         - Sends image messages
 * 
 * Error Handling:
 * - Validates API responses
 * - Provides detailed error logging
 * - Implements retry mechanisms
 * - Graceful degradation on failures
 */

class WhatsAppService {
    constructor() {
        this.envVars = {};
        this.recipientPhone = this.envVars.RecipientPhone || '264814067806';
        this.lastMessageTimestamp = new Date().toISOString();
        this.onMessageReceived = null;
        this.responses = null;
        this.lastSelectedIssue = null;
        this.ticketCounter = 1;
        this.processedMessageIds = new Set();
        this.recentlyProcessedMessages = new Map();
        this.loadResponses();
        console.log('WhatsAppService initialized with recipient:', this.recipientPhone);
    }

    async initialize() {
        try {
            console.log('Starting WhatsApp service initialization...');
            const response = await fetch('/environment');
            
            console.log('Environment endpoint response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.envVars = await response.json();
            console.log('Received environment variables:', {
                hasToken: !!this.envVars.AccessToken,
                tokenLength: this.envVars.AccessToken ? this.envVars.AccessToken.length : 0,
                phoneNumberId: this.envVars.PhoneNumberID,
                version: this.envVars.Version
            });
            
            // Add validation
            if (!this.envVars.AccessToken) {
                console.error('Environment loaded but no token found:', this.envVars);
                throw new Error('No access token available');
            }

            // Load chat history after environment is initialized
            await this.loadChatHistory();
            
            return true;
        } catch (error) {
            console.error('Error initializing WhatsApp service:', error);
            console.error('Full error details:', {
                message: error.message,
                stack: error.stack,
                envVars: this.envVars
            });
            return false;
        }
    }

    async loadChatHistory() {
        try {
            const response = await fetch('/debug/chat-history');
            if (!response.ok) {
                throw new Error('Failed to load chat history');
            }
            
            const chatHistory = await response.json();
            console.log('Loaded chat history:', chatHistory);

            // Process incoming and outgoing messages separately
            const allMessages = [];

            // Add incoming messages (user messages)
            chatHistory.messages.incoming.forEach(msg => {
                allMessages.push({
                    ...msg,
                    isFromBot: false,
                    timestamp: msg.timestamp
                });
            });

            // Add outgoing messages (bot responses)
            chatHistory.messages.outgoing.forEach(msg => {
                allMessages.push({
                    ...msg,
                    isFromBot: true,
                    timestamp: msg.timestamp,
                    from: msg.to // normalize the 'from' field for sorting
                });
            });

            // Sort messages by timestamp
            allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Display each message in chronological order
            allMessages.forEach(msg => {
                if (this.onMessageReceived) {
                    const content = msg.content;
                    // Only show bot messages for outgoing messages
                    const isBot = msg.to === this.recipientPhone;
                    this.onMessageReceived(content, isBot);
                }
            });

            // Update last message timestamp
            if (allMessages.length > 0) {
                this.lastMessageTimestamp = allMessages[allMessages.length - 1].timestamp;
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    async sendMessage(message) {
        try {
            if (!this.envVars.AccessToken) {
                throw new Error('WhatsApp service not properly initialized - missing token');
            }

            console.log('Attempting to send message:', {
                messageLength: message.length,
                to: this.recipientPhone,
                hasToken: !!this.envVars.AccessToken,
                tokenLength: this.envVars.AccessToken.length
            });

            const response = await fetch('/send-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    to: this.recipientPhone
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Send message error:', errorData);
                throw new Error(errorData.error || 'Failed to send message');
            }

            const data = await response.json();
            
            // Show the message in UI and mark it as processed
            if (this.onMessageReceived) {
                this.onMessageReceived(message, true);
            }
            if (data.data?.messages?.[0]?.id) {
                this.processedMessageIds.add(data.data.messages[0].id);
            }
            
            console.log('Message sent successfully:', data);
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async loadResponses() {
        try {
            const response = await fetch('/sprout_commands.json');
            this.responses = await response.json();
            console.log('Responses loaded:', this.responses);
        } catch (error) {
            console.error('Error loading responses:', error);
        }
    }

    generateTicketNumber(issue) {
        // Extract the department code from the issue (first letter of the issue code)
        let deptCode;
        let prefix;

        // Special handling for "Other" category
        if (issue.startsWith('Greetings')) {
            prefix = 'OTR';
            issue = 'None Specified'; // Update the issue text for Other category
        } else {
            deptCode = issue.charAt(0);
            // Map department codes to ticket prefixes
            const prefixMap = {
                'C': 'CLD', // Cloud
                'I': 'INF', // Infrastructure
                'N': 'NET', // Network
                'S': 'SFT', // Software
                'P': 'PRT', // Printing
                'W': 'WRT'  // Warranty
            };
            prefix = prefixMap[deptCode] || 'TKT';
        }
        
        // Get current date and time
        const now = new Date();
        
        // Format time as HHMMSS
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const timeString = `${hours}${minutes}${seconds}`;
        
        // Format date as DDMM
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const dateString = `${day}${month}`;
        
        return `${prefix}-${timeString}-${dateString}`;
    }

    async saveTicket(ticket) {
        try {
            console.log('Saving ticket:', ticket);
            
            // First get existing tickets
            const getResponse = await fetch('/tickets');
            let existingTickets = { tickets: [] };
            
            if (getResponse.ok) {
                existingTickets = await getResponse.json();
                console.log('Existing tickets:', existingTickets);
            }

            // Check if ticket already exists
            const isDuplicate = existingTickets.tickets.some(
                existingTicket => existingTicket.ticketNumber === ticket.ticketNumber
            );

            if (isDuplicate) {
                console.log('Duplicate ticket detected:', ticket.ticketNumber);
                return true; // Return success but don't save duplicate
            }

            // Add new ticket
            const updatedTickets = {
                tickets: [...existingTickets.tickets, ticket]
            };

            console.log('Saving updated tickets:', updatedTickets);

            // Save all tickets
            const saveResponse = await fetch('/save-ticket', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedTickets)
            });
            
            if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                console.error('Failed to save ticket:', errorData);
                throw new Error(`Failed to save ticket: ${errorData.error || 'Unknown error'}`);
            }

            const result = await saveResponse.json();
            console.log('Save ticket response:', result);
            return true;
        } catch (error) {
            console.error('Error saving ticket:', error);
            throw error;
        }
    }

    generateTicket(issueCode) {
        const departments = {
            'C': 'Cloud',
            'I': 'Infrastructure',
            'N': 'Network',
            'P': 'Printing',
            'S': 'Software',
            'W': 'Warranty'
        };

        const dept = departments[issueCode.charAt(0)];
        const ticketId = `${dept.substring(0, 3).toUpperCase()}-${String(this.ticketCounter).padStart(4, '0')}`;
        this.ticketCounter++;

        return {
            id: ticketId,
            issue: this.findIssueDescription(issueCode),
            status: 'Open',
            created: new Date().toISOString(),
            issueCode: issueCode
        };
    }

    findIssueDescription(issueCode) {
        const deptMap = {
            'C': 'Cloud Department',
            'I': 'Infrastructure Department',
            'N': 'Network and Security Department',
            'P': 'Printing Department',
            'S': 'Software Department',
            'W': 'Warranty Department'
        };

        const dept = deptMap[issueCode.charAt(0)];
        const deptNumber = Object.keys(this.responses[dept])[0];
        const issues = this.responses[dept][deptNumber];
        
        return issues.find(issue => issue.startsWith(issueCode)) || 'Unknown Issue';
    }

    // Update greetings at class level
    greetingStarters = [
        'hi',
        'hello',
        'greetings',
        'how do you do',
        'good morning',
        'good evening',
        'good afternoon',
        'good day'  // Added good day
    ];

    async handleUserInput(message, messageId = null) {
        const lowerMessage = message.toLowerCase().trim();
        
        // If this is a greeting, show it in the UI here
        if (this.isGreeting(message) && this.onMessageReceived) {
            this.onMessageReceived(message, false);
        }
        
        // Create a unique key for this message
        const messageKey = `${lowerMessage}_${Date.now()}`;
        
        // If we've recently processed this exact message content, skip it
        if (this.recentlyProcessedMessages.has(lowerMessage)) {
            const timestamp = this.recentlyProcessedMessages.get(lowerMessage);
            if (Date.now() - timestamp < 10000) {
                console.log('Skipping recently processed message:', lowerMessage);
                return null;
            }
        }

        // First check if message starts with a greeting
        const startsWithGreeting = this.greetingStarters.some(greeting => 
            lowerMessage.startsWith(greeting)
        );

        // Check for support keywords
        const containsSupportKeyword = this.responses.support_keywords.some(keyword => 
            lowerMessage.includes(keyword.toLowerCase())
        );

        // Mark message as processed
        this.recentlyProcessedMessages.set(lowerMessage, Date.now());

        // Case 1: Message starts with greeting and contains support keyword
        if (startsWithGreeting && containsSupportKeyword) {
            try {
                // Send bot image first
                await this.sendImage();
                // Then send support greeting
                await this.sendMessage(this.responses.support_greeting);
                return null;
            } catch (error) {
                console.error('Error sending greeting image:', error);
                // Even if image fails, still send support greeting
                await this.sendMessage(this.responses.support_greeting);
                return null;
            }
        }

        // Case 2: Message starts with greeting only
        if (startsWithGreeting) {
            try {
                // Send bot image first
                await this.sendImage();
                
                // Then send appropriate greeting response
                for (const [greeting, response] of Object.entries(this.responses.greetings)) {
                    if (lowerMessage === greeting.toLowerCase()) {
                        await this.sendMessage(response);
                        return null;
                    }
                }
                
                // For partial greetings
                const defaultResponse = "Hi there! Type #sprout to see our support menu.";
                await this.sendMessage(defaultResponse);
                return null;
            } catch (error) {
                console.error('Error sending greeting image:', error);
                return "Hi there! Type #sprout to see our support menu.";
            }
        }

        // Case 3: Message contains support keyword only (no greeting)
        if (containsSupportKeyword && !lowerMessage.startsWith('#sprout')) {
            return this.responses.support_greeting;
        }

        // Clean up old entries from recentlyProcessedMessages
        const now = Date.now();
        for (const [key, timestamp] of this.recentlyProcessedMessages.entries()) {
            if (now - timestamp > 10000) {
                this.recentlyProcessedMessages.delete(key);
            }
        }

        // Handle "yes" response for ticket creation
        if (lowerMessage === 'yes' && this.lastSelectedIssue) {
            const ticketNumber = this.generateTicketNumber(this.lastSelectedIssue);
            // Special handling for Other category tickets
            const issueText = this.lastSelectedIssue.startsWith('Greetings') ? 'None Specified' : this.lastSelectedIssue;
            await this.saveTicket({
                ticketNumber,
                issue: issueText,
                status: 'Open',
                createdAt: new Date().toISOString(),
                customerPhone: this.recipientPhone
            });
            const displayIssue = issueText === 'None Specified' ? 'Other - None Specified' : issueText;
            const response = `Ticket created successfully!\n\nTicket Details:\nTicket Number: ${ticketNumber}\nIssue: ${displayIssue}\nStatus: Open\n\nWe will contact you shortly regarding this ticket.\n\nType #sprout to return to the main menu.`;
            this.lastSelectedIssue = null;
            return response;
        }

        // Check for farewells
        for (const [farewell, response] of Object.entries(this.responses.farewells)) {
            if (lowerMessage.includes(farewell.toLowerCase())) {
                return response;
            }
        }

        // Check for support keywords if message doesn't start with #sprout
        if (!lowerMessage.startsWith('#sprout')) {
            // Check if the message contains any support keywords
            const containsSupportKeyword = this.responses.support_keywords.some(keyword => 
                lowerMessage.includes(keyword.toLowerCase())
            );
            
            if (containsSupportKeyword) {
                return this.responses.support_greeting;
            }
            return null;
        }

        // Remove #sprout and trim spaces
        const command = lowerMessage.replace('#sprout', '').trim();
        
        // If just #sprout was sent, show the main menu
        if (command === '') {
            this.lastSelectedIssue = null;
            return this.responses.Sprout.sprout.join('\n');
        } 
        
        // Check for department selections (must be exactly 01-07)
        const deptMatch = command.match(/^(0[1-7])$/);
        if (deptMatch) {
            const deptNum = deptMatch[1];
            const departments = {
                '01': 'Cloud Department',
                '02': 'Infrastructure Department',
                '03': 'Network and Security Department',
                '04': 'Software Department',
                '05': 'Printing Department',
                '06': 'Warranty Department',
                '07': 'Other'
            };
            
            const dept = departments[deptNum];
            if (dept && this.responses[dept] && this.responses[dept][deptNum]) {
                // Special handling for "Other" category
                if (deptNum === '07') {
                    const otherMessage = this.responses[dept][deptNum][0];
                    this.lastSelectedIssue = otherMessage;
                    return `${otherMessage}\n\nWould you like to create a ticket for this issue? Reply with "yes" to proceed.`;
                }
                this.lastSelectedIssue = null;
                return this.responses[dept][deptNum].join('\n');
            }
        }

        // Check for specific issue codes (C1, I4, P2, etc.)
        const issueMatch = command.match(/^([cinspw])(\d+)$/i);
        if (issueMatch) {
            const [_, deptCode, issueNum] = issueMatch;
            // Validate issue number is between 1 and 10
            const num = parseInt(issueNum);
            if (num >= 1 && num <= 10) {
                const departments = {
                    'C': 'Cloud Department',
                    'I': 'Infrastructure Department',
                    'N': 'Network and Security Department',
                    'S': 'Software Department',
                    'P': 'Printing Department',
                    'W': 'Warranty Department'
                };

                const dept = departments[deptCode.toUpperCase()];
                if (dept) {
                    const deptResponses = this.responses[dept];
                    const deptKey = Object.keys(deptResponses)[0];
                    const issues = deptResponses[deptKey];
                    
                    const issue = issues.find(i => i.startsWith(`${deptCode.toUpperCase()}${issueNum}`));
                    if (issue) {
                        this.lastSelectedIssue = issue;
                        return `Selected issue:\n${issue}\n\nWould you like to create a ticket for this issue? Reply with "yes" to proceed.`;
                    }
                }
            }
        }

        // Return help message for any invalid commands
        return "Available commands:\n#sprout - Show department menu\n#sprout [01-07] - Show department issues\n#sprout [C1-C10, I1-I10, P1-P10, etc.] - Select specific issue";
    }

    async handleIncomingMessage(message) {
        // Process the message and get response
        const response = await this.handleUserInput(message);
        
        // Only send a response if handleUserInput returns something
        // and it's not a greeting (greetings are handled in handleUserInput)
        if (response && !this.isGreeting(message)) {
            await this.sendMessage(response);
        }
    }

    isGreeting(message) {
        const lowerMessage = message.toLowerCase().trim();
        // Check if it's an exact match with any greeting
        return Object.keys(this.responses.greetings).some(greeting => 
            lowerMessage === greeting.toLowerCase()
        ) || this.greetingStarters.some(greeting => 
            lowerMessage.startsWith(greeting)
        );
    }

    async checkForNewMessages() {
        try {
            const response = await fetch(`/messages?since=${encodeURIComponent(this.lastMessageTimestamp)}`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            const data = await response.json();
            console.log('Received messages:', data);

            if (data.messages && data.messages.length > 0) {
                for (const message of data.messages) {
                    // Skip if we've already processed this message
                    if (this.processedMessageIds.has(message.id)) {
                        continue;
                    }

                    // Check if the message is from the current user's phone number
                    const isIncoming = message.from === this.recipientPhone;
                    const isOutgoing = message.to === this.recipientPhone;
                    
                    // Only process incoming messages
                    if (isIncoming && !isOutgoing) {
                        const messageText = typeof message.text === 'object' ? message.text.body : message.text;
                        console.log('Processing incoming message:', messageText);
                        
                        // Show the incoming message in the UI only if it's not a greeting
                        // Greetings will be displayed through handleUserInput
                        if (this.onMessageReceived && !this.isGreeting(messageText)) {
                            this.onMessageReceived(messageText, false);
                        }
                        
                        // Handle the message and generate response
                        await this.handleIncomingMessage(messageText);
                    }

                    // Mark message as processed
                    this.processedMessageIds.add(message.id);
                }
                
                // Update timestamp after processing all messages
                const latestMessage = data.messages[data.messages.length - 1];
                this.lastMessageTimestamp = latestMessage.timestamp;

                // Clean up old message IDs (keep only last 1000)
                if (this.processedMessageIds.size > 1000) {
                    const idsArray = Array.from(this.processedMessageIds);
                    this.processedMessageIds = new Set(idsArray.slice(-1000));
                }
            }
        } catch (error) {
            console.error('Error checking messages:', error);
        }
    }

    startMessagePolling(callback) {
        console.log('Starting message polling');
        this.onMessageReceived = callback;
        
        // Load initial chat history before starting polling
        this.loadChatHistory().then(() => {
            // Start polling for new messages
            this.checkForNewMessages(); // Initial check
            setInterval(() => this.checkForNewMessages(), 5000);
        });
    }

    async sendImage(imageUrl) {
        try {
            if (!this.envVars.AccessToken) {
                throw new Error('WhatsApp service not properly initialized - missing token');
            }

            console.log('Uploading image to WhatsApp...');
            
            // First upload the image
            const uploadResponse = await fetch('/upload-media', {
                method: 'POST'
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Failed to upload image');
            }

            const uploadData = await uploadResponse.json();
            console.log('Image upload response:', uploadData);

            if (!uploadData.success || !uploadData.data || !uploadData.data.id) {
                throw new Error('Invalid upload response: missing media ID');
            }

            // Then send the message with the uploaded media ID
            const response = await fetch('/send-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: this.recipientPhone,
                    media_id: uploadData.data.id,
                    caption: "Sprout - Green Enterprise Solutions Support"
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send image');
            }

            const data = await response.json();
            console.log('Image sent successfully:', data);
            return data;
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }
}

export default WhatsAppService; 