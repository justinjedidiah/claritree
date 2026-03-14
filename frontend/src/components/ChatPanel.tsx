import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api/client';
import ReactMarkdown from 'react-markdown';
import { useFocusStore } from '../stores/useFocusStore';
import type { FocusItem } from '../stores/useFocusStore';
import { useBYOK } from '../hooks/useBYOK';
import BYOKModal from './BYOKModal';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import type { DashboardProps } from '../pages/Dashboard';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  toolCalls?: { name: string; input: unknown }[];
  isLoading?: boolean;
}

export default function ChatPanel({appliedFilters}: {appliedFilters: DashboardProps}) {
  // Chat related
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I help you analyze you graph?", sender: 'assistant' }
  ]);
  const [input, setInput] = useState('');
  const { byok, setKey, authHeaders } = useBYOK();
  const [isLoading, setIsLoading] = useState(false);
  const sessionId = useRef<string>(crypto.randomUUID());

  // Focus related
  const currentFocus = useFocusStore((s) => s.currentFocus)
  const pushFocus = useFocusStore((s) => s.pushFocus);
  const clearCurrentFocus = useFocusStore((s) => s.clearCurrentFocus);

  // Adjust height of text input for chat
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // cap at 4 lines (~24px per line + padding)
    el.style.height = Math.min(el.scrollHeight, 24 * 4 + 16) + 'px';
  };

  // Auto scroll to latest message
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!byok.isSet) {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.sender === 'assistant' && lastMsg?.text.includes('Set API Key')) return prev;
        return [...prev, {
          id: Date.now(),
          text: "To get started, you'll need to connect your API key — just hit the **Set API Key** button up top! 🔑",
          sender: 'assistant'
        }];
      });
      return;
    }

    setIsLoading(true);

    const newUserMessage: Message = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    };

    // placeholder AI message — toolCalls array will grow as tools are called
    const aiMessageId = Date.now() + 1;
    setMessages(prev => [
      ...prev,
      { id: aiMessageId, text: '', sender: 'assistant', toolCalls: [], isLoading: true }
    ]);

    // helper to update only the AI message being built
    const updateAiMessage = (updater: (msg: Message) => Message) => {
      setMessages(prev => prev.map(msg => msg.id === aiMessageId ? updater(msg) : msg));
    };

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          message: { role: 'user', content: input.trim() },
          provider: byok.provider,
          graph_context: {
            selected_nodes: currentFocus,
            filters: appliedFilters
          },
          session_id: sessionId.current,   // same id every message in this chat session
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Request failed' }));
        updateAiMessage(msg => ({
          ...msg,
          text: err.detail ?? 'Request failed',
          isLoading: false
        }));
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';  // accumulate across chunks in case an event is split

      while (true) {
        const { value, done } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // split on double newline — complete SSE events end with \n\n
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';  // last part may be incomplete, keep it

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          let event: { type: string; [key: string]: unknown };
          try { event = JSON.parse(part.slice(6)); }
          catch { continue; }

          switch (event.type) {

            case 'text_delta':
              updateAiMessage(msg => ({ ...msg, text: msg.text + (event.text as string) }));
              break;

            case 'tool_calling':
              // append a new tool call entry to the message
              updateAiMessage(msg => ({
                ...msg,
                toolCalls: [...(msg.toolCalls ?? []), { name: event.name as string, input: event.input }]
              }));
              break;

            case 'ui_event': {
              const payload = event.payload as { type: string; [key: string]: unknown };
              if (payload.type === 'highlight_nodes') {
                const metrics = payload.metrics
                let mode = payload.mode as FocusItem['mode']
                const clearPreviousSelections = Boolean(payload.clear_previous_selections) ?? false
                if (Array.isArray(metrics) && metrics.every(item => typeof item === 'string') && typeof mode === "string") {
                  if (!['default', 'with_descendants', 'with_ancestors', 'with_ancestors_and_descendants'].includes(mode)) {
                    mode = 'default'
                  }
                  const focusItems: FocusItem[] = metrics.map(metric => {return {type: 'node', id: metric, mode: mode}})
                  clearPreviousSelections && clearCurrentFocus()
                  focusItems.forEach((focusItem) => {pushFocus(focusItem, true, false)})
                }
              }
              break;
            }

            case 'tool_result':
              // ignore, we dont want to show data tables from tool calls to the user
              break;

            case 'done':
              updateAiMessage(msg => ({ ...msg, isLoading: false }));
              break;
            
            case 'error':
              updateAiMessage(msg => ({
                ...msg,
                text: event.message as string,
                isLoading: false
              }));
              break;
          }
        }
      }

    } catch (err) {
      console.error(err);
      updateAiMessage(msg => ({ ...msg, text: 'Something went wrong.', isLoading: false }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full border-l border-gray-200 bg-white shadow-sm overflow-hidden">
      
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <span className="font-semibold text-gray-700 text-sm">AI Analyst</span>
        <BYOKModal onSave={setKey} />
      </div>

      {/* message list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-3 min-w-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`min-w-0 max-w-[88%] px-3 py-2 rounded-xl text-sm wrap-break-word ${
              msg.sender === 'user'
                ? 'bg-indigo-500 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-2 space-y-1">
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} className="text-xs bg-yellow-50 border-l-2 border-yellow-400 px-2 py-1 rounded text-yellow-800 font-mono">
                      🔧 {tc.name}
                    </div>
                  ))}
                </div>
              )}
              {msg.text
                ? <ReactMarkdown>{msg.text}</ReactMarkdown>
                : msg.isLoading && (
                    <span className="flex gap-1 items-center text-gray-400">
                      <span className="animate-bounce [animation-delay:0ms]">·</span>
                      <span className="animate-bounce [animation-delay:150ms]">·</span>
                      <span className="animate-bounce [animation-delay:300ms]">·</span>
                    </span>
                  )
              }
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* input */}
      <div className="shrink-0 px-3 py-3 border-t border-gray-100 pb-safe">
        <div className="flex items-end gap-0 border border-gray-200 rounded-xl focus-within:ring-1 focus-within:ring-indigo-400 overflow-hidden">
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 min-w-0 text-sm px-3 py-2 resize-none overflow-y-auto focus:outline-none leading-6 bg-transparent"
            style={{ maxHeight: `${24 * 4 + 16}px` }}
            value={input}
            onChange={e => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your graph..."
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="shrink-0 w-8 h-8 mb-1 mr-1 flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white transition-colors"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-1.5 pl-1">Shift+Enter for new line</p>
      </div>
    </div>
  );
}
