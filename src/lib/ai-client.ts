type TextContentPart = { type: 'text'; text: string };
type ImageContentPart = { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } };
type ContentPart = TextContentPart | ImageContentPart;

interface AIClientConfig { baseUrl: string; apiKey: string; model: string; }
interface Message { role: 'system' | 'user' | 'assistant'; content: string; }
interface VisionMessage { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[]; }

function parseAPIError(status: number, errorText: string, url: string, model: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(errorText);
    detail = parsed.error?.message || parsed.message || errorText;
  } catch {
    detail = errorText;
  }

  const hints: string[] = [];
  if (status === 401) hints.push('Check your API key in Settings');
  if (status === 404) hints.push(`Model "${model}" may not exist on this provider`);
  if (status === 429) hints.push('Rate limit exceeded - wait and try again');
  if (status === 500) hints.push(`Server error from ${new URL(url).hostname} - the model "${model}" may be unavailable or the input may be too long`);
  if (status === 413 || detail.toLowerCase().includes('too long') || detail.toLowerCase().includes('context')) {
    hints.push('The paper content may exceed the model context window');
  }

  const hintStr = hints.length > 0 ? ` [Hint: ${hints.join('; ')}]` : '';
  return `API error ${status}: ${detail}${hintStr}`;
}

export function createAIClient(config: AIClientConfig) {
  const { baseUrl, apiKey, model } = config;

  async function complete(messages: Message[]): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseAPIError(response.status, errorText, `${baseUrl}/chat/completions`, model));
    }
    const data = await response.json();
    return data.choices[0].message.content;
  }

  async function* streamComplete(messages: Message[]): AsyncGenerator<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseAPIError(response.status, errorText, `${baseUrl}/chat/completions`, model));
    }
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* Skip malformed lines */ }
      }
    }
  }

  async function completeVision(
    messages: VisionMessage[],
    maxTokens: number = 16384,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: false }),
      signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseAPIError(response.status, errorText, `${baseUrl}/chat/completions`, model));
    }
    const data = await response.json();
    return data.choices[0].message.content;
  }

  return { complete, streamComplete, completeVision };
}

export type { ContentPart, TextContentPart, ImageContentPart, VisionMessage };
