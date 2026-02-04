
import { Component, inject, signal, OnInit } from '@angular/core';
import { AiService } from './services/ai.service';
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
  isStarted = signal(false);

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
}
