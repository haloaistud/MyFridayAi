
import { Injectable, signal, computed, inject } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { IntentAnalyzerService } from './intent.analyzer';
import { AnalyticsService } from './analytics.service';
import { ConversationStoreService } from './conversation.store';
import { PersonalityManagerService } from './personality.manager';
import { ErrorRecoveryService } from './error.recovery';
import { EmotionalState, PersonalityMode } from './types';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface DiagnosticLog {
  msg: string;
  status: 'pending' | 'success' | 'error';
}

// Keep for backward compatibility
export interface EmotionalContext extends EmotionalState {}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  // Dependencies
  private intentAnalyzer = inject(IntentAnalyzerService);
  private analytics = inject(AnalyticsService);
  private conversationStore = inject(ConversationStoreService);
  private personalityManager = inject(PersonalityManagerService);
  private errorRecovery = inject(ErrorRecoveryService);

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
  emotionalContext = signal<EmotionalState>({
    dominantEmotion: 'neutral',
    energyLevel: 'medium',
    conversationDepth: 'shallow',
    userState: 'calm',
    confidence: 0.5
  });
  
  // Diagnostics
  booting = signal<boolean>(true);
  diagnosticLogs = signal<DiagnosticLog[]>([]);

  private recognition: any;
  private silenceTimer: any;
  private readonly SILENCE_THRESHOLD = 1500; // 1.5s silence to trigger end of turn

  constructor() {
    this.initSpeechRecognition();
    this.conversationStore.loadFromLocalStorage();
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
    const conversationContext = this.conversationStore.getContextSummary();
    const personalityInstruction = this.personalityManager.getPersonalityInstruction();
    
    return `You are Friday, an advanced AI companion with a dynamic emotional core.
    
${personalityInstruction}

CURRENT EMOTIONAL CONTEXT:
- User Dominant Emotion: ${context.dominantEmotion}
- Energy Level: ${context.energyLevel}
- Conversation Depth: ${context.conversationDepth}
- Observed User State: ${context.userState}
- Analysis Confidence: ${(context.confidence * 100).toFixed(0)}%

${conversationContext}

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

    const startTime = performance.now();

    // Detect intent for this message
    const intent = this.intentAnalyzer.analyzeIntent(text);
    this.analytics.recordIntent(intent.type);

    // Auto-select personality based on intent (can be overridden)
    const suggestedPersonality = this.personalityManager.suggestPersonalityForIntent(intent.type);
    if (suggestedPersonality !== PersonalityMode.DEFAULT) {
      this.personalityManager.setPersonality(suggestedPersonality);
      this.analytics.recordPersonalityUsed(suggestedPersonality);
    }

    // Add to conversation store
    this.messages.update(prev => [...prev, { role: 'user', content: text }]);
    this.conversationStore.addUserMessage(text, intent);
    
    this.isTyping.set(true);
    this.stopSpeaking(); // Cut off self if interrupted

    try {
      // Use context-aware conversation history
      const history = this.conversationStore.getFormattedHistory();

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
                  userState: { type: Type.STRING, description: "Brief description of user's current vibe." },
                  confidence: { type: Type.NUMBER, description: "Confidence in emotional assessment (0-1)" }
                }
              }
            }
          }
        }
      });

      const jsonResponse = JSON.parse(response.text);
      
      // Update Emotional State and record analytics
      if (jsonResponse.emotionalContext) {
        this.emotionalContext.set(jsonResponse.emotionalContext);
        this.analytics.recordEmotion(jsonResponse.emotionalContext);
      }

      const spokenText = jsonResponse.reply;
      this.messages.update(prev => [...prev, { role: 'assistant', content: spokenText }]);
      
      const responseTime = performance.now() - startTime;
      this.conversationStore.addAssistantMessage(spokenText, responseTime);
      this.analytics.recordMessage(responseTime);
      
      // Mark error as recovered if we succeeded
      this.errorRecovery.markErrorAsRecovered();
      
      if (this.speechEnabled()) {
        await this.speak(spokenText);
        // Seamless turn-taking
        this.autoTriggerListen();
      }
    } catch (error) {
      console.error("Neural processing error:", error);
      
      // Handle the error with recovery strategy
      const recovered = await this.errorRecovery.handleError(error, 'content-generation');
      
      if (recovered) {
        // Retry automatically
        return this.sendMessage(text);
      }
      
      // Fallback response
      const fallback = this.errorRecovery.getFallbackResponse('content-generation');
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

      // Dynamic Voice Modulation - use personality settings
      const personalityVoice = this.personalityManager.getVoiceModulation();
      const context = this.emotionalContext();
      
      // Start with personality settings
      utterance.pitch = personalityVoice.pitch;
      utterance.rate = personalityVoice.rate;
      
      // Layer emotional modulation on top
      if (context.energyLevel === 'high') {
        utterance.rate *= 1.15;
        utterance.pitch *= 1.15;
      } else if (context.energyLevel === 'low') {
        utterance.rate *= 0.85;
        utterance.pitch *= 0.85;
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
      if (!this.recognition) {
        this.errorRecovery.logError('speech-recognition', 'No speech recognition available');
        return reject("No sensory module");
      }
      
      // Reset state
      let finalTranscript = '';
      clearTimeout(this.silenceTimer);
      
      try {
        this.recognition.start();
        this.isListening.set(true);
      } catch (e) {
        this.errorRecovery.logError('speech-recognition', e);
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
          this.errorRecovery.logError('speech-recognition-error', err);
          console.warn("Speech error:", err);
        }
        // Don't reject, just resolve empty to keep loop alive if needed
      };

      this.recognition.onend = () => {
        this.isListening.set(false);
        // If we stopped naturally (silence timer or browser timeout)
        // Check if we have a result. If not, resolve empty.
        // If silence timer fired, it already resolved.
        resolve(finalTranscript); 
      };
    });
  }
}
