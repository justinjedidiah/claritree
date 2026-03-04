import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api/client';
import ReactMarkdown from 'react-markdown';
import { useBYOK } from '../hooks/useBYOK';
import BYOKModal from './BYOKModal';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  toolCalls?: { name: string; input: unknown }[];
  isLoading?: boolean;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I help you analyze you graph?", sender: 'assistant' }
  ]);
  const [input, setInput] = useState('');
  const { byok, setKey, authHeaders } = useBYOK();
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(crypto.randomUUID());

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !byok.isSet) return;
    setIsLoading(true);

    const newUserMessage: Message = { id: Date.now(), text: input, sender: 'user' };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

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
          messages: updatedMessages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          })),
          provider: byok.provider,
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
              // TODO: dispatch to your ReactFlow / card state here
              // e.g. if (payload.type === 'highlight_node') highlightNode(payload.node_id)
              console.log('UI event received:', payload);
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
    <div className="flex flex-col h-full w-80 border-l border-gray-200 bg-white shadow-sm">
      <div className="p-4 border-b border-gray-100 font-semibold text-gray-700">
        <span className="font-semibold text-gray-700">AI Analyst</span>
        <BYOKModal onSave={setKey} />
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
              msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              {/* tool calls — shown above the text answer */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mb-2 space-y-1">
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} className="text-xs bg-yellow-50 border-l-2 border-yellow-400 px-2 py-1 rounded text-yellow-800">
                      🔧 {tc.name}
                    </div>
                  ))}
                </div>
              )}
              {/* main answer text */}
              {msg.text
                ? <ReactMarkdown>{msg.text}</ReactMarkdown>
                : msg.isLoading && <span className="animate-pulse text-gray-400">Thinking...</span>
              }
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* input */}
      <div className="p-3 border-t border-gray-100 flex gap-2">
        <input
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your graph..."
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="px-3 py-2 bg-indigo-500 text-white text-sm rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
