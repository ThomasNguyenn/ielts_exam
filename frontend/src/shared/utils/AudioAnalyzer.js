export default class AudioAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.source = null;
        this.dataArray = null;
        this.intervalId = null;
        this.startTime = null;

        // Configuration
        this.silenceThreshold = 0.02; // Amplitude approx < 2%
        this.pauseThresholdMs = 500; // Pause > 500ms counts as a "pause"

        // State
        this.isRecording = false;
        this.pauseCount = 0;
        this.totalPauseDuration = 0;
        this.longestPause = 0;

        // Internal tracking
        this.currentPauseStart = null;
    }

    async start() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            this.source.connect(this.analyser);
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            this.isRecording = true;
            this.startTime = Date.now();

            // Reset stats
            this.pauseCount = 0;
            this.totalPauseDuration = 0;
            this.longestPause = 0;
            this.currentPauseStart = null;

            this.startMonitoring();
            return stream;
        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error;
        }
    }

    startMonitoring() {
        const update = () => {
            if (!this.isRecording) return;

            this.analyser.getByteTimeDomainData(this.dataArray);

            // distinct amplitude (0-255 center at 128)
            let sum = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                const amplitude = (this.dataArray[i] - 128) / 128;
                sum += amplitude * amplitude;
            }
            const rms = Math.sqrt(sum / this.dataArray.length);

            if (rms < this.silenceThreshold) {
                // Silence detected
                if (!this.currentPauseStart) {
                    this.currentPauseStart = Date.now();
                }
            } else {
                // Noise detected (User is speaking)
                if (this.currentPauseStart) {
                    const pauseDuration = Date.now() - this.currentPauseStart;
                    if (pauseDuration >= this.pauseThresholdMs) {
                        this.pauseCount++;
                        this.totalPauseDuration += pauseDuration;
                        if (pauseDuration > this.longestPause) {
                            this.longestPause = pauseDuration;
                        }
                    }
                    this.currentPauseStart = null;
                }
            }

            this.intervalId = requestAnimationFrame(update);
        };

        update();
    }

    stop() {
        this.isRecording = false;
        if (this.intervalId) cancelAnimationFrame(this.intervalId);
        if (this.audioContext) this.audioContext.close();

        // Check if we ended in a pause
        if (this.currentPauseStart) {
            const pauseDuration = Date.now() - this.currentPauseStart;
            if (pauseDuration >= this.pauseThresholdMs) {
                this.pauseCount++;
                this.totalPauseDuration += pauseDuration;
                if (pauseDuration > this.longestPause) {
                    this.longestPause = pauseDuration;
                }
            }
        }

        return {
            pauseCount: this.pauseCount,
            totalPauseDuration: this.totalPauseDuration,
            longestPause: this.longestPause,
            avgPauseDuration: this.pauseCount > 0 ? Math.round(this.totalPauseDuration / this.pauseCount) : 0
        };
    }
}
