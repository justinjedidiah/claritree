import { useState } from 'react';

interface Props {
  onSave: (apiKey: string, provider: 'anthropic' | 'openai') => void;
}

export default function BYOKModal({ onSave }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [show, setShow] = useState(false);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave(apiKey.trim(), provider);
    setApiKey(''); // clear input immediately after saving to state
    setShow(false);
  };

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
      >
        Set API Key
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
            <h2 className="font-semibold text-gray-800">Connect your API key</h2>

            <p className="text-xs text-gray-500">
              Your key is stored in memory only — never saved to disk or sent to our servers except to forward to the provider.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">Provider</label>
              <div className="flex gap-2">
                {(['anthropic', 'openai'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      provider === p
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {p === 'anthropic' ? 'Anthropic' : 'OpenAI'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">API Key</label>
              <input
                type="password"          // masks the key visually
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setApiKey(''); setShow(false); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="flex-1 py-2 rounded-lg bg-indigo-500 text-white text-sm disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}