import { GoogleGenAI, Content, Part, Modality, LiveServerMessage } from "@google/genai";
import { Message, Attachment, AppMode, GenerationConfig } from "../types";

const API_KEY = process.env.API_KEY || '';

if (!API_KEY) {
  console.warn("Missing API_KEY in environment variables. Chat functionality will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Models
const CHAT_MODEL = 'gemini-3-pro-preview';
const THINKING_MODEL = 'gemini-3-pro-preview';
const MAPS_MODEL = 'gemini-2.5-flash';
const FAST_MODEL = 'gemini-2.5-flash-lite'; // Fast responses
const AUDIO_MODEL = 'gemini-2.5-flash'; 
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';
const IMAGE_EDIT_MODEL = 'gemini-2.5-flash-image';
const VIDEO_GEN_MODEL = 'veo-3.1-fast-generate-preview';

/**
 * Maps our internal Message type to the Gemini Content format.
 */
const mapMessagesToHistory = (messages: Message[]): Content[] => {
  return messages
    .filter(msg => !msg.isError)
    .filter(msg => msg.content || (msg.attachments && msg.attachments.length > 0))
    .map((msg) => {
      const parts: Part[] = [];
      
      if (msg.content) parts.push({ text: msg.content });

      if (msg.attachments) {
        msg.attachments.forEach(att => {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data
            }
          });
        });
      }

      return {
        role: msg.role,
        parts: parts,
      };
    });
};

/**
 * Handles Text, Maps, Thinking, Fast, and Analysis interactions.
 */
export const streamResponse = async (
  history: Message[],
  newMessage: string,
  attachments: Attachment[],
  mode: AppMode,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  try {
    const formattedHistory = mapMessagesToHistory(history);
    
    // Determine Model and Config based on Mode
    let model = CHAT_MODEL;
    let config: any = {
      systemInstruction: "You are Aira, a sophisticated AI assistant. Use Markdown.",
    };

    if (mode === 'thinking') {
      model = THINKING_MODEL;
      config.thinkingConfig = { thinkingBudget: 32768 }; 
    } else if (mode === 'fast') {
      model = FAST_MODEL;
    } else if (mode === 'maps') {
      model = MAPS_MODEL;
      config.tools = [{ googleMaps: {} }];
      try {
         if (navigator.geolocation) {
           // Placeholder for location handling
         }
      } catch (e) { console.error("Loc error", e); }
    } else if (attachments.length > 0) {
        const hasAudio = attachments.some(a => a.mimeType.startsWith('audio/'));
        if (hasAudio) {
            model = AUDIO_MODEL;
        }
        // If has video, CHAT_MODEL (gemini-3-pro-preview) is used, which supports Video Understanding.
    }

    const currentParts: Part[] = [];
    if (newMessage) currentParts.push({ text: newMessage });
    attachments.forEach(att => {
      currentParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });

    const chat = ai.chats.create({
      model: model,
      history: formattedHistory,
      config: config,
    });

    const result = await chat.sendMessageStream({
      message: currentParts,
    });

    let fullText = "";

    for await (const chunk of result) {
      if (signal?.aborted) break;
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
    return fullText;

  } catch (error: any) {
    if (signal?.aborted) return "";
    console.error("Chat Error:", error);
    throw mapError(error);
  }
};

/**
 * Generates Speech from text using Gemini 2.5 Flash TTS
 */
export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Voices: Puck, Charon, Kore, Fenrir, Zephyr
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");

    // Convert raw PCM to WAV for playback
    return base64PCMToWav(base64Audio, 24000); 

  } catch (error: any) {
    console.error("TTS Error:", error);
    throw mapError(error);
  }
};

/**
 * Helper: Convert Base64 PCM (Int16) to WAV Data URL
 */
const base64PCMToWav = (base64Pcm: string, sampleRate: number): string => {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const pcmData = new Int16Array(bytes.buffer);
  
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.byteLength, true);
  writeString(view, 8, 'WAVE');
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // Bits per sample
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.byteLength, true);

  const blob = new Blob([view, pcmData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};


/**
 * Live API Client Manager
 */
export class LiveClient {
  private session: any = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private onStatusChange: (status: 'connected' | 'disconnected' | 'error') => void;

  constructor(onStatusChange: (status: 'connected' | 'disconnected' | 'error') => void) {
    this.onStatusChange = onStatusChange;
  }

  async connect() {
    try {
      this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            this.onStatusChange('connected');
            this.startAudioInput(stream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
             const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
               await this.playAudio(audioData);
             }
          },
          onclose: () => this.onStatusChange('disconnected'),
          onerror: () => this.onStatusChange('error'),
        },
        config: {
           responseModalities: [Modality.AUDIO],
           speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      
      this.session = await sessionPromise;

    } catch (e) {
      console.error("Live Connect Error:", e);
      this.onStatusChange('error');
    }
  }

  private startAudioInput(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.inputContext) return;
    this.inputSource = this.inputContext.createMediaStreamSource(stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = inputData[i] * 0x7FFF;
      }
      
      // Send raw PCM bytes base64 encoded
      let binary = '';
      const bytes = new Uint8Array(pcm16.buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      sessionPromise.then(session => {
        session.sendRealtimeInput({
          media: {
            mimeType: "audio/pcm;rate=16000",
            data: base64
          }
        });
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  private async playAudio(base64: string) {
     if (!this.outputContext) return;
     
     // Decode Base64 to ArrayBuffer
     const binaryString = atob(base64);
     const len = binaryString.length;
     const bytes = new Uint8Array(len);
     for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
     }
     const int16 = new Int16Array(bytes.buffer);
     
     // Convert to AudioBuffer
     const audioBuffer = this.outputContext.createBuffer(1, int16.length, 24000);
     const channelData = audioBuffer.getChannelData(0);
     for (let i = 0; i < int16.length; i++) {
        channelData[i] = int16[i] / 32768.0;
     }

     // Schedule playback
     const source = this.outputContext.createBufferSource();
     source.buffer = audioBuffer;
     source.connect(this.outputContext.destination);
     
     const currentTime = this.outputContext.currentTime;
     if (this.nextStartTime < currentTime) {
       this.nextStartTime = currentTime;
     }
     source.start(this.nextStartTime);
     this.nextStartTime += audioBuffer.duration;
  }

  disconnect() {
    this.session?.close(); // Helper close method if available on the session wrapper, otherwise we assume disconnect closes socket
    this.inputSource?.disconnect();
    this.processor?.disconnect();
    this.inputContext?.close();
    this.outputContext?.close();
    this.onStatusChange('disconnected');
  }
}

// ... existing image/video gen methods ...

export const generateImage = async (prompt: string, config: GenerationConfig, attachment?: Attachment): Promise<string> => {
  try {
    if (attachment) {
       const response = await ai.models.generateContent({
        model: IMAGE_EDIT_MODEL,
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: attachment.mimeType, data: attachment.data } }
          ]
        },
      });
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part && part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      throw new Error("No image returned from edit.");
    } else {
      const response = await ai.models.generateContent({
        model: IMAGE_GEN_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: config.aspectRatio || "1:1",
            imageSize: config.imageSize || "1K"
          }
        }
      });
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part && part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      throw new Error("No image generated.");
    }
  } catch (error: any) { throw mapError(error); }
};

export const generateVideo = async (prompt: string, config: GenerationConfig, attachment?: Attachment): Promise<string> => {
  try {
    const payload: any = {
      model: VIDEO_GEN_MODEL,
      prompt: prompt,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: config.aspectRatio || '16:9' }
    };
    if (attachment) {
      payload.image = { imageBytes: attachment.data, mimeType: attachment.mimeType };
    }
    let operation = await ai.models.generateVideos(payload);
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Video generation failed.");
    return `${videoUri}&key=${API_KEY}`;
  } catch (error: any) { throw mapError(error); }
};

export const generateChatTitle = async (firstMessage: string): Promise<string> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a 3-word title for: "${firstMessage}"`,
      });
      return response.text?.trim() || "New Chat";
    } catch (e) { return "New Chat"; }
};

const mapError = (error: any): Error => {
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes("429") || msg.includes("exhausted")) return new Error("Rate limit exceeded. Try again later.");
    if (msg.includes("safety")) return new Error("Content blocked by safety settings.");
    return new Error(error.message || "An unexpected error occurred.");
};