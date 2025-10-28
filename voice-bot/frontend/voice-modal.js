// Voice Modal - Opens inside chatbot UI
class VoiceModal {
    constructor() {
        this.isOpen = false;
        this.voiceService = null;
        this.isRecording = false;
    }

    open() {
        if (this.isOpen) return;
        
        const modalHTML = `
            <div id="voiceModal" class="voice-modal-overlay">
                <div class="voice-modal-content">
                    <div class="voice-modal-header">
                        <h3>🎤 Voice Assistant</h3>
                        <button id="closeVoiceModal" class="close-voice-modal">×</button>
                    </div>
                    <div class="voice-modal-body">
                        <div class="voice-orb-container">
                            <div id="voiceOrb" class="voice-orb">
                                <i class="fas fa-microphone"></i>
                            </div>
                        </div>
                        <div class="voice-status">
                            <p id="voiceStatus">Click microphone to start</p>
                        </div>
                        <div class="voice-transcript">
                            <div id="liveTranscript" class="live-transcript-text"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to chatbot container
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.insertAdjacentHTML('beforeend', modalHTML);
            this.isOpen = true;
            this.setupEventListeners();
            this.initVoiceService();
        }
    }

    close() {
        const modal = document.getElementById('voiceModal');
        if (modal) {
            if (this.isRecording) {
                this.stopRecording();
            }
            modal.remove();
            this.isOpen = false;
        }
    }

    setupEventListeners() {
        const closeBtn = document.getElementById('closeVoiceModal');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }
        
        // Add click handler for voice orb
        const voiceOrb = document.getElementById('voiceOrb');
        if (voiceOrb) {
            voiceOrb.style.cursor = 'pointer';
            voiceOrb.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleRecording();
            };
        }
    }

    initVoiceService() {
        if (typeof StreamingVoiceService !== 'undefined') {
            this.voiceService = new StreamingVoiceService();
            
            this.voiceService.onRecordingStart = (sessionId) => {
                console.log('Modal: Recording started');
                this.updateUI('recording');
                this.isRecording = true;
            };
            
            this.voiceService.onRecordingStop = (duration) => {
                console.log('Modal: Recording stopped, waiting for response...');
                this.updateUI('waiting');
                this.isRecording = false;
            };
            
            this.voiceService.onTranscript = (text) => {
                console.log('Modal: Transcript received');
                // Keep waiting state
            };
            
            this.voiceService.onBotResponse = (text) => {
                console.log('Modal: Bot response received - keep waiting for audio');
                // Keep waiting state until audio plays
            };
            
            this.voiceService.onAudioResponseReceived = () => {
                console.log('Modal: Audio response received - stopping rotation');
                this.updateUI('idle');
            };
            
            // Block all other callbacks from going to idle
            this.voiceService.onReadyForNext = () => {
                console.log('Modal: Ready for next - but keeping waiting state');
                // Don't change UI state - let audio response handle it
            };
            
            this.voiceService.onNoSpeech = () => {
                console.log('Modal: No speech detected - going to idle');
                this.updateUI('idle');
            };
            
            this.voiceService.onConnectionStatus = () => {
                // Block connection status from changing UI
            };
        }
    }

    async toggleRecording() {
        if (!this.voiceService || this.isRecording) return;

        console.log('Toggle recording clicked');
        this.updateUI('recording');
        this.isRecording = true;
        
        // Manual 3-second timer as backup
        setTimeout(() => {
            if (this.isRecording) {
                console.log('Manual 3-second stop triggered');
                this.updateUI('waiting');
                this.isRecording = false;
            }
        }, 3000);
        
        if (!this.voiceService.ws) {
            const success = await this.voiceService.startRealTimeVoice(true);
            if (!success) {
                this.updateUI('idle');
                this.isRecording = false;
            }
        } else {
            await this.voiceService.startRecording();
        }
    }

    updateUI(state) {
        const orb = document.getElementById('voiceOrb');
        const status = document.getElementById('voiceStatus');
        
        if (!orb || !status) {
            console.log('UI elements not found:', {orb: !!orb, status: !!status});
            return;
        }

        orb.className = 'voice-orb';
        console.log('UI State changed to:', state);
        
        switch(state) {
            case 'recording':
                orb.classList.add('recording');
                status.textContent = 'Recording... (3 seconds)';
                console.log('UI: Recording state applied');
                break;
            case 'processing':
                orb.classList.add('processing');
                status.textContent = 'Processing speech...';
                console.log('UI: Processing state applied');
                break;
            case 'waiting':
                orb.classList.add('processing');
                status.textContent = 'Waiting for response...';
                console.log('UI: Waiting state applied');
                break;
            case 'idle':
            default:
                status.textContent = 'Click microphone to speak';
                console.log('UI: Idle state applied');
        }
    }
}

// Create global instance
window.voiceModal = new VoiceModal();