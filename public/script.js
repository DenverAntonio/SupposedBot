$(document).ready(function () {
    let botResponses;
    let ticketCounter = 1; // Initialize ticket counter

    // Load the JSON file
    $.getJSON('responses.json', function (data) {
        botResponses = data;
    });

    // Handle user input
    $('#sendBtn').click(function () {
        const userMessage = $('#userInput').val().trim().toLowerCase();
        if (!userMessage) return;

        // Display user message
        appendMessage('user', userMessage);

        // Determine bot response
        let botMessage = botResponses.default;

        // Special handling for "sprout" command
        if (userMessage === "sprout" && botResponses.Sprout && botResponses.Sprout.sprout) {
            botMessage = botResponses.Sprout.sprout.join('\n');
            console.log("Sprout response:", botMessage);
        } 
        // Handle department number inputs (01-07)
        else if (/^0[1-7]$/.test(userMessage)) {
            const department = botResponses[Object.keys(botResponses).find(key => {
                return botResponses[key][userMessage] && Array.isArray(botResponses[key][userMessage]);
            })];
            
            if (department && department[userMessage]) {
                botMessage = department[userMessage].join('\n');
                console.log("Department response:", botMessage);
            }
        } else {
            // Rest of your existing code for ticket handling
            const ticketPattern = /^[CINPSW][1-9][0-9]?$/i;
            
            if (ticketPattern.test(userMessage.toUpperCase())) {
                const ticket = generateTicket(userMessage.toUpperCase());
                botMessage = `Ticket generated successfully!\nTicket ID: ${ticket.id}\nIssue: ${ticket.issue}\nStatus: ${ticket.status}\nCreated: ${formatDateTime(ticket.created)}`;
                storeTicket(ticket);
            } else {
                for (const category in botResponses) {
                    if (botResponses[category][userMessage]) {
                        botMessage = botResponses[category][userMessage];
                        break;
                    }
                }
            }
        }

        // Display bot response
        setTimeout(() => {
            appendMessage('bot', botMessage);
        }, 500);

        $('#userInput').val(''); // Clear input field
    });

    function formatDateTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString([], {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function generateTicket(issueCode) {
        const departments = {
            'C': 'Cloud',
            'I': 'Infrastructure',
            'N': 'Network',
            'P': 'Printing',
            'S': 'Software',
            'W': 'Warranty'
        };

        const dept = departments[issueCode.charAt(0)];
        const ticketId = `${dept.substring(0, 3).toUpperCase()}-${String(ticketCounter).padStart(4, '0')}`;
        ticketCounter++;

        return {
            id: ticketId,
            issue: findIssueDescription(issueCode),
            status: 'Open',
            created: new Date().toISOString(),
            issueCode: issueCode
        };
    }

    function findIssueDescription(issueCode) {
        // Map department codes to their response.json keys
        const deptMap = {
            'C': 'Cloud Department',
            'I': 'Infrastructure Department',
            'N': 'Network and Security Department',
            'P': 'Printing Department',
            'S': 'Software Department',
            'W': 'Warranty Department'
        };

        const dept = deptMap[issueCode.charAt(0)];
        const deptNumber = Object.keys(botResponses[dept])[0];
        const issues = botResponses[dept][deptNumber];
        
        return issues.find(issue => issue.startsWith(issueCode)) || 'Unknown Issue';
    }

    function storeTicket(ticket) {
        const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
        tickets.push(ticket);
        localStorage.setItem('tickets', JSON.stringify(tickets));
    }

    function appendMessage(sender, message) {
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        const formattedMessage = message.replace(/\n/g, '<br>');
        $('#messages').append(`
            <div class="message ${sender}">
                <div class="message-content">${formattedMessage}</div>
                <div class="timestamp">${timestamp}</div>
            </div>
        `);
        $('#messages').scrollTop($('#messages')[0].scrollHeight);
    }
});
