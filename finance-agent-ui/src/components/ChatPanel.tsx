import React, { useState, useEffect, useRef } from 'react';

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! How can I help you with your workflow?", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Mock AI Response (Replace with your actual API call)
    setTimeout(() => {
      const aiResponse = { 
        id: Date.now() + 1, 
        text: `I'm analyzing your nodes... (Received: "${userMessage.text}")`, 
        sender: 'ai' 
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full w-80 border-l border-gray-200 bg-white shadow-sm">
      <div className="p-4 border-b border-gray-100 font-semibold text-gray-700">AI Analyst</div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
              msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question..." 
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button onClick={handleSend} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
