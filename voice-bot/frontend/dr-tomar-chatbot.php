<?php
/**
 * Plugin Name: Dr. Meenakshi Tomar - Dental Chatbot
 * Description: AI-powered floating dental chatbot for Dr. Meenakshi Tomar's dental practice
 * Version: 1.0.0
 * Author: Dr. Tomar
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class DrTomarChatbot {
    
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_footer', array($this, 'render_chatbot'));
    }
    
    public function enqueue_scripts() {
        // Enqueue jQuery (WordPress includes it)
        wp_enqueue_script('jquery');
        
        // Enqueue marked.js for markdown parsing
        wp_enqueue_script('marked-js', 'https://cdn.jsdelivr.net/npm/marked/marked.min.js', array(), time(), true);
        
        // Enqueue Font Awesome
        wp_enqueue_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css', array(), time());
        
        // CSS
        wp_enqueue_style(
            'dr-tomar-chatbot-css',
            plugin_dir_url(__FILE__) . 'chatbot-styles-updated.css',
            array(),
            time() // 🔥 cache busting (हर बार latest load होगा)
        );

        // WebSocket Voice Stream JS (Real-time voice service)
        wp_enqueue_script(
            'voice-stream-js',
            plugin_dir_url(__FILE__) . 'voice-stream.js',
            array('jquery'),
            time(),
            true
        );
        
        // Voice Modal JS
        wp_enqueue_script(
            'voice-modal-js',
            plugin_dir_url(__FILE__) . 'voice-modal.js',
            array('jquery'),
            time(),
            true
        );
        
        // Main chatbot JS
        wp_enqueue_script(
            'dr-tomar-chatbot-js',
            plugin_dir_url(__FILE__) . 'chatbot-script.js',
            array('jquery', 'marked-js', 'voice-stream-js', 'voice-modal-js'),
            time(), // 🔥 cache busting
            true    // load in footer
        );
    }
    
    public function render_chatbot() {
        ?>
        <div id="chatToggle" onclick="toggleChatbot()" style="position:fixed!important;bottom:20px!important;right:20px!important;z-index:99999!important;cursor:pointer!important;background:#4f46e5!important;color:white!important;width:60px!important;height:60px!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:24px!important;box-shadow:0 4px 12px rgba(0,0,0,0.3)!important;border:none!important;outline:none!important;">
            💬
        </div>

        <div id="chatContainer" class="chat-container" style="position:fixed!important;bottom:90px!important;right:20px!important;z-index:99998!important;display:none!important;width:320px!important;max-width:90vw!important;max-height:520px!important;overflow:hidden!important;">
            <div class="chat-header">
                <div class="avatar">
                    <img src="https://res.cloudinary.com/dzryajl43/image/upload/v1756100317/logo-5_kzbd34.png" alt="Dr. Meenakshi Tomar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
                </div>
                <div class="header-info">
                    <div class="header-title">Dr. Meenakshi Tomar,DDS</div>
                    <div class="header-subtitle"> Virtual Assistant</div>
                </div>
                <div id="chatClose" style="cursor:pointer;color:white;font-size:18px;padding:5px;">
                    <i class="fas fa-times"></i>
                </div>
            </div>

            <div class="chat-messages" id="chatMessages" style="max-height:270px!important;overflow-y:auto!important;margin-bottom:5px!important;">
                <div class="message">
                    <div class="message-avatar">
                        <img src="https://res.cloudinary.com/dzryajl43/image/upload/v1756100317/logo-5_kzbd34.png" class="bot-avatar-img">
                    </div>
                    <div class="message-content">
                        <div class="message-text">
                            <h4>🦷 Welcome to Edmonds Bay Dental!</h4>
                            <p>I'm here to help you with:</p>
                            <ul>
                                <li>Clinic Information</li>
                                <li>General procedure information</li>
                                <li>Office hours & location</li>
                              
                            </ul>
                            <p><strong>📞 Call us: (425) 775-5162</strong></p>
                        </div>
                    </div>
                </div>
            </div>

            <form id="messageForm" class="chat-input">
                <div class="input-container">
                    <input type="text" id="messageInput" class="input-field" placeholder="Ask about dental concern..." autocomplete="off">
                    <button type="button" id="voiceToggle" class="voice-btn" title="Voice Mode" 
                           style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(79, 70, 229, 0.7); color:white; border:none; cursor:pointer;">
                        <i class="fas fa-microphone" style="font-size:12px;"></i>
                    </button>
                    <button type="submit" class="send-btn" 
  style="width:40px; height:40px; border-radius:50%; 
         display:flex; align-items:center; justify-content:center; 
         background:rgba(79, 70, 229, 0.7); color:white; border:none; cursor:pointer;">
  <i class="fas fa-paper-plane" style="font-size:18px;"></i>
</button>
                </div>
            </form>

            <div class="powered-by">
                <span>Powered by</span>
                <img src="https://res.cloudinary.com/dzryajl43/image/upload/v1756882120/footer-logo_1_um01z8.png" alt="Dr. Tomar">
                <span></span>
            </div>
        </div>

        <script>
            function toggleChatbot() {
                var container = document.getElementById('chatContainer');
                var computedStyle = window.getComputedStyle(container);
                var isCurrentlyVisible = computedStyle.display !== 'none';
                
                if (isCurrentlyVisible) {
                    // Closing chatbot
                    container.style.setProperty('display', 'none', 'important');
                    // Send email when closing via toggle
                    setTimeout(function() {
                        if (typeof handleChatbotClose === 'function') {
                            handleChatbotClose();
                        }
                    }, 100);
                } else {
                    // Opening chatbot
                    container.style.setProperty('display', 'block', 'important');
                }
            }
            
            function closeChatbot() {
                // Send email when closing via X button
                if (typeof handleChatbotClose === 'function') {
                    handleChatbotClose();
                }
                document.getElementById('chatContainer').style.setProperty('display', 'none', 'important');
            }
            
            document.addEventListener('DOMContentLoaded', function() {
                document.getElementById('chatClose').onclick = closeChatbot;
                
                // Add voice toggle button handler
                const voiceToggle = document.getElementById('voiceToggle');
                if (voiceToggle) {
                    voiceToggle.style.cursor = 'pointer';
                    voiceToggle.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Voice button clicked');
                        if (window.voiceModal) {
                            window.voiceModal.open();
                        } else {
                            console.log('voiceModal not found');
                        }
                    };
                }
            });
        </script>
        <?php
    }
}

// Initialize the plugin
new DrTomarChatbot();