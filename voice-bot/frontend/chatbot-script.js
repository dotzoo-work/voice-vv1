// WordPress Plugin version - Dr. Meenakshi Tomar Dental Chatbot
const API_BASE_URL = 'http://localhost:8000';
const OFFICE_PHONE = '(425) 775-5162';

// Transcript Collection Variables
let chatHistory = [];
let messageCount = 0;
let userDetails = null;

// HTML escape function for security
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

(function($) {
    $(document).ready(function() {
        console.log("Dr. Meenakshi Tomar Chat interface initialized");
        console.log("API URL:", API_BASE_URL);

        let sessionId = null;
        
        // Chat close event listener
        window.addEventListener('beforeunload', function() {
            handleChatbotClose();
        });

        function scrollToBottom() {
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }

        function addUserMessage(message) {
            const timestamp = new Date().toLocaleString();
            
            // Add to chat history
            chatHistory.push({
                sender: "User",
                text: message,
                timestamp: timestamp
            });
            
            const $messageDiv = $('<div class="message user"></div>');
            const $avatarDiv = $('<div class="message-avatar"></div>');
            const $iconDiv = $('<i class="fas fa-user"></i>');
            const $contentDiv = $('<div class="message-content"></div>');
            const $textDiv = $('<div class="message-text"></div>');
            
            $avatarDiv.append($iconDiv);
            $textDiv.text(message);
            $contentDiv.append($textDiv);
            $messageDiv.append($avatarDiv).append($contentDiv);
            
            $("#chatMessages").append($messageDiv);
            scrollToBottom();
        }
        
        // Make functions globally available for voice modal
        window.addUserMessage = addUserMessage;



        function addBotMessage(message) {
            const timestamp = new Date().toLocaleString();
            
            // Add to chat history
            chatHistory.push({
                sender: "AI",
                text: message,
                timestamp: timestamp
            });
            
            // Check word count for Read More functionality
            const words = message.split(' ');
            const wordCount = words.length;
            const shouldTruncate = wordCount > 40;
            
            let displayMessage = message;
            if (shouldTruncate) {
                const truncatedWords = words.slice(0, 40);
                displayMessage = truncatedWords.join(' ') + '...';
            }
            
            // Parse markdown
            const finalMessage = marked.parse(displayMessage);
            const fullMessage = marked.parse(message);
            
            // Function to make links open in new tab
            function makeLinksOpenInNewTab(htmlContent) {
                return htmlContent.replace(/<a /g, '<a target="_blank" ');
            }
            
            const $messageDiv = $('<div class="message"></div>');
            const $avatarDiv = $('<div class="message-avatar"></div>');
            const $avatarImg = $('<img src="https://res.cloudinary.com/dzryajl43/image/upload/v1756100317/logo-5_kzbd34.png" alt="Dr. Meenakshi Tomar" class="bot-avatar-img">');
            const $contentDiv = $('<div class="message-content"></div>');
            const $textDiv = $('<div class="message-text"></div>');
            
            $avatarDiv.append($avatarImg);
            $textDiv.html(makeLinksOpenInNewTab(finalMessage));
            
            // Add Read More button if message is truncated
            if (shouldTruncate) {
                const $readMoreBtn = $('<button class="read-more-btn" style="background:none;border:none;color:#4f46e5;cursor:pointer;font-size:12px;margin-top:5px;text-decoration:underline;">Read More</button>');
                
                $readMoreBtn.on('click', function() {
                    const isExpanded = $(this).text() === 'Read Less';
                    if (isExpanded) {
                        $textDiv.html(makeLinksOpenInNewTab(finalMessage));
                        $(this).text('Read More');
                    } else {
                        $textDiv.html(makeLinksOpenInNewTab(fullMessage));
                        $(this).text('Read Less');
                    }
                    scrollToBottom();
                });
                
                $textDiv.append($readMoreBtn);
            }
            
            $contentDiv.append($textDiv);
            $messageDiv.append($avatarDiv).append($contentDiv);
            
            $("#chatMessages").append($messageDiv);
            scrollToBottom();
        }
        
        // Make functions globally available for voice modal
        window.addBotMessage = addBotMessage;

        function showTypingIndicator() {
            const typingHtml = `
                <div class="message" id="typingIndicator">
                    <div class="message-avatar">
                        <img src="https://res.cloudinary.com/dzryajl43/image/upload/v1756100317/logo-5_kzbd34.png" class="bot-avatar-img">
                    </div>
                    <div class="message-content">
                        <div class="typing-dots">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                </div>
            `;
            $("#chatMessages").append(typingHtml);
            scrollToBottom();
        }

        function hideTypingIndicator() {
            $("#typingIndicator").remove();
        }
        
        // Test function - can be called from console
        window.testPopup = function() {
            showUserDetailsPopup();
        };
        
        function showUserDetailsPopup() {
            const popupHtml = `
                <div id="userDetailsPopup" class="chat-popup-overlay">
                    <div class="chat-popup-content">
                        <h3>I am happy to help you with that question. However, before we proceed forward, can you please provide me the following information for my records:</h3>                     <form id="userDetailsForm">
                            <div class="form-group">
                                <label>Name:</label>
                                <input type="text" id="userName" required>
                            </div>
                            <div class="form-group">
                                <label>Phone:</label>
                                <input type="tel" id="userPhone" required>
                            </div>
                            <div class="form-group">
                                <label>Email:</label>
                                <input type="email" id="userEmail" required>
                            </div>
                            <button type="submit">Submit</button>
                        </form>
                    </div>
                </div>
            `;
            
            const $chatContainer = $('.chat-container');
            console.log('Chat container found:', $chatContainer.length);
            $chatContainer.append(popupHtml);
            console.log('Popup added to chat container');
            console.log('Popup element:', $('#userDetailsPopup').length);
            
            $('#userDetailsForm').on('submit', function(e) {
                e.preventDefault();
                
                userDetails = {
                    name: $('#userName').val(),
                    phone: $('#userPhone').val(),
                    email: $('#userEmail').val()
                };
                
                $('#userDetailsPopup').remove();
                addBotMessage("Thank you! How can I help you?");
            });
        }
        
        function sendTranscriptEmail() {
            if (!userDetails || chatHistory.length === 0) return;

            const transcriptData = {
                name: userDetails.name,
                phone: userDetails.phone,
                email: userDetails.email,
                messages: chatHistory
            };

            // Use navigator.sendBeacon for reliable sending on page unload
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(transcriptData)], { type: 'application/json' });
                navigator.sendBeacon(`${API_BASE_URL}/api/send-transcript`, blob);
            } else {
                fetch(`${API_BASE_URL}/api/send-transcript`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(transcriptData),
                    credentials: "omit"  
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Transcript sent:', data);
                })
                .catch(error => {
                    console.error('Error sending transcript:', error);
                });
            }
        }
        
        // Chatbot close detection and email sending
        function handleChatbotClose() {
            if (userDetails && chatHistory.length > 0) {
                sendTranscriptEmail();
            }
        }
        
        // Detect close button clicks
        $(document).on('click', '#chatClose', function() {
            handleChatbotClose();
        });
        
        // Remove conflicting toggle handler - let HTML handle toggle
        // Email sending will be handled by HTML toggle function
        
        // Make handleChatbotClose available globally
        window.handleChatbotClose = handleChatbotClose;

        // Voice modal integration - handled by voice-modal.js
        // Voice button now opens modal inside chatbot UI

        // Handle form submit
        $("#messageForm").on("submit", function(event) {
            event.preventDefault();
            sendMessage();
        });
        
        function sendMessage() {
            const message = $("#messageInput").val().trim();
            if (!message) return;

            messageCount++;
            addUserMessage(message);
            $("#messageInput").val("");
            
            // Hide mobile keyboard
            $("#messageInput").blur();
            
            // Check for goodbye messages first - no backend call needed
            const goodbyeKeywords = ['bye', 'goodbye', 'thank you', 'thanks', 'thanku', 'thnx', 'see you'];
            const isGoodbye = goodbyeKeywords.some(keyword => message.toLowerCase().includes(keyword));
            
            console.log('🔍 Goodbye check:', { message, isGoodbye, keywords: goodbyeKeywords });
            
            if (isGoodbye) {
                console.log('👋 Goodbye detected! Sending email and goodbye message');
                sendTranscriptEmail();
                addBotMessage("Thank you for visiting! Welcome to visit again. Have a great day!");
                return;
            }

            // Show popup after 2nd message
            if (messageCount === 2 && !userDetails) {
                showUserDetailsPopup();
                return;
            }
            
            showTypingIndicator();

            // Get current time for Edmonds, Washington
            const now = new Date();
            
            const edmondsTime = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).format(now);
            
            const dayOfWeek = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                weekday: 'long'
            }).format(now);
            
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowDay = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                weekday: 'long'
            }).format(tomorrow);
            
            console.log('🏥 Edmonds, WA - Real Time Data:', {
                current_time: edmondsTime,
                day_of_week: dayOfWeek,
                tomorrow_day: tomorrowDay,
                message: message.substring(0, 100)
            });

            // Direct API call
            fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    session_id: sessionId,
                    current_time: edmondsTime,
                    day_of_week: dayOfWeek,
                    tomorrow_day: tomorrowDay,
                    timezone: 'America/Los_Angeles',
                    location: 'Edmonds, Washington'
                })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                hideTypingIndicator();
                
                if (data.session_id) {
                    sessionId = data.session_id;
                }
                
                addBotMessage(data.response);
            })
            .catch(error => {
                console.log("❌ Error:", error);
                hideTypingIndicator();
                addBotMessage("Sorry, I encountered an error connecting to the server. Please call (425) 775-5162 for immediate assistance.");
            });
        }
    });
})(jQuery);