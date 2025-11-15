// src/lib/toneManager.ts
import * as Tone from 'tone';
if (typeof window !== 'undefined') {
    window.Tone = Tone;
}
const loadSampleLibraryScript = () => {
    return new Promise((resolve, reject) => {
        if (window.SampleLibrary)
            return resolve();
        const script = document.createElement('script');
        script.src = '/Tonejs-Instruments.js';
        script.onload = () => {
            let attempts = 0;
            const interval = setInterval(() => {
                if (window.SampleLibrary) {
                    clearInterval(interval);
                    resolve();
                }
                else if (attempts++ > 20) {
                    clearInterval(interval);
                    reject(new Error("SampleLibrary did not load in time."));
                }
            }, 100);
        };
        script.onerror = (e) => reject(e);
        document.body.appendChild(script);
    });
};
export const availableInstruments = [
    "piano", "bass-electric", "bassoon", "cello", "clarinet", "contrabass", "flute",
    "french-horn", "guitar-acoustic", "guitar-electric", "guitar-nylon",
    "harmonium", "harp", "organ", "saxophone", "trombone",
    "trumpet", "tuba", "violin", "xylophone"
];
class ToneManager {
    instruments = new Map();
    audioContextStarted = false;
    extHasBeenSet = false;
    localInstrumentStreamDest = null;
    localInstrumentStream = null;
    micStream = null;
    micSourceNode = null;
    isRecording = false;
    recorder = null;
    recordedChunks = [];
    async init() {
        if (this.audioContextStarted)
            return;
        if (typeof window !== 'undefined' && Tone.context.state !== 'running') {
            await Tone.start();
            this.audioContextStarted = true;
            if (!this.localInstrumentStreamDest) {
                this.localInstrumentStreamDest = Tone.getContext().createMediaStreamDestination();
                this.localInstrumentStream = this.localInstrumentStreamDest.stream;
            }
            console.log("AudioContext and ToneManager initialized.");
        }
    }
    async loadAllInstruments() {
        if (!this.audioContextStarted)
            await this.init();
        console.log("Loading all instruments...");
        try {
            await loadSampleLibraryScript();
            if (!this.extHasBeenSet) {
                window.SampleLibrary.setExt('.mp3');
                this.extHasBeenSet = true;
            }
            // availableInstruments配列のすべての楽器をロード
            const loadPromises = availableInstruments.map(instrumentName => {
                if (this.instruments.has(instrumentName))
                    return Promise.resolve();
                const sampler = window.SampleLibrary.load({
                    instruments: instrumentName,
                    baseUrl: "/samples/"
                });
                if (this.localInstrumentStreamDest)
                    sampler.connect(this.localInstrumentStreamDest);
                sampler.toDestination();
                this.instruments.set(instrumentName, sampler);
            });
            await Promise.all(loadPromises); // 全てのload呼び出しを待つ
            await Tone.loaded(); // 全ての音声ファイルのダウンロード完了を待つ
            console.log("All instruments loaded.");
            return true;
        }
        catch (error) {
            console.error("Failed to load all instruments:", error);
            return false;
        }
    }
    noteOn(instrumentName, note) {
        const instrument = this.instruments.get(instrumentName);
        if (instrument)
            instrument.triggerAttack(note, Tone.now());
    }
    noteOff(instrumentName, note) {
        const instrument = this.instruments.get(instrumentName);
        if (instrument)
            instrument.triggerRelease(note, Tone.now() + 0.05);
    }
    async toggleMic(enabled) {
        await this.init();
        if (enabled) {
            if (this.micStream)
                return this.micStream;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.micStream = stream;
                const audioContext = Tone.getContext();
                this.micSourceNode = audioContext.createMediaStreamSource(stream);
                if (this.localInstrumentStreamDest)
                    this.micSourceNode.connect(this.localInstrumentStreamDest);
                this.micSourceNode.connect(audioContext.rawContext.destination);
                console.log("Microphone opened and connected.");
                return stream;
            }
            catch (e) {
                console.error("Failed to get microphone permission:", e);
                this.micStream = null;
                this.micSourceNode = null;
                return null;
            }
        }
        else {
            if (this.micStream)
                this.micStream.getTracks().forEach(track => track.stop());
            if (this.micSourceNode)
                this.micSourceNode.disconnect();
            this.micStream = null;
            this.micSourceNode = null;
            console.log("Microphone closed.");
            return null;
        }
    }
    startRecording(remoteStreams) {
        if (this.isRecording || !this.localInstrumentStream) {
            console.warn("Recording cannot start.");
            return;
        }
        const allStreams = [...remoteStreams, this.localInstrumentStream];
        const audioContext = Tone.getContext();
        const mixedDestination = audioContext.createMediaStreamDestination();
        allStreams.forEach(stream => {
            if (stream.getAudioTracks().length > 0) {
                audioContext.createMediaStreamSource(stream).connect(mixedDestination);
            }
        });
        this.recorder = new MediaRecorder(mixedDestination.stream);
        this.recordedChunks = [];
        this.recorder.ondataavailable = (event) => {
            if (event.data.size > 0)
                this.recordedChunks.push(event.data);
        };
        this.recorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session-recording-${new Date().toISOString()}.webm`;
            a.click();
            window.URL.revokeObjectURL(url);
        };
        this.recorder.start();
        this.isRecording = true;
        console.log("Recording started.");
    }
    stopRecording() {
        if (!this.recorder || !this.isRecording)
            return;
        this.recorder.stop();
        this.isRecording = false;
        console.log("Recording stopped.");
    }
}
export const toneManager = new ToneManager();
