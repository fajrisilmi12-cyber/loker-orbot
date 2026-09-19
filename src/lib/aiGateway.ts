import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig, AiEndpointConfig } from './config';

export interface AiCompletionOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  jsonMode?: boolean;
}

/**
 * Universal AI Completion Function with Multi-Provider Chaining & Automatic Fallback:
 * 1. Checks active endpoint from `aiEndpoints` list
 * 2. Tries remaining configured endpoints in sequence
 * 3. Falls back to .env GEMINI_API_KEY
 */
export async function askUniversalAi(options: AiCompletionOptions): Promise<string> {
  const config = getConfig();
  const errors: string[] = [];

  // Helper: Call Google Gemini API
  const tryGemini = async (apiKey: string, modelName = 'gemini-2.5-flash'): Promise<string> => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName || 'gemini-2.5-flash',
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        responseMimeType: options.jsonMode ? 'application/json' : undefined,
      },
    });

    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${options.userPrompt}`
      : options.userPrompt;

    const result = await model.generateContent(fullPrompt);
    return (result.response.text() || '').trim();
  };

  // Helper: Call OpenAI-compatible endpoint (9Router, OpenRouter, Custom host, Ollama, vLLM)
  const tryOpenAiCompatible = async (baseUrl: string, apiKey: string, modelName: string): Promise<string> => {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.userPrompt });

    const payload: any = {
      model: modelName || 'google/gemini-2.5-flash',
      messages,
      temperature: options.temperature ?? 0.2,
    };

    if (options.jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000), // 20s timeout
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
  };

  // Build execution queue from aiEndpoints list
  const endpoints: AiEndpointConfig[] = Array.isArray(config.aiEndpoints) && config.aiEndpoints.length > 0
    ? config.aiEndpoints
    : [
        {
          id: 'ep-gemini',
          name: 'Google Gemini',
          type: 'gemini',
          baseUrl: '',
          apiKey: config.geminiApiKey || '',
          model: 'gemini-2.5-flash',
          isActive: config.aiProvider !== 'custom_router',
        },
        {
          id: 'ep-custom',
          name: 'Custom Router',
          type: 'openai_compatible',
          baseUrl: config.customAiBaseUrl || 'https://api.9router.com/v1',
          apiKey: config.customAiApiKey || '',
          model: config.customAiModel || 'google/gemini-2.5-flash',
          isActive: config.aiProvider === 'custom_router',
        },
      ];

  // Prioritize active endpoint first, followed by other configured endpoints
  const activeId = config.activeAiEndpointId;
  const sorted = [...endpoints].sort((a, b) => {
    if (a.id === activeId || a.isActive) return -1;
    if (b.id === activeId || b.isActive) return 1;
    return 0;
  });

  for (const ep of sorted) {
    if (!ep.apiKey?.trim()) continue;

    try {
      if (ep.type === 'gemini') {
        return await tryGemini(ep.apiKey.trim(), ep.model);
      } else {
        return await tryOpenAiCompatible(ep.baseUrl || 'https://api.9router.com/v1', ep.apiKey.trim(), ep.model);
      }
    } catch (err: any) {
      const msg = `Provider [${ep.name} (${ep.model})]: ${err?.message || err}`;
      console.warn(`AI Gateway failover -> ${msg}`);
      errors.push(msg);
    }
  }

  // Fallback to legacy fields if not covered
  if (config.geminiApiKey?.trim()) {
    try {
      return await tryGemini(config.geminiApiKey.trim());
    } catch (e: any) {
      errors.push(`Legacy Gemini Config: ${e?.message || e}`);
    }
  }

  if (config.customAiApiKey?.trim() && config.customAiBaseUrl?.trim()) {
    try {
      return await tryOpenAiCompatible(config.customAiBaseUrl, config.customAiApiKey, config.customAiModel || 'google/gemini-2.5-flash');
    } catch (e: any) {
      errors.push(`Legacy Custom AI: ${e?.message || e}`);
    }
  }

  // Final Fallback: .env file
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey && envKey !== 'your_gemini_api_key_here') {
    try {
      return await tryGemini(envKey);
    } catch (e: any) {
      errors.push(`Gemini .env: ${e?.message || e}`);
    }
  }

  throw new Error(`Seluruh provider AI gagal merespon:\n${errors.join('\n')}`);
}

/**
 * Test a specific endpoint or active endpoint
 */
export async function testAiConnection(specificEndpoint?: Partial<AiEndpointConfig>): Promise<{ success: boolean; message: string; reply?: string }> {
  try {
    if (specificEndpoint && specificEndpoint.apiKey) {
      if (specificEndpoint.type === 'gemini') {
        const genAI = new GoogleGenerativeAI(specificEndpoint.apiKey.trim());
        const model = genAI.getGenerativeModel({ model: specificEndpoint.model || 'gemini-2.5-flash' });
        const res = await model.generateContent('Katakan "Koneksi Gemini Sukses!" dalam 1 kalimat pendek.');
        return { success: true, message: 'Koneksi Gemini Sukses!', reply: (res.response.text() || '').trim() };
      } else {
        const cleanUrl = (specificEndpoint.baseUrl || 'https://api.9router.com/v1').replace(/\/+$/, '');
        const endpoint = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${specificEndpoint.apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: specificEndpoint.model || 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: 'Katakan "Koneksi Router Sukses!" dalam 1 kalimat pendek.' }],
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 180)}`);
        }
        const data = await res.json();
        const reply = (data.choices?.[0]?.message?.content || '').trim();
        return { success: true, message: 'Koneksi Router Sukses!', reply };
      }
    }

    const reply = await askUniversalAi({
      userPrompt: 'Katakan "Koneksi AI Berhasil!" dalam 1 kalimat pendek.',
      temperature: 0.1,
    });
    return {
      success: true,
      message: 'Koneksi AI Aktif & Berfungsi!',
      reply,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Gagal terhubung ke AI',
    };
  }
}
