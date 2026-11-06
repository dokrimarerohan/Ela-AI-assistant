/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioStreamer {
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private muteGain: GainNode | null = null;

  private activeSourceNodes: Set<AudioBufferSourceNode> = new Set();
  private nextScheduledTime: number = 0;
  private isRecording: boolean = false;
  
  public onPlaybackStateChange?: (isPlaying: boolean) => void;

  constructor(private inputSampleRate: number = 16000, private outputSampleRate: number = 24000) {}

  /**
   * Starts microphone recording with hardware acoustic echo cancellation & noise suppression.
   */
  async startRecording(onData: (base64Data: string) => void) {
    if (this.isRecording) {
      this.stopRecording();
    }

    try {
      // Request audio stream with strict echo cancellation to prevent Ela's voice from feeding back into the mic
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: this.inputSampleRate,
        },
      });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioContext = new AudioContextClass({ sampleRate: this.inputSampleRate });
      
      if (this.inputAudioContext.state === "suspended") {
        await this.inputAudioContext.resume();
      }

      this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
      
      // Use 2048 buffer size (128ms at 16kHz) for low-latency dispatching to Gemini Live
      this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatToPcm16(inputData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        onData(base64);
      };

      this.source.connect(this.processor);

      // Connect through a zero-gain node so we do NOT output local mic audio to speakers
      this.muteGain = this.inputAudioContext.createGain();
      this.muteGain.gain.value = 0;
      this.processor.connect(this.muteGain);
      this.muteGain.connect(this.inputAudioContext.destination);

      this.isRecording = true;
    } catch (err) {
      console.error("Failed to start recording:", err);
      this.stopRecording();
      throw err;
    }
  }

  stopRecording() {
    this.isRecording = false;
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.muteGain) {
      this.muteGain.disconnect();
      this.muteGain = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close().catch(() => {});
      this.inputAudioContext = null;
    }
  }

  private getOutputContext(): AudioContext {
    if (!this.outputAudioContext || this.outputAudioContext.state === "closed") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioContext = new AudioContextClass({ sampleRate: this.outputSampleRate });
    }
    if (this.outputAudioContext.state === "suspended") {
      this.outputAudioContext.resume().catch(() => {});
    }
    return this.outputAudioContext;
  }

  /**
   * Adds an incoming PCM16 (24kHz) audio chunk and seamlessly schedules it on the Web Audio timeline.
   */
  addPlaybackChunk(base64Data: string) {
    if (!base64Data) return;

    try {
      const buffer = this.base64ToArrayBuffer(base64Data);
      const pcm16 = new Int16Array(buffer);
      if (pcm16.length === 0) return;

      const float32 = this.pcm16ToFloat32(pcm16);
      const ctx = this.getOutputContext();

      const audioBuffer = ctx.createBuffer(1, float32.length, this.outputSampleRate);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      // If idle or starting fresh, add a tiny 25ms lead-time buffer to prevent initial buffer underrun/glitches
      if (this.nextScheduledTime < now) {
        this.nextScheduledTime = now + 0.025;
      }

      const startTime = this.nextScheduledTime;
      source.start(startTime);
      this.nextScheduledTime = startTime + audioBuffer.duration;

      this.activeSourceNodes.add(source);
      this.onPlaybackStateChange?.(true);

      source.onended = () => {
        this.activeSourceNodes.delete(source);
        if (this.activeSourceNodes.size === 0 && (!this.outputAudioContext || this.outputAudioContext.currentTime >= this.nextScheduledTime - 0.05)) {
          this.onPlaybackStateChange?.(false);
        }
      };
    } catch (err) {
      console.error("Error scheduling playback chunk:", err);
    }
  }

  /**
   * Instantly stops all playing and queued audio (called on interruption or session end).
   */
  clearPlaybackQueue() {
    this.activeSourceNodes.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Node might have already finished
      }
    });
    this.activeSourceNodes.clear();
    this.nextScheduledTime = 0;
    this.onPlaybackStateChange?.(false);
  }

  private floatToPcm16(float32: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  private pcm16ToFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 0x8000;
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
