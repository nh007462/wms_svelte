export declare const availableInstruments: string[];
declare class ToneManager {
    private instruments;
    private audioContextStarted;
    private extHasBeenSet;
    localInstrumentStreamDest: MediaStreamAudioDestinationNode | null;
    localInstrumentStream: MediaStream | null;
    private micStream;
    private micSourceNode;
    private isRecording;
    private recorder;
    private recordedChunks;
    init(): Promise<void>;
    loadAllInstruments(): Promise<boolean>;
    noteOn(instrumentName: string, note: string | string[]): void;
    noteOff(instrumentName: string, note: string | string[]): void;
    toggleMic(enabled: boolean): Promise<MediaStream | null>;
    startRecording(remoteStreams: MediaStream[]): void;
    stopRecording(): void;
}
export declare const toneManager: ToneManager;
export {};
