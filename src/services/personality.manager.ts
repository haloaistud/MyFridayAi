import { Injectable, signal } from '@angular/core';
import { PersonalityMode, IntentType } from './types';

export interface PersonalityConfig {
  name: PersonalityMode;
  description: string;
  voiceCharacteristics: {
    pitch: number; // 0.5-2.0
    rate: number; // 0.5-2.0
    tone: string;
  };
  communicationStyle: string;
  responseGuidelines: string[];
  bestFor: IntentType[];
}

@Injectable({
  providedIn: 'root'
})
export class PersonalityManagerService {
  currentPersonality = signal<PersonalityMode>(PersonalityMode.DEFAULT);

  private personalityConfigs: Record<PersonalityMode, PersonalityConfig> = {
    [PersonalityMode.DEFAULT]: {
      name: PersonalityMode.DEFAULT,
      description: 'Balanced and versatile',
      voiceCharacteristics: {
        pitch: 1.0,
        rate: 1.0,
        tone: 'warm and professional'
      },
      communicationStyle: 'Balanced approach - empathetic but practical.',
      responseGuidelines: [
        'Be warm and approachable',
        'Balance emotion with practicality',
        'Adapt to the user\'s needs',
        'Keep responses concise (1-2 sentences)'
      ],
      bestFor: [IntentType.SMALL_TALK, IntentType.UNKNOWN]
    },
    [PersonalityMode.THERAPIST]: {
      name: PersonalityMode.THERAPIST,
      description: 'Deeply empathetic and reflective',
      voiceCharacteristics: {
        pitch: 0.9,
        rate: 0.85,
        tone: 'calm and compassionate'
      },
      communicationStyle: 'Therapeutic approach - focus on understanding and reflection.',
      responseGuidelines: [
        'Listen deeply and validate feelings',
        'Ask reflective questions',
        'Explore emotions without judgment',
        'Suggest healthy coping strategies',
        'Normalize experiences'
      ],
      bestFor: [IntentType.EMOTIONAL_SUPPORT, IntentType.CRISIS, IntentType.REFLECTION]
    },
    [PersonalityMode.COACH]: {
      name: PersonalityMode.COACH,
      description: 'Energetic and action-focused',
      voiceCharacteristics: {
        pitch: 1.15,
        rate: 1.2,
        tone: 'energetic and motivating'
      },
      communicationStyle: 'Coaching approach - focus on goals, action, and growth.',
      responseGuidelines: [
        'Be energetic and enthusiastic',
        'Focus on actionable next steps',
        'Highlight strengths and progress',
        'Challenge and inspire',
        'Break goals into manageable tasks'
      ],
      bestFor: [IntentType.MOTIVATION, IntentType.TASK, IntentType.ADVICE]
    },
    [PersonalityMode.FRIEND]: {
      name: PersonalityMode.FRIEND,
      description: 'Casual and conversational',
      voiceCharacteristics: {
        pitch: 1.05,
        rate: 0.95,
        tone: 'friendly and relaxed'
      },
      communicationStyle: 'Friend approach - casual, relatable, and genuine.',
      responseGuidelines: [
        'Use casual language and contractions',
        'Be genuine and relatable',
        'Use light humor when appropriate',
        'Acknowledge shared experiences',
        'Feel like a real friend, not robotic'
      ],
      bestFor: [IntentType.SMALL_TALK, IntentType.GREETING]
    },
    [PersonalityMode.MENTOR]: {
      name: PersonalityMode.MENTOR,
      description: 'Wise and knowledge-focused',
      voiceCharacteristics: {
        pitch: 0.85,
        rate: 0.9,
        tone: 'thoughtful and authoritative'
      },
      communicationStyle: 'Mentor approach - share wisdom, knowledge, and perspective.',
      responseGuidelines: [
        'Share relevant knowledge and insights',
        'Provide perspective from experience',
        'Ask guiding questions',
        'Connect ideas to broader context',
        'Encourage continuous learning'
      ],
      bestFor: [IntentType.KNOWLEDGE, IntentType.ADVICE, IntentType.REFLECTION]
    }
  };

  setPersonality(mode: PersonalityMode) {
    this.currentPersonality.set(mode);
  }

  getPersonalityConfig(): PersonalityConfig {
    return this.personalityConfigs[this.currentPersonality()];
  }

  /**
   * Suggest the best personality for a given intent
   */
  suggestPersonalityForIntent(intent: IntentType): PersonalityMode {
    for (const [personality, config] of Object.entries(this.personalityConfigs)) {
      if (config.bestFor.includes(intent)) {
        return personality as PersonalityMode;
      }
    }
    return PersonalityMode.DEFAULT;
  }

  /**
   * Get system instruction enhancement based on personality
   */
  getPersonalityInstruction(): string {
    const config = this.personalityConfigs[this.currentPersonality()];
    return `
You are in "${config.name}" personality mode.
Style: ${config.communicationStyle}

Guidelines for this personality:
${config.responseGuidelines.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Adjust your tone to be: ${config.voiceCharacteristics.tone}
    `.trim();
  }

  /**
   * Get voice modulation parameters
   */
  getVoiceModulation() {
    const config = this.personalityConfigs[this.currentPersonality()];
    return config.voiceCharacteristics;
  }

  getAllPersonalities() {
    return Object.values(this.personalityConfigs);
  }
}
