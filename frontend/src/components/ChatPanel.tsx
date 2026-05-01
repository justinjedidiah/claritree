import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFocusStore } from '../stores/useFocusStore';
import type { FocusItem } from '../stores/useFocusStore';
import { useBYOK } from '../hooks/useBYOK';
import BYOKModal from './BYOKModal';
import { ChevronDownIcon , PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { DashboardProps } from '../pages/Dashboard';
import { flattenToolResult, ToolResultTable, ToolResultNested } from './toolResults';

interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  result?: unknown;
}

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  toolCalls?: ToolCall[];
  isLoading?: boolean;
}

const getToolLabel = (name: string, input: unknown): string => {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case 'get_metrics_by_report':
      return `Fetching metrics in "${i.report_name}"`;
    case 'get_reports_by_metric':
      return `Finding reports containing ${i.metric}`;
    case 'get_metric_values':
      const { metric, start, end } = i;
      let period_text = ''
      if (start) {
        period_text = start === end ? ` in ${start}` : ` from ${start} to ${end}`
      }
      return `Fetching values for ${metric}${period_text}`;
    case 'get_metric_components':
      return `Breaking down components of ${i.metric}`;
    case 'get_metric_dependents':
      return `Finding what ${i.metric} feeds into`;
    case 'get_all_reports':
      return 'Loading available reports';
    case 'highlight_nodes': {
      const metrics = i.metrics as string[];
      return `Highlighting ${metrics?.join(', ')}`;
    }
    default:
      return name;
  }
};

const MODELS = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  desc: 'Fast & affordable' },
    { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', desc: 'Recommended'       },
    { id: 'claude-opus-4-6',           label: 'Opus 4.6',   desc: 'Best performance'  },
  ],
  openai: [
    { id: 'gpt-5-mini',  label: 'GPT-5 Mini', desc: 'Fast & affordable' },
    { id: 'gpt-5.4',     label: 'GPT-5.4',    desc: 'Best performance'  },
  ],
};

export default function ChatPanel({appliedFilters}: {appliedFilters: DashboardProps}) {
  // Chat related
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I help you analyze you graph?", sender: 'assistant' }
  ]);
  const [input, setInput] = useState('');
  const { byok, setKey, authHeaders } = useBYOK();
  const [isLoading, setIsLoading] = useState(false);
  const [openToolCalls, setOpenToolCalls] = useState<Set<string>>(new Set());
  const toggleToolCall = (id: string) =>
    setOpenToolCalls(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const sessionId = useRef<string>(crypto.randomUUID());

  // Model selection
  const [selectedModel, setSelectedModel] = useState<string>('claude-haiku-4-5-20251001');
  useEffect(() => {
    if (byok.isSet) {
      const models = MODELS[byok.provider];
      setSelectedModel(models[0].id);
    }
  }, [byok.provider, byok.isSet]);

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
          model: selectedModel,
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
              updateAiMessage(msg => ({
                ...msg,
                toolCalls: [...(msg.toolCalls ?? []), { id: event.run_id as string, name: event.name as string, input: event.input }]
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
              const runId = event.run_id as string;
              updateAiMessage(msg => ({
                ...msg,
                toolCalls: msg.toolCalls?.map(tc =>
                  tc.id === runId ? { ...tc, result: event.result } : tc
                ) ?? []
              }));
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

  const handleClearChat = () => {
    setMessages([{ id: 1, text: "Hello! How can I help you analyze your graph?", sender: 'assistant' }]);
    sessionId.current = crypto.randomUUID(); // new session = fresh memory
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
                <div className="mb-3 flex flex-col">
                  {msg.toolCalls.map((tc, i) => {
                    const isOpen = openToolCalls.has(tc.id);
                    const flattened = tc.result ? flattenToolResult(tc.name, tc.result) : null;
                    return (
                      <div key={tc.id} className="flex gap-2 mb-2 relative">
                        {/* spine */}
                        <div className="flex flex-col items-center shrink-0" style={{ width: 16 }}>
                          <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1 shrink-0 relative z-10" />
                          {i < msg.toolCalls!.length - 1 && (
                            <div className="bg-indigo-200 absolute" style={{ width: 1.5, top: 6, bottom: -13, left: 7 }} />
                          )}
                        </div>
                        {/* label + result */}
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => toggleToolCall(tc.id)}
                            className="flex items-center gap-1 w-full text-left"
                          >
                            <p className="text-[11px] text-gray-500 leading-snug flex-1">
                              {getToolLabel(tc.name, tc.input)}
                            </p>
                            {flattened && (
                              <ChevronDownIcon className={`w-3 h-3 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            )}
                          </button>
                          {isOpen && flattened && (
                            flattened.type === 'table'
                              ? <ToolResultTable rows={flattened.rows!} topMessage={flattened.topMessage} />
                              : <ToolResultNested sections={flattened.sections!} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.text
                ? <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-2">
                          <table className="text-xs border-collapse w-full" {...props} />
                        </div>
                      ),
                      th: ({ node, ...props }) => (
                        <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-left font-semibold" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="border border-gray-300 px-2 py-1" {...props} />
                      ),
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
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
      
      {/* toolbar — clear + model selector */}
      <div className="shrink-0 px-3 pt-2 flex items-center justify-between gap-2">
        <button
          onClick={handleClearChat}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
        >
          <TrashIcon className="w-3 h-3" />
          Clear
        </button>

        <select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {(byok.isSet ? MODELS[byok.provider] : [...MODELS.anthropic, ...MODELS.openai]).map(m => (
            <option key={m.id} value={m.id}>{m.label} — {m.desc}</option>
          ))}
        </select>
      </div>

      {/* input */}
      <div className="shrink-0 px-3 py-3 border-t border-gray-100 pb-safe">
        <div className="flex items-end gap-0 border border-gray-200 rounded-xl focus-within:ring-1 focus-within:ring-indigo-400 overflow-hidden">
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 min-w-0 text-base px-3 py-2 resize-none overflow-y-auto focus:outline-none leading-6 bg-transparent"
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
      </div>
    </div>
  );
}
