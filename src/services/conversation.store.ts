import { Injectable, signal } from '@angular/core';
import { IntentType, PersonalityMode, EmotionalState, Intent } from './types';

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  intent?: Intent;
  timestamp: Date;
  responseTimeMs?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConversationStoreService {
  private conversationHistory = signal<StoredMessage[]>([]);
  private contextWindow = 15; // Keep last 15 messages for context
  private storageKey = 'friday_conversation_history';

  get history() {
    return this.conversationHistory;
  }

  get contextMessages(): StoredMessage[] {
    return this.conversationHistory().slice(-this.contextWindow);
  }

  addMessage(message: StoredMessage) {
    this.conversationHistory.update(prev => [...prev, message]);
    this.persistToLocalStorage();
  }

  addUserMessage(content: string, intent?: Intent) {
    this.addMessage({
      role: 'user',
      content,
      intent,
      timestamp: new Date()
    });
  }

  addAssistantMessage(content: string, responseTimeMs?: number) {
    this.addMessage({
      role: 'assistant',
      content,
      timestamp: new Date(),
      responseTimeMs
    });
  }

  /**
   * Get messages formatted for API consumption
   */
  getFormattedHistory() {
    return this.contextMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
  }

  /**
   * Build a context summary for the system prompt
   */
  getContextSummary(): string {
    const history = this.contextMessages;
    if (history.length === 0) return 'This is the start of the conversation.';

    const recentTopics = this.extractTopics(history);
    const emotionalTrajectory = this.getEmotionalTrajectory(history);
    const conversationLength = history.length;

    return `
Conversation Context:
- Messages exchanged: ${conversationLength}
- Recent topics: ${recentTopics.join(', ') || 'general'}
- Emotional trajectory: ${emotionalTrajectory}
- User seems to be: ${this.analyzeUserState(history)}
    `.trim();
  }

  /**
   * Search conversation history by keyword
   */
  searchHistory(keyword: string): StoredMessage[] {
    return this.conversationHistory().filter(m =>
      m.content.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Get summary of conversation topics
   */
  extractTopics(messages: StoredMessage[]): string[] {
    const topicKeywords = ['work', 'family', 'health', 'relationship', 'feeling', 'problem', 'goal', 'stress'];
    const topics = new Set<string>();

    messages.forEach(m => {
      topicKeywords.forEach(keyword => {
        if (m.content.toLowerCase().includes(keyword)) {
          topics.add(keyword);
        }
      });
    });

    return Array.from(topics);
  }

  private getEmotionalTrajectory(messages: StoredMessage[]): string {
    if (messages.length < 2) return 'early in conversation';
    
    const startMessage = messages[0].content.toLowerCase();
    const endMessage = messages[messages.length - 1].content.toLowerCase();

    const emotionWords = {
      positive: ['good', 'great', 'happy', 'excited', 'better', 'proud', 'grateful'],
      negative: ['bad', 'sad', 'angry', 'frustrated', 'anxious', 'worried', 'upset'],
      neutral: ['okay', 'fine', 'alright', 'normal', 'same']
    };

    const startEmotion = this.detectEmotion(startMessage, emotionWords);
    const endEmotion = this.detectEmotion(endMessage, emotionWords);

    if (startEmotion === endEmotion) {
      return `consistently ${startEmotion}`;
    }
    return `shifted from ${startEmotion} to ${endEmotion}`;
  }

  private analyzeUserState(messages: StoredMessage[]): string {
    if (messages.length === 0) return 'just starting';

    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return 'engaged';

    const content = lastUserMessage.content.toLowerCase();
    if (content.length < 10) return 'brief/uncertain';
    if (content.includes('?')) return 'questioning/curious';
    if (content.includes('!')) return 'excited/emphatic';
    if (content.includes('...')) return 'thoughtful';
    return 'engaged';
  }

  private detectEmotion(text: string, emotionWords: any): string {
    for (const emotion of Object.keys(emotionWords)) {
      if ((emotionWords[emotion] as string[]).some(word => text.includes(word))) {
        return emotion;
      }
    }
    return 'neutral';
  }

  async exportConversation(): Promise<string> {
    const data = {
      timestamp: new Date().toISOString(),
      messageCount: this.conversationHistory().length,
      messages: this.conversationHistory()
    };
    return JSON.stringify(data, null, 2);
  }

  clear() {
    this.conversationHistory.set([]);
    localStorage.removeItem(this.storageKey);
  }

  private persistToLocalStorage() {
    try {
      const data = this.conversationHistory();
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to persist conversation to storage:', e);
    }
  }

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.conversationHistory.set(parsed);
      }
    } catch (e) {
      console.warn('Failed to load conversation from storage:', e);
    }
  }
}
