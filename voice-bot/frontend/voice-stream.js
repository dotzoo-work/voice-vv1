class StreamingVoiceService {
    constructor() {
        this.ws = null;
        this.mediaRecorder = null;
        this.isStreaming = false;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingTimer = null;
        this.currentSession = null;
        this.voiceModeActive = false;
        this.originalChatState = null;
    }

    async startRealTimeVoice(autoStartRecording = false) {
        try {
            // Connect to real-time WebSocket
            this.ws = new WebSocket('ws://localhost:8090/ws/voice-realtime');
            this.autoStartRecording = autoStartRecording;
            
            this.ws.onopen = async () => {
                console.log('Real-time WebSocket connected');
                if (this.onConnectionStatus) {
                    this.onConnectionStatus('connected');
                }
                // Auto-start recording if requested
                if (this.autoStartRecording && !this.isRecording) {
                    console.log('Auto-starting recording after connection');
                    await this.startRecording();
                }
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('WebSocket message:', data);
                
                switch(data.type) {
                    case 'recording_started':
                        this.currentSession = data.session_id;
                        this.showRecordingIndicator();
                        if (this.onRecordingStart) {
                            this.onRecordingStart(data.session_id);
                        }
                        break;
                        
                    case 'recording_stopped':
                        this.stopRecording();
                        this.hideRecordingIndicator();
                        console.log('Backend stopped recording after', data.duration, 'seconds');
                        if (this.onRecordingStop) {
                            this.onRecordingStop(data.duration);
                        }
                        break;
                        
                    case 'transcript':
                        console.log('Transcript:', data.text);
                        if (this.onTranscript) {
                            this.onTranscript(data.text);
                        }
                        if (this.onTranscriptReceived) {
                            this.onTranscriptReceived();
                        }
                        break;
                        
                    case 'bot_response':
                        console.log('Bot response:', data.text);
                        if (this.onBotResponse) {
                            this.onBotResponse(data.text);
                        }
                        break;
                        
                    case 'partial_transcript':
                        console.log('Partial transcript:', data.text);
                        if (this.onPartialTranscript) {
                            this.onPartialTranscript(data.text);
                        }
                        break;
                        
                    case 'chunk_response':
                        console.log('Chunk response:', data.text);
                        if (this.onChunkResponse) {
                            this.onChunkResponse(data.text);
                        }
                        break;
                        
                    case 'chunk_audio':
                        this.playAudioResponse(data.data);
                        break;
                        
                    case 'audio_response':
                        console.log('Received audio response, playing...');
                        this.playAudioResponse(data.data);
                        if (this.onAudioResponseReceived) {
                            this.onAudioResponseReceived();
                        }
                        break;
                        
                    case 'processing_complete':
                        console.log('Processing complete');
                        break;
                        
                    case 'ready_for_next':
                        this.enableRecordingButton();
                        if (this.onReadyForNext) {
                            this.onReadyForNext();
                        }
                        break;
                        
                    case 'no_speech_detected':
                        this.enableRecordingButton();
                        if (this.onNoSpeech) {
                            this.onNoSpeech();
                        }
                        break;
                        
                    case 'processing_error':
                        this.enableRecordingButton();
                        console.error('Processing error:', data.error);
                        break;
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (this.onConnectionStatus) {
                    this.onConnectionStatus('error');
                }
            };
            
            return true;
            
        } catch (error) {
            console.error('Real-time voice failed:', error);
            return false;
        }
    }
    
    async startRecording() {
        if (this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Try to use WAV format if supported, otherwise use default
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/wav')) {
                options = { mimeType: 'audio/wav' };
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { mimeType: 'audio/webm' };
            }
            
            this.mediaRecorder = new MediaRecorder(stream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.ws.readyState === WebSocket.OPEN && this.isRecording) {
                    // Send audio blob directly
                    this.ws.send(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
                this.isRecording = false;
                console.log('Recording stopped');
            };
            
            // Start recording in larger chunks for better audio quality
            this.mediaRecorder.start(500); // Send chunks every 500ms
            this.isRecording = true;
            
            // Auto-stop after 3 seconds (frontend backup)
            this.recordingTimer = setTimeout(() => {
                if (this.isRecording) {
                    console.log('Frontend auto-stopping recording after 3 seconds');
                    this.stopRecording();
                }
            }, 3000);
            
            return true;
            
        } catch (error) {
            console.error('Recording failed:', error);
            return false;
        }
    }

    stopRecording() {
        if (this.recordingTimer) {
            clearTimeout(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
    }
    
    disconnect() {
        this.stopRecording();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.hideAllIndicators();
        this.disableVoiceMode();
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    // UI Helper Functions
    showRecordingIndicator() {
        const indicator = document.getElementById('recordingIndicator');
        if (indicator) {
            indicator.style.display = 'block';
            indicator.textContent = '🎤 Recording... (3 seconds)';
            indicator.className = 'recording-active';
        }
    }
    
    hideRecordingIndicator() {
        const indicator = document.getElementById('recordingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    showProcessingIndicator() {
        const indicator = document.getElementById('processingIndicator');
        if (indicator) {
            indicator.style.display = 'block';
            indicator.textContent = '⏳ Processing...';
            indicator.className = 'processing-active';
        }
    }
    
    hideProcessingIndicator() {
        const indicator = document.getElementById('processingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    enableRecordingButton() {
        const button = document.getElementById('voiceButton');
        if (button) {
            button.disabled = false;
            button.textContent = '🎤 Speak (3s)';
            button.className = 'voice-btn ready';
        }
    }
    
    disableRecordingButton() {
        const button = document.getElementById('voiceButton');
        if (button) {
            button.disabled = true;
            button.textContent = '⏳ Processing...';
            button.className = 'voice-btn processing';
        }
    }
    
    hideAllIndicators() {
        this.hideRecordingIndicator();
        this.hideProcessingIndicator();
    }
    
    enableVoiceMode() {
        this.voiceModeActive = true;
        
        // Disable text input elements
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const messageForm = document.getElementById('messageForm');
        
        if (chatInput) {
            this.originalChatState = {
                inputDisabled: chatInput.disabled,
                inputPlaceholder: chatInput.placeholder
            };
            chatInput.disabled = true;
            chatInput.placeholder = 'Voice mode active - use microphone';
            chatInput.style.opacity = '0.5';
        }
        
        if (sendButton) {
            sendButton.disabled = true;
            sendButton.style.opacity = '0.5';
        }
        
        if (messageForm) {
            messageForm.style.pointerEvents = 'none';
            messageForm.style.opacity = '0.7';
        }
        
        // Show voice mode indicator
        this.showVoiceModeIndicator();
    }
    
    disableVoiceMode() {
        this.voiceModeActive = false;
        
        // Re-enable text input elements
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const messageForm = document.getElementById('messageForm');
        
        if (chatInput && this.originalChatState) {
            chatInput.disabled = this.originalChatState.inputDisabled;
            chatInput.placeholder = this.originalChatState.inputPlaceholder;
            chatInput.style.opacity = '1';
        }
        
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.style.opacity = '1';
        }
        
        if (messageForm) {
            messageForm.style.pointerEvents = 'auto';
            messageForm.style.opacity = '1';
        }
        
        // Hide voice mode indicator
        this.hideVoiceModeIndicator();
    }
    
    showVoiceModeIndicator() {
        let indicator = document.getElementById('voiceModeIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'voiceModeIndicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #dc2626;
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                z-index: 9999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                cursor: pointer;
            `;
            
            // Add click to exit voice mode
            indicator.addEventListener('click', () => {
                this.disconnect();
            });
            
            document.body.appendChild(indicator);
        }
        
        indicator.innerHTML = '🎤 VOICE MODE ACTIVE (Click to Exit)';
        indicator.style.display = 'block';
    }
    
    hideVoiceModeIndicator() {
        const indicator = document.getElementById('voiceModeIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    playAudioResponse(base64Audio) {
        try {
            const audioBlob = this.base64ToBlob(base64Audio, 'audio/mpeg');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.enableRecordingButton();
            };
            
            audio.play();
        } catch (error) {
            console.error('Audio playback failed:', error);
            this.enableRecordingButton();
        }
    }
    
    // Callback functions (override these)
    onConnectionStatus(status) {
        console.log('Connection status:', status);
    }
    
    onRecordingStart(sessionId) {
        console.log('Recording started:', sessionId);
    }
    
    onRecordingStop(duration) {
        console.log('Recording stopped, duration:', duration);
    }
    
    onTranscript(text) {
        console.log('Transcript:', text);
    }
    
    onBotResponse(text) {
        console.log('Bot Response:', text);
    }
    
    onReadyForNext() {
        console.log('Ready for next recording');
    }
    
    onNoSpeech() {
        console.log('No speech detected');
    }
}

// WordPress Integration Functions
function initRealTimeVoice() {
    const voiceService = new StreamingVoiceService();
    
    // Setup voice button if exists
    const voiceButton = document.getElementById('voiceButton');
    if (voiceButton) {
        voiceButton.addEventListener('click', async () => {
            if (!voiceService.ws) {
                // Connect first time and auto-start recording
                voiceService.enableVoiceMode();
                voiceService.disableRecordingButton();
                const success = await voiceService.startRealTimeVoice(true); // Pass true to auto-start recording
                if (!success) {
                    voiceService.enableRecordingButton();
                }
            } else if (!voiceService.isRecording) {
                // Start recording (auto-stops after 3 seconds)
                voiceService.disableRecordingButton();
                await voiceService.startRecording();
            }
        });
    };
    
    // Setup callbacks for WordPress chat integration
    voiceService.onConnectionStatus = (status) => {
        if (status === 'connected') {
            // Enable voice mode when connected
            voiceService.enableVoiceMode();
            if (window.addBotMessage) {
                window.addBotMessage('🎤 Voice mode activated! Click microphone to speak (3s auto-stop) or Exit Voice Mode.');
            }
        }
    };
    
    voiceService.onTranscript = (text) => {
        console.log('Final transcript:', text);
        if (window.addUserMessage) {
            window.addUserMessage(text);
        }
    };
    
    voiceService.onBotResponse = (text) => {
        console.log('Final bot response:', text);
        if (window.addBotMessage) {
            window.addBotMessage(text);
        }
    };
    
    voiceService.onPartialTranscript = (text) => {
        console.log('Partial:', text);
        // Show partial transcript in real-time
        if (window.addUserMessage) {
            window.addUserMessage(`[Speaking...] ${text}`);
        }
    };
    
    voiceService.onChunkResponse = (text) => {
        console.log('Chunk response:', text);
        // Show bot response immediately
        if (window.addBotMessage) {
            window.addBotMessage(text);
        }
    };
    
    voiceService.onNoSpeech = () => {
        // Keep voice mode active, just show message
        if (window.addBotMessage) {
            window.addBotMessage('(No speech detected - click microphone to speak again)');
        }
    };
    
    // Override ready callback - keep voice mode active
    voiceService.onReadyForNext = () => {
        console.log('Ready for next voice interaction - staying in voice mode');
        // Keep voice mode active, enable recording button
        voiceService.enableRecordingButton();
        // Show ready message
        if (window.addBotMessage) {
            window.addBotMessage('Ready for next voice input - click microphone to speak');
        }
    };
    
    // Add exit voice mode button to chat interface
    const addExitVoiceButton = () => {
        if (!document.getElementById('exitVoiceButton')) {
            const exitButton = document.createElement('button');
            exitButton.id = 'exitVoiceButton';
            exitButton.innerHTML = '❌ Exit Voice Mode';
            exitButton.style.cssText = `
                background: #dc2626;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 15px;
                font-size: 12px;
                cursor: pointer;
                margin: 5px;
                position: fixed;
                top: 50px;
                right: 10px;
                z-index: 9999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            
            exitButton.addEventListener('click', () => {
                voiceService.disconnect();
                exitButton.remove();
                if (window.addBotMessage) {
                    window.addBotMessage('Voice mode disabled. You can now use text chat.');
                }
            });
            
            document.body.appendChild(exitButton);
        }
    };
    
    // Add exit button when voice mode starts
    const originalEnableVoiceMode = voiceService.enableVoiceMode;
    voiceService.enableVoiceMode = function() {
        originalEnableVoiceMode.call(this);
        addExitVoiceButton();
    };
    
    // Remove exit button when voice mode ends
    const originalDisableVoiceMode = voiceService.disableVoiceMode;
    voiceService.disableVoiceMode = function() {
        originalDisableVoiceMode.call(this);
        const exitButton = document.getElementById('exitVoiceButton');
        if (exitButton) {
            exitButton.remove();
        }
    };
    
    // Add disconnect functionality
    const disconnectVoice = () => {
        voiceService.disconnect();
        voiceService.disableVoiceMode();
        if (window.addBotMessage) {
            window.addBotMessage('Voice mode disabled. You can now use text chat.');
        }
    };
    
    // Setup disconnect button if exists
    const disconnectButton = document.getElementById('disconnectVoiceButton');
    if (disconnectButton) {
        disconnectButton.addEventListener('click', disconnectVoice);
    }
    
    // Auto-disconnect on page unload
    window.addEventListener('beforeunload', disconnectVoice);
    
    return voiceService;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.voiceService = initRealTimeVoice();
    });
} else {
    window.voiceService = initRealTimeVoice();
}

// Export
window.StreamingVoiceService = StreamingVoiceService;
window.initRealTimeVoice = initRealTimeVoice;