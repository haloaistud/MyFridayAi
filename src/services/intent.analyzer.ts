import { Injectable } from '@angular/core';
import { Intent, IntentType } from './types';

@Injectable({
  providedIn: 'root'
})
export class IntentAnalyzerService {
  private intentPatterns: Record<IntentType, { keywords: string[]; patterns: RegExp[] }> = {
    [IntentType.GREETING]: {
      keywords: ['hello', 'hi', 'hey', 'greetings', 'how are you', 'morning', 'evening'],
      patterns: [/^(hello|hi|hey|greetings|howdy)/i]
    },
    [IntentType.EMOTIONAL_SUPPORT]: {
      keywords: ['sad', 'depressed', 'anxious', 'worried', 'scared', 'hurt', 'struggling', 'pain', 'suffering', 'help', 'support', 'need'],
      patterns: [/feel(ing)?\s*(sad|bad|down|depressed|anxious|worried|scared)/i, /i.*need.*help/i, /struggling.*with/i]
    },
    [IntentType.MOTIVATION]: {
      keywords: ['motivate', 'inspire', 'encourage', 'push', 'goal', 'achieve', 'workout', 'energy', 'stuck', 'procrastinating'],
      patterns: [/motivat|inspir|encour|push|get.*going/i, /stuck|procrastinating/i]
    },
    [IntentType.ADVICE]: {
      keywords: ['advice', 'suggest', 'recommend', 'what should', 'how should', 'tip', 'help with', 'guide'],
      patterns: [/what.*should.*i|how.*should.*i|give.*advice|recommend/i]
    },
    [IntentType.TASK]: {
      keywords: ['remind', 'task', 'todo', 'schedule', 'plan', 'deadline', 'work', 'project'],
      patterns: [/remind|task|todo|schedule|deadline|project/i]
    },
    [IntentType.KNOWLEDGE]: {
      keywords: ['tell me', 'explain', 'what is', 'how does', 'why', 'fact', 'learn'],
      patterns: [/tell.*me|explain|what.*is|how.*does|why|learn.*about/i]
    },
    [IntentType.SMALL_TALK]: {
      keywords: ['weather', 'day', 'doing', 'whats up', 'how is', 'today'],
      patterns: [/how.*day|whats.*up|weather|how.*doing/i]
    },
    [IntentType.REFLECTION]: {
      keywords: ['think', 'reflect', 'wonder', 'question', 'understand', 'meaning', 'philosophy'],
      patterns: [/think.*about|reflect|wonder|meaning|philosophy/i]
    },
    [IntentType.CRISIS]: {
      keywords: ['suicide', 'harm', 'die', 'death', 'emergency', 'urgent', 'critical', 'severe'],
      patterns: [/suicid|harm.*myself|want.*to.*die|emergency|urgent.*help/i]
    },
    [IntentType.UNKNOWN]: {
      keywords: [],
      patterns: []
    }
  };

  analyzeIntent(text: string): Intent {
    const lowerText = text.toLowerCase();
    
    // Check for crisis first (highest priority)
    const crisisMatch = this.checkIntentType(IntentType.CRISIS, lowerText);
    if (crisisMatch.confidence > 0.7) {
      return crisisMatch;
    }

    const scores: Record<IntentType, number> = {} as Record<IntentType, number>;

    // Score each intent type
    Object.entries(this.intentPatterns).forEach(([intentType, config]) => {
      let score = 0;

      // Pattern matching (higher weight)
      config.patterns.forEach(pattern => {
        if (pattern.test(text)) {
          score += 0.6;
        }
      });

      // Keyword matching (lower weight)
      const keywordMatches = config.keywords.filter(kw => 
        lowerText.includes(kw)
      ).length;
      score += (keywordMatches / Math.max(config.keywords.length, 1)) * 0.4;

      scores[intentType as IntentType] = Math.min(score, 1);
    });

    // Get the highest scoring intent
    const topIntent = Object.entries(scores).reduce((prev, current) =>
      current[1] > prev[1] ? current : prev
    )[0] as IntentType;

    return this.checkIntentType(topIntent, lowerText);
  }

  private checkIntentType(type: IntentType, text: string): Intent {
    const config = this.intentPatterns[type];
    let confidence = 0;

    // Calculate confidence
    let patternMatch = config.patterns.some(p => p.test(text)) ? 0.5 : 0;
    const keywordMatches = config.keywords.filter(kw => text.includes(kw)).length;
    let keywordScore = (keywordMatches / Math.max(config.keywords.length, 1)) * 0.5;

    confidence = Math.min(patternMatch + keywordScore, 1);

    // If no strong match, mark as unknown
    if (confidence < 0.1 && type !== IntentType.UNKNOWN) {
      return {
        type: IntentType.UNKNOWN,
        confidence: 0.3,
        keywords: [],
        category: 'social'
      };
    }

    const categoryMap: Record<IntentType, 'personal' | 'practical' | 'emotional' | 'social'> = {
      [IntentType.GREETING]: 'social',
      [IntentType.EMOTIONAL_SUPPORT]: 'emotional',
      [IntentType.MOTIVATION]: 'personal',
      [IntentType.ADVICE]: 'practical',
      [IntentType.TASK]: 'practical',
      [IntentType.KNOWLEDGE]: 'practical',
      [IntentType.SMALL_TALK]: 'social',
      [IntentType.REFLECTION]: 'personal',
      [IntentType.CRISIS]: 'emotional',
      [IntentType.UNKNOWN]: 'social'
    };

    return {
      type,
      confidence: Math.max(confidence, 0.1),
      keywords: config.keywords.filter(kw => text.includes(kw)),
      category: categoryMap[type]
    };
  }

  /**
   * Get system instruction enhancement based on detected intent
   */
  getIntentBasedInstruction(intent: Intent): string {
    const instructionMap: Record<IntentType, string> = {
      [IntentType.GREETING]: 'Respond warmly and genuinely, establishing a positive connection.',
      [IntentType.EMOTIONAL_SUPPORT]: 'Show deep empathy. Validate their feelings. Offer grounding techniques or coping strategies.',
      [IntentType.MOTIVATION]: 'Be energetic and encouraging. Highlight their strengths. Suggest concrete next steps.',
      [IntentType.ADVICE]: 'Be thoughtful and balanced. Present options. Ask clarifying questions when needed.',
      [IntentType.TASK]: 'Be organized and action-oriented. Break down tasks. Suggest realistic timelines.',
      [IntentType.KNOWLEDGE]: 'Be informative but conversational. Keep it concise and relevant.',
      [IntentType.SMALL_TALK]: 'Be light and engaging. Keep responses conversational and natural.',
      [IntentType.REFLECTION]: 'Encourage deeper thinking. Ask thoughtful follow-up questions.',
      [IntentType.CRISIS]: 'This is a crisis situation. Treat with utmost care. Recommend professional help immediately.',
      [IntentType.UNKNOWN]: 'Ask clarifying questions to better understand their need.'
    };

    return instructionMap[intent.type] || '';
  }
}
