import { useState, useCallback } from 'react';

interface BYOKState {
  apiKey: string;
  provider: 'anthropic' | 'openai';
  isSet: boolean;
}

export function useBYOK() {
  const [byok, setBYOK] = useState<BYOKState>({
    apiKey: '',
    provider: 'anthropic',
    isSet: false,
  });

  const setKey = useCallback((apiKey: string, provider: 'anthropic' | 'openai') => {
    setBYOK({ apiKey, provider, isSet: true });
  }, []);

  const clearKey = useCallback(() => {
    setBYOK({ apiKey: '', provider: 'anthropic', isSet: false });
  }, []);

  // returns headers to attach to every request — key never goes in the body
  const authHeaders = useCallback((): Record<string, string> => ({
    'X-API-Key': byok.apiKey,
  }), [byok.apiKey]);

  return { byok, setKey, clearKey, authHeaders };
}