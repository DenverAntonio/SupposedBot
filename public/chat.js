import WhatsAppService from './whatsappService.js';

document.addEventListener('DOMContentLoaded', () => {
    const whatsapp = new WhatsAppService();
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatBox = document.getElementById('chat-box');

    // Function to add message to chat box
    function addMessageToChat(message, isSent = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        messageDiv.textContent = message;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Handle sending messages
    sendButton.addEventListener('click', async () => {
        const message = messageInput.value.trim();
        if (message) {
            try {
                await whatsapp.sendMessage(message);
                addMessageToChat(message, true);
                messageInput.value = '';
            } catch (error) {
                console.error('Failed to send message:', error);
            }
        }
    });

    // Handle Enter key
    messageInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const message = messageInput.value.trim();
            if (message) {
                try {
                    await whatsapp.sendMessage(message);
                    addMessageToChat(message, true);
                    messageInput.value = '';
                } catch (error) {
                    console.error('Failed to send message:', error);
                }
            }
        }
    });

    // Start polling for new messages
    whatsapp.startMessagePolling((message) => {
        addMessageToChat(message, false);
    });
}); 
