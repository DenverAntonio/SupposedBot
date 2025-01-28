# WhatsApp Support Ticket System

A WhatsApp-based support ticket system that allows users to create and manage support tickets through WhatsApp messages.

## System Architecture

### Core Components

1. **Server (server.js)**
   - Main Express.js server handling HTTP requests and WhatsApp webhook
   - Manages message routing and ticket storage
   - Serves static files and handles API endpoints
   - Provides environment configuration and health checks
   - Implements webhook verification for WhatsApp API
   - Handles message sending and receiving through WhatsApp API
   - Manages media uploads and image sending
   - Provides comprehensive error handling and logging

2. **WhatsApp Service (whatsappService.js)**
   - Core service handling WhatsApp message processing
   - Implements ticket creation and management
   - Handles command parsing and response generation
   - Manages message polling and real-time updates
   - Generates unique ticket numbers with department prefixes
   - Maintains chat history and message synchronization
   - Handles image sending and media management
   - Provides automated greeting responses with logo

3. **Frontend Interface (whatsapp.html)**
   - Web interface for testing and monitoring
   - Displays sent/received messages in real-time
   - Shows ticket information and status
   - Provides manual message sending capability
   - Implements grid-based responsive layout
   - Features chat history and ticket management controls
   - Includes image sending functionality
   - Provides real-time connection status updates

4. **Message Storage (messageStorage.js)**
   - Handles persistent storage of chat messages
   - Manages message IDs and timestamps
   - Provides message filtering and retrieval
   - Implements chat history clearing functionality
   - Maintains separate incoming and outgoing message queues
   - Ensures message synchronization across sessions
   - Implements atomic file operations
   - Provides error recovery mechanisms

### Supporting Files

5. **Configuration Files**
   - `sprout_commands.json`: Contains all support categories and responses
     - Defines department structure and issue codes
     - Stores response templates for each issue type
     - Maintains menu structure for navigation
   - `tickets.json`: Stores ticket data
     - Contains ticket history and status
     - Maintains customer information
     - Tracks ticket timestamps and updates
   - `.env`: Environment variables
     - WhatsApp API tokens and configuration
     - Phone number IDs and version info
     - Webhook verification tokens
     - System configuration settings

6. **Static Assets**
   - `styles.css`: Custom UI styling
     - WhatsApp-inspired design
     - Responsive grid layout
     - Message bubble styling
     - Animation effects
   - `images/`: Image assets
     - Sprout Bot official logo
     - Background images
     - UI elements
   - `BG_Images/`: Interface backgrounds
     - Chat background patterns
     - Visual elements

## File Structure
```
├── server.js                # Main server application
├── public/
│   ├── whatsapp.html       # Web interface
│   ├── whatsappService.js  # WhatsApp service implementation
│   ├── messageStorage.js   # Message storage handler
│   ├── sprout_commands.json# Command definitions
│   ├── tickets.json        # Ticket storage
│   ├── chatHistory.json    # Message history
│   ├── styles.css          # Custom UI styling
│   ├── images/            # Bot and logo images
│   └── BG_Images/         # Interface background images
├── .env                    # Environment variables
└── package.json           # Project configuration
```

## API Endpoints

### WhatsApp Integration
- `/webhook`: WhatsApp webhook endpoint (GET/POST)
- `/send-message`: Send text messages
- `/send-image`: Send images via WhatsApp
- `/upload-media`: Upload media to WhatsApp servers

### Ticket Management
- `/tickets`: Retrieve all tickets
- `/save-ticket`: Create/update tickets
- `/api/clear-tickets`: Clear ticket history
- `/check-tickets`: Get ticket status

### Message Management
- `/messages`: Get message history
- `/api/clear-chat-history`: Clear chat history
- `/debug/chat-history`: Debug message history

### System Management
- `/health`: System health check
- `/environment`: Get environment variables
- `/test-message`: Test message sending

## Features

### Core Functionality
- Real-time message synchronization
- Automated ticket generation
- Department-based issue categorization
- Message history management
- Ticket status tracking
- Web-based monitoring interface
- Responsive grid layout
- Automatic message polling

### Enhanced Features
- Image sending capability
- Automated greeting responses
- Real-time connection status
- Message sound notifications
- Atomic file operations
- Error recovery mechanisms
- Detailed system logging
- Security validations

## Setup and Configuration

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
- WHATSAPP_TOKEN
- PHONE_NUMBER_ID
- VERSION
- WEBHOOK_VERIFY_TOKEN
- RECIPIENT_PHONE
- PORT (optional, defaults to 3001)

3. Start the server:
```bash
npm start
```
