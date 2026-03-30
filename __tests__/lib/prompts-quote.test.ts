import { buildQuoteContext } from '@/lib/prompts';
import type { TextSelection } from '@/types';

describe('buildQuoteContext', () => {
  it('builds context string with quote text and page', () => {
    const quote: TextSelection = {
      text: '假设空间的严格约束',
      rects: [{ left: 10, top: 20, width: 30, height: 5 }],
      page: 3,
    };
    const result = buildQuoteContext(quote);
    expect(result).toContain('假设空间的严格约束');
    expect(result).toContain('第 3 页');
    expect(result).toContain('用户引用了论文中的以下内容');
  });

  it('returns empty string for undefined quote', () => {
    const result = buildQuoteContext(null as unknown as undefined);
    expect(result).toBe('');
  });
});
