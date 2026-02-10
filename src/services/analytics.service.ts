import { Injectable, signal } from '@angular/core';
import { ConversationMetrics, IntentType, PersonalityMode, EmotionalState } from './types';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  metrics = signal<ConversationMetrics>({
    messageCount: 0,
    averageResponseTime: 0,
    emotionTrend: [],
    engagementScore: 0,
    personalitiesUsed: [],
    intentsDetected: [],
    startTime: new Date(),
  });

  private messageTimes: number[] = [];
  private emotionHistory: EmotionalState[] = [];

  recordMessage(responseTimeMs: number) {
    this.messageTimes.push(responseTimeMs);
    this.metrics.update(m => ({
      ...m,
      messageCount: m.messageCount + 1,
      averageResponseTime: this.calculateAverageResponseTime()
    }));
  }

  recordEmotion(emotion: EmotionalState) {
    this.emotionHistory.push(emotion);
    this.metrics.update(m => ({
      ...m,
      emotionTrend: [...m.emotionTrend, emotion.dominantEmotion]
    }));
    this.updateEngagementScore();
  }

  recordIntent(intent: IntentType) {
    this.metrics.update(m => ({
      ...m,
      intentsDetected: [...new Set([...m.intentsDetected, intent])]
    }));
  }

  recordPersonalityUsed(personality: PersonalityMode) {
    this.metrics.update(m => ({
      ...m,
      personalitiesUsed: [...new Set([...m.personalitiesUsed, personality])]
    }));
  }

  private calculateAverageResponseTime(): number {
    if (this.messageTimes.length === 0) return 0;
    const sum = this.messageTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.messageTimes.length);
  }

  private updateEngagementScore() {
    const messageCount = this.metrics().messageCount;
    const avgResponseTime = this.metrics().averageResponseTime;
    const emotionVariety = new Set(this.emotionHistory.map(e => e.dominantEmotion)).size;

    // Engagement score: consider message count, response time, and emotional variety
    let score = 0;
    score += Math.min(messageCount * 5, 30); // Message count (0-30 points)
    score += Math.max(40 - (avgResponseTime / 100), 0); // Faster response = higher engagement (0-40 points)
    score += emotionVariety * 5; // Emotional variation (0-30 points)

    this.metrics.update(m => ({
      ...m,
      engagementScore: Math.min(score, 100)
    }));
  }

  getConversationSummary(): string {
    const m = this.metrics();
    const duration = new Date().getTime() - m.startTime.getTime();
    const minutes = Math.floor(duration / 60000);

    return `
      Conversation Summary:
      - Messages: ${m.messageCount}
      - Duration: ${minutes}m
      - Avg Response Time: ${m.averageResponseTime}ms
      - Engagement Score: ${Math.round(m.engagementScore)}/100
      - Primary Emotion: ${m.emotionTrend[m.emotionTrend.length - 1] || 'unknown'}
      - Personalities Used: ${m.personalitiesUsed.join(', ') || 'default'}
    `.trim();
  }

  reset() {
    this.messageTimes = [];
    this.emotionHistory = [];
    this.metrics.set({
      messageCount: 0,
      averageResponseTime: 0,
      emotionTrend: [],
      engagementScore: 0,
      personalitiesUsed: [],
      intentsDetected: [],
      startTime: new Date(),
    });
  }
}
