import { PDF_PARSE_PROMPT, PDF_PARSE_BATCH_PROMPT, PDF_PARSE_PROMPT_ZH, PDF_PARSE_BATCH_PROMPT_ZH } from '@/lib/prompts';

describe('Vision prompts', () => {
  it('PDF_PARSE_PROMPT includes page marker instruction', () => {
    expect(PDF_PARSE_PROMPT).toContain('<!-- page');
  });

  it('PDF_PARSE_BATCH_PROMPT includes page marker instruction', () => {
    expect(PDF_PARSE_BATCH_PROMPT).toContain('<!-- page');
  });

  it('PDF_PARSE_PROMPT_ZH includes page marker instruction', () => {
    expect(PDF_PARSE_PROMPT_ZH).toContain('<!-- page');
  });

  it('PDF_PARSE_BATCH_PROMPT_ZH includes page marker instruction', () => {
    expect(PDF_PARSE_BATCH_PROMPT_ZH).toContain('<!-- page');
  });
});