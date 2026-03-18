import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { PROMPT_PRESETS } from '@/lib/prompts';
import type { PromptSettings, PromptPresetKey } from '@/types';

export async function GET() {
  try {
    const current = await storage.getPromptSettings();
    return NextResponse.json({
      current,
      presets: PROMPT_PRESETS,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load prompt settings' }, { status: 500 });
  }
}

const MAX_PROMPT_LENGTH = 10000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const existing = await storage.getPromptSettings();

    const merged: PromptSettings = existing || {
      vision: { preset: 'en', custom: PROMPT_PRESETS.vision.en.content },
      analysis: { preset: 'en', custom: PROMPT_PRESETS.analysis.en.content },
      chat: { preset: 'en', custom: PROMPT_PRESETS.chat.en.content },
    };

    if (body.vision) {
      if (body.vision.custom && body.vision.custom.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({ error: 'Vision prompt exceeds maximum length' }, { status: 400 });
      }
      merged.vision = {
        preset: (body.vision.preset as PromptPresetKey) || merged.vision.preset,
        custom: body.vision.custom ?? merged.vision.custom,
      };
    }

    if (body.analysis) {
      if (body.analysis.custom && body.analysis.custom.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({ error: 'Analysis prompt exceeds maximum length' }, { status: 400 });
      }
      merged.analysis = {
        preset: (body.analysis.preset as PromptPresetKey) || merged.analysis.preset,
        custom: body.analysis.custom ?? merged.analysis.custom,
      };
    }

    if (body.chat) {
      if (body.chat.custom && body.chat.custom.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({ error: 'Chat prompt exceeds maximum length' }, { status: 400 });
      }
      merged.chat = {
        preset: (body.chat.preset as PromptPresetKey) || merged.chat.preset,
        custom: body.chat.custom ?? merged.chat.custom,
      };
    }

    await storage.savePromptSettings(merged);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save prompt settings' }, { status: 500 });
  }
}
