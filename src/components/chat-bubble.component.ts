
import { Component, input } from '@angular/core';
import { Message } from '../services/ai.service';

@Component({
  selector: 'app-chat-bubble',
  template: `
    <div [class]="message().role === 'user' ? 'flex justify-end' : 'flex justify-start'">
      <div [class]="message().role === 'user' ? 'max-w-[85%] chat-bubble-user p-5' : 'max-w-[85%] chat-bubble-ai p-5'">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-1.5 h-1.5 rounded-full" [class]="message().role === 'user' ? 'bg-indigo-400' : 'bg-cyan-400'"></div>
            <span class="text-[9px] uppercase font-black tracking-[0.2em] opacity-60">
              {{ message().role === 'user' ? 'User_Data' : 'Friday_Core' }}
            </span>
          </div>
          @if (message().mode) {
            <span class="text-[8px] uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded border border-white/10 text-slate-500 font-bold">
              Protocol: {{ message().mode }}
            </span>
          }
        </div>
        <p class="text-sm leading-relaxed text-slate-100 font-light tracking-wide whitespace-pre-wrap selection:bg-indigo-500/30">
          {{ message().content }}
        </p>
        <div class="mt-4 flex gap-1 opacity-20">
          @for (x of [1,2,3]; track $index) {
            <div class="w-8 h-0.5 bg-white/50"></div>
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: 1
})
export class ChatBubbleComponent {
  message = input.required<Message>();
}
