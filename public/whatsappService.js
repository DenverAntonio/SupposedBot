class WhatsAppService {
    constructor() {
        this.envVars = {};
        this.recipientPhone = '264814067806';
        this.lastMessageTimestamp = new Date().toISOString();
        this.onMessageReceived = null;
        this.responses = null;
        this.lastSelectedIssue = null;
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
        const deptCode = issue.charAt(0);
        
        // Map department codes to ticket prefixes
        const prefixMap = {
            'C': 'CLD', // Cloud
            'I': 'INF', // Infrastructure
            'N': 'NET', // Network
            'S': 'SFT', // Software
            'P': 'PRT', // Printing
            'W': 'WRT'  // Warranty
        };

        const prefix = prefixMap[deptCode] || 'TKT'; // Default to TKT if department not found
        
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

    async saveTicket(ticketNumber, issue, status = 'Open') {
        try {
            console.log('Starting ticket save process...', {
                ticketNumber,
                issue,
                status
            });

            // Get current tickets
            const response = await fetch('/tickets.json');
            console.log('Fetched current tickets, status:', response.status);
            
            const data = await response.json();
            console.log('Current tickets data:', data);
            
            // Create new ticket
            const ticket = {
                ticketNumber,
                issue,
                status,
                createdAt: new Date().toISOString(),
                customerPhone: this.recipientPhone
            };
            
            console.log('Created new ticket object:', ticket);
            
            // Add new ticket
            data.tickets.push(ticket);
            
            // Save updated tickets
            console.log('Attempting to save updated tickets...');
            const saveResponse = await fetch('/save-ticket', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            console.log('Save ticket response status:', saveResponse.status);

            if (!saveResponse.ok) {
                const errorData = await saveResponse.json();
                console.error('Save ticket error response:', errorData);
                throw new Error(`Failed to save ticket: ${errorData.error || 'Unknown error'}`);
            }

            console.log('Ticket saved successfully:', ticket);
            return true;
        } catch (error) {
            console.error('Error in saveTicket:', error);
            console.error('Full error details:', {
                message: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    findResponse(message) {
        const lowerMessage = message.toLowerCase().trim();
        
        // Handle "yes" response for ticket creation
        if (lowerMessage === 'yes' && this.lastSelectedIssue) {
            const ticketNumber = this.generateTicketNumber(this.lastSelectedIssue);
            this.saveTicket(ticketNumber, this.lastSelectedIssue);
            const response = `Ticket created successfully!\n\nTicket Details:\nTicket Number: ${ticketNumber}\nIssue: ${this.lastSelectedIssue}\nStatus: Open\n\nWe will contact you shortly regarding this ticket.\n\nType #sprout to return to the main menu.`;
            this.lastSelectedIssue = null;
            return response;
        }

        // Only proceed if message starts with #sprout
        if (!lowerMessage.startsWith('#sprout')) {
            return null;
        }

        // Remove #sprout and trim spaces, handle both formats (#sproutp2 and #sprout p2)
        const command = lowerMessage.replace('#sprout', '').trim()
            .replace(/([a-z])(\d)/i, '$1 $2'); // Add space between letter and number if missing
        
        // If just #sprout was sent, show the main menu
        if (command === '') {
            this.lastSelectedIssue = null;
            return this.responses.Sprout.sprout.join('\n');
        }

        // Check for department selections (01-07)
        const deptMatch = command.match(/^0*([1-7])$/);
        if (deptMatch) {
            this.lastSelectedIssue = null;
            const deptNum = deptMatch[1].padStart(2, '0');
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
                return this.responses[dept][deptNum].join('\n');
            }
        }

        // Check for specific issue codes (C1, I4, P2, etc.) - Added 'P' to the pattern
        const issueMatch = command.match(/^([cinspw])\s*(\d+)$/i);
        if (issueMatch) {
            const [_, deptCode, issueNum] = issueMatch;
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

        // Only return help message if #sprout was used but command not recognized
        return "Available commands:\n#sprout - Show department menu\n#sprout [01-07] - Show department issues\n#sprout [C1-C10, I1-I10, P1-P10, etc.] - Select specific issue";
    }

    async handleIncomingMessage(message) {
        const response = this.findResponse(message);
        if (response) {  // Only send a response if findResponse returns something
            await this.sendMessage(response);
        }
    }

    async checkForNewMessages() {
        try {
            const timestamp = new Date().getTime();
            const response = await fetch(`/messages?since=${this.lastMessageTimestamp}&_=${timestamp}`, {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            const data = await response.json();
            console.log('Received messages:', data);

            if (data.messages && data.messages.length > 0) {
                data.messages.forEach(async message => {
                    if (message.from === this.recipientPhone) {
                        console.log('Processing message:', message);
                        const messageText = typeof message.text === 'object' ? message.text.body : message.text;
                        
                        // Handle the automated response
                        await this.handleIncomingMessage(messageText);
                        
                        // Call the original callback if it exists
                        if (this.onMessageReceived) {
                            this.onMessageReceived(messageText);
                        }
                    }
                });
                const latestMessage = data.messages[data.messages.length - 1];
                this.lastMessageTimestamp = latestMessage.timestamp;
            }
        } catch (error) {
            console.error('Error checking messages:', error);
        }
    }

    startMessagePolling(callback) {
        console.log('Starting message polling');
        this.onMessageReceived = callback;
        this.checkForNewMessages();
        setInterval(() => this.checkForNewMessages(), 5000);
    }
}

export default WhatsAppService; 