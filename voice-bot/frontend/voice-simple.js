class SimpleVoiceService {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.botId = 'dr-tomar';
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.sendAudioToBackend(audioBlob);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            console.log('Recording started...');
            
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            return false;
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            console.log('Recording stopped...');
            
            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    async sendAudioToBackend(audioBlob) {
        try {
            console.log('Sending audio to backend...');
            
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.wav');
            formData.append('bot_id', this.botId);

            const response = await fetch('http://localhost:8090/voice-chat', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const contentType = response.headers.get('Content-Type');
                
                if (contentType && contentType.includes('audio')) {
                    // Audio response
                    const transcript = response.headers.get('X-Transcript');
                    const botResponse = response.headers.get('X-Bot-Response');
                    
                    console.log('User said:', transcript);
                    console.log('Bot replied:', botResponse);
                    
                    if (this.onTranscript) this.onTranscript(transcript);
                    if (this.onBotResponse) this.onBotResponse(botResponse);
                    
                    // Play audio
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    
                    // Ensure audio plays
                    audio.onloadeddata = () => {
                        console.log('Audio loaded, playing...');
                        if (this.onAudioPlay) this.onAudioPlay();
                    };
                    
                    audio.onerror = (e) => {
                        console.error('Audio play error:', e);
                    };
                    
                    audio.play().catch(e => {
                        console.error('Audio play failed:', e);
                        // Try alternative play method
                        setTimeout(() => {
                            audio.play().catch(err => console.error('Retry audio play failed:', err));
                        }, 100);
                    });
                } else {
                    // Text response (TTS failed)
                    const data = await response.json();
                    console.log('User said:', data.transcript);
                    console.log('Bot replied:', data.response);
                    console.log('Audio error:', data.audio_error);
                    
                    if (this.onTranscript) this.onTranscript(data.transcript);
                    if (this.onBotResponse) this.onBotResponse(data.response);
                }
            } else {
                console.error('Voice chat failed:', response.statusText);
            }
        } catch (error) {
            console.error('Error sending audio:', error);
        }
    }

    // UI update methods
    updateVoiceOrb(state) {
        const voiceOrb = document.getElementById('voiceOrb');
        if (voiceOrb) {
            voiceOrb.className = 'voice-orb';
            if (state === 'recording') {
                voiceOrb.classList.add('recording');
            } else if (state === 'processing') {
                voiceOrb.classList.add('processing');
            }
        }
    }

    // Callback functions - override these
    onTranscript(text) {
        console.log('Transcript:', text);
    }
    
    onBotResponse(text) {
        console.log('Bot Response:', text);
    }
    
    onAudioPlay() {
        console.log('Audio playing...');
    }
}

// Export for use
window.SimpleVoiceService = SimpleVoiceService;