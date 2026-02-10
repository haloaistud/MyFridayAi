// Intent types and categorization
export enum IntentType {
  GREETING = 'greeting',
  EMOTIONAL_SUPPORT = 'emotional_support',
  MOTIVATION = 'motivation',
  ADVICE = 'advice',
  TASK = 'task',
  KNOWLEDGE = 'knowledge',
  SMALL_TALK = 'small_talk',
  REFLECTION = 'reflection',
  CRISIS = 'crisis',
  UNKNOWN = 'unknown'
}

export interface Intent {
  type: IntentType;
  confidence: number;
  keywords: string[];
  category: 'personal' | 'practical' | 'emotional' | 'social';
}

// Personality modes
export enum PersonalityMode {
  DEFAULT = 'default',
  THERAPIST = 'therapist',
  COACH = 'coach',
  FRIEND = 'friend',
  MENTOR = 'mentor'
}

export interface EmotionalState {
  dominantEmotion: string;
  energyLevel: 'low' | 'medium' | 'high';
  conversationDepth: 'shallow' | 'deep' | 'profound';
  userState: string;
  confidence: number; // 0-1 how confident we are in this assessment
}

// Analytics types
export interface ConversationMetrics {
  messageCount: number;
  averageResponseTime: number;
  emotionTrend: string[]; // Array of emotions over time
  engagementScore: number; // 0-100
  personalitiesUsed: PersonalityMode[];
  intentsDetected: IntentType[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface UserProfile {
  id: string;
  preferredPersonality: PersonalityMode;
  communicationStyle: 'verbose' | 'concise';
  emotionHistory: EmotionalState[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    intent?: Intent;
    timestamp: Date;
  }>;
  metrics: ConversationMetrics;
}

export interface ErrorRecoveryStrategy {
  retryCount: number;
  maxRetries: number;
  backoffMs: number;
  fallbackResponse: string;
}
