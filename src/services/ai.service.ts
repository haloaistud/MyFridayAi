
import { Injectable, signal, computed } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface DiagnosticLog {
  msg: string;
  status: 'pending' | 'success' | 'error';
}

export interface EmotionalContext {
  dominantEmotion: string;
  energyLevel: 'low' | 'medium' | 'high';
  conversationDepth: 'shallow' | 'deep' | 'profound';
  userState: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  // Using the provided enhanced API key
  private readonly API_KEY = "AIzaSyCXyt0l53wWgZSGwlgOPIkyD6R7W0fLnrU";
  private ai = new GoogleGenAI({ apiKey: this.API_KEY });
  
  messages = signal<Message[]>([]);
  
  // State Signals
  isTyping = signal<boolean>(false);
  isSpeaking = signal<boolean>(false);
  isListening = signal<boolean>(false);
  speechEnabled = signal<boolean>(true);
  
  // Emotional Intelligence State
  emotionalContext = signal<EmotionalContext>({
    dominantEmotion: 'neutral',
    energyLevel: 'medium',
    conversationDepth: 'shallow',
    userState: 'calm'
  });
  
  // Diagnostics
  booting = signal<boolean>(true);
  diagnosticLogs = signal<DiagnosticLog[]>([]);

  private recognition: any;
  private silenceTimer: any;
  private readonly SILENCE_THRESHOLD = 1500; // 1.5s silence to trigger end of turn

  constructor() {
    this.initSpeechRecognition();
  }

  async runDiagnostics() {
    this.booting.set(true);
    this.diagnosticLogs.set([]);

    const steps = [
      { key: 'key', label: 'NEURAL_CORE_AUTH', check: async () => !!this.API_KEY },
      { key: 'voice', label: 'VOCAL_SYNTHESIS_MODULE', check: async () => 'speechSynthesis' in window },
      { key: 'mic', label: 'AUDITORY_CORTEX_INIT', check: async () => !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition },
      { key: 'ready', label: 'EMOTIONAL_MATRIX_SYNC', check: async () => { await new Promise(r => setTimeout(r, 600)); return true; } }
    ];

    for (const step of steps) {
      this.diagnosticLogs.update(prev => [...prev, { msg: `INITIALIZING ${step.label}...`, status: 'pending' }]);
      await new Promise(r => setTimeout(r, 300));
      
      try {
        const ok = await step.check();
        this.diagnosticLogs.update(prev => {
          const updated = [...prev];
          updated[updated.length - 1].status = ok ? 'success' : 'error';
          updated[updated.length - 1].msg = `${step.label}: ${ok ? 'ONLINE' : 'OFFLINE'}`;
          return updated;
        });
      } catch (e) {
        console.error("Diagnostic failure:", e);
      }
    }

    await new Promise(r => setTimeout(r, 500));
    this.booting.set(false);
  }

  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      // Continuous required for manual silence detection
      this.recognition.continuous = true; 
      // Interim results needed to detect *when* speaking stops
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
  }

  private getSystemInstruction() {
    const context = this.emotionalContext();
    return `You are Friday, an advanced AI companion with a dynamic emotional core.
    
    CURRENT EMOTIONAL CONTEXT:
    - User Dominant Emotion: ${context.dominantEmotion}
    - Energy Level: ${context.energyLevel}
    - Conversation Depth: ${context.conversationDepth}
    - Observed User State: ${context.userState}

    ADAPTATION PROTOCOLS:
    - If user is Frustrated/Low Energy: Be patient, soothing, and concise.
    - If user is Excited/High Energy: Match enthusiasm, be snappy.
    - If user is Sad/Distressed: Shift to grounding techniques, warm empathy.
    - If Conversation Depth is 'Deep': Allow for slightly more philosophical or reflective answers (max 3 sentences).
    - Default: Keep responses EXTREMELY concise (1-2 sentences). Spoken conversation style.
    
    OUTPUT FORMAT:
    You must respond with a JSON object containing your reply and the updated emotional context based on the user's latest input.
    `;
  }

  async sendMessage(text: string) {
    if (!text.trim()) return;

    this.messages.update(prev => [...prev, { role: 'user', content: text }]);
    this.isTyping.set(true);
    this.stopSpeaking(); // Cut off self if interrupted

    try {
      const history = this.messages().slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history,
        config: {
          systemInstruction: this.getSystemInstruction(),
          temperature: 1.0, // Higher temp for more human-like variety
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING, description: "The spoken response to the user." },
              emotionalContext: {
                type: Type.OBJECT,
                properties: {
                  dominantEmotion: { type: Type.STRING, description: "The detected emotion of the user." },
                  energyLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
                  conversationDepth: { type: Type.STRING, enum: ["shallow", "deep", "profound"] },
                  userState: { type: Type.STRING, description: "Brief description of user's current vibe." }
                }
              }
            }
          }
        }
      });

      const jsonResponse = JSON.parse(response.text);
      
      // Update Emotional State
      if (jsonResponse.emotionalContext) {
        this.emotionalContext.set(jsonResponse.emotionalContext);
      }

      const spokenText = jsonResponse.reply;
      this.messages.update(prev => [...prev, { role: 'assistant', content: spokenText }]);
      
      if (this.speechEnabled()) {
        await this.speak(spokenText);
        // Seamless turn-taking
        this.autoTriggerListen();
      }
    } catch (error) {
      console.error("Neural processing error:", error);
      // Fallback in case of JSON error
      const fallback = "I'm having trouble processing that thought. Could you say it again?";
      await this.speak(fallback);
      this.autoTriggerListen();
    } finally {
      this.isTyping.set(false);
    }
  }

  private autoTriggerListen() {
    setTimeout(async () => {
      try {
        const transcript = await this.startListening();
        if (transcript) this.sendMessage(transcript);
        else {
            // If silence, maybe prompt? Or just wait. 
            // For now, let's just go idle to avoid infinite loops of silence.
            this.isListening.set(false);
        }
      } catch (e) {
        console.log("Listen cycle ended.");
      }
    }, 200);
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.stopSpeaking();
      
      // Simple text cleaning for TTS
      const cleanText = text.replace(/[*#]/g, '');
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      
      // Select best voice based on emotional context (subtle pitch/rate adjustments)
      const preferredVoice = voices.find(v => 
        v.name.includes('Google UK English Female') || 
        v.name.includes('Samantha') || 
        v.name.includes('Victoria') ||
        v.lang === 'en-US'
      );
      
      if (preferredVoice) utterance.voice = preferredVoice;

      // Dynamic Voice Modulation
      const context = this.emotionalContext();
      if (context.energyLevel === 'high') {
        utterance.rate = 1.1;
        utterance.pitch = 1.1;
      } else if (context.energyLevel === 'low') {
        utterance.rate = 0.9;
        utterance.pitch = 0.9;
      } else {
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
      }

      utterance.onstart = () => this.isSpeaking.set(true);
      utterance.onend = () => {
        this.isSpeaking.set(false);
        resolve();
      };
      utterance.onerror = () => {
        this.isSpeaking.set(false);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  stopSpeaking() {
    window.speechSynthesis.cancel();
    this.isSpeaking.set(false);
  }

  startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject("No sensory module");
      
      // Reset state
      let finalTranscript = '';
      clearTimeout(this.silenceTimer);
      
      try {
        this.recognition.start();
        this.isListening.set(true);
      } catch (e) {
        // Already started?
        return resolve(""); 
      }

      this.recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        // Silence Detection Logic
        clearTimeout(this.silenceTimer);
        
        // If we have some text, start the silence timer
        if (finalTranscript || interim) {
          this.silenceTimer = setTimeout(() => {
            this.recognition.stop();
            // Resolve with the full accumulated text
            resolve(finalTranscript + interim);
          }, this.SILENCE_THRESHOLD);
        }
      };

      this.recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
           console.warn("Speech error:", err);
        }
        // Don't reject, just resolve empty to keep loop alive if needed
        // But for 'aborted' or real errors, we might want to stop.
      };

      this.recognition.onend = () => {
        this.isListening.set(false);
        // If we stopped naturally (silence timer or browser timeout)
        // Check if we have a result. If not, resolve empty.
        // If silence timer fired, it already resolved.
        // We need to ensure we don't resolve twice.
        // The simplest way in a Promise is that the first resolve wins.
        resolve(finalTranscript); 
      };
    });
  }
}
