
import { Component, inject, signal, OnInit } from '@angular/core';
import { AiService } from './services/ai.service';
import { PersonalityManagerService } from './services/personality.manager';
import { AnalyticsService } from './services/analytics.service';
import { ConversationStoreService } from './services/conversation.store';
import { PersonalityMode } from './services/types';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrls: [],
  changeDetection: 0
})
export class AppComponent implements OnInit {
  ai = inject(AiService);
  personalityManager = inject(PersonalityManagerService);
  analytics = inject(AnalyticsService);
  conversationStore = inject(ConversationStoreService);
  
  isStarted = signal(false);
  showPersonalityMenu = signal(false);
  showAnalytics = signal(false);
  
  availablePersonalities = this.personalityManager.getAllPersonalities();
  currentPersonality = this.personalityManager.currentPersonality;
  metrics = this.analytics.metrics;

  ngOnInit() {
    this.ai.runDiagnostics();
  }

  async handleGlobalClick() {
    if (this.ai.booting()) return;
    
    // Initial Start
    if (!this.isStarted()) {
      this.isStarted.set(true);
      await this.ai.sendMessage("System engaged. Hello. I am Friday. How are you feeling right now?");
      return;
    }

    // Manual Interrupt if already started
    if (this.ai.isSpeaking()) {
      this.ai.stopSpeaking();
      this.listenLoop();
      return;
    }

    if (!this.ai.isListening() && !this.ai.isTyping()) {
      this.listenLoop();
    }
  }

  async listenLoop() {
    try {
      const transcript = await this.ai.startListening();
      if (transcript) {
        await this.ai.sendMessage(transcript);
        // The AiService now handles automatic re-listening in its own cycle
      }
    } catch (err) {
      console.error("Neural link interrupted:", err);
    }
  }

  switchPersonality(mode: PersonalityMode) {
    this.personalityManager.setPersonality(mode);
    this.showPersonalityMenu.set(false);
  }

  async exportConversation() {
    const data = await this.conversationStore.exportConversation();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `friday-conversation-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearConversation() {
    if (confirm('Clear all conversation history?')) {
      this.conversationStore.clear();
      this.analytics.reset();
      this.isStarted.set(false);
    }
  }
}
