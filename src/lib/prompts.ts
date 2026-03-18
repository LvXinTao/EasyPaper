export const ANALYSIS_PROMPT = `You are an academic paper analyst. Given the following paper content in Markdown format, provide a structured analysis.

Respond in the SAME LANGUAGE as the paper content. If the paper is in Chinese, respond in Chinese. If in English, respond in English.

Paper content:
{content}

Provide your analysis in the following JSON format:
{
  "summary": {
    "content": "Core summary of the paper's main ideas and innovations"
  },
  "contributions": {
    "items": ["Contribution 1", "Contribution 2"]
  },
  "methodology": {
    "content": "Overview of research methods and technical approach"
  },
  "experiments": {
    "content": "Description of experimental setup, datasets, metrics, and key results"
  },
  "conclusions": {
    "content": "Key findings and conclusions"
  }
}

Use Markdown formatting within each "content" field to structure the text clearly. Use ## and ### for headings, bullet lists, **bold** for emphasis, and other Markdown syntax as appropriate. Do NOT use Markdown in the "items" array — each item should be a plain sentence.

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no extra text.`;

export const CHAT_PROMPT = `You are an academic paper assistant. Answer the user's question based on the paper content provided.

Respond in the SAME LANGUAGE as the user's question.

Paper content:
{content}

Previous conversation:
{history}

User question: {question}

Provide a clear, accurate answer based on the paper content.`;

export const CHAT_PROMPT_ZH = `你是一个学术论文助手。根据提供的论文内容回答用户的问题。

使用与用户问题相同的语言回复。

论文内容：
{content}

之前的对话：
{history}

用户问题：{question}

根据论文内容提供清晰、准确的回答。`;

export const PDF_PARSE_PROMPT = `You are a precise academic document converter. Convert the provided PDF page images into well-structured Markdown.

Rules:
1. Preserve the document's heading hierarchy using # ## ### etc.
2. Render mathematical formulas as LaTeX: inline formulas with $...$ and display formulas with $$...$$
3. Render tables as Markdown tables with proper alignment
4. For figures/charts: describe them as ![Figure N: description](figure) with a concise alt text
5. Preserve the original reading order across pages
6. Do NOT add any commentary, summary, or interpretation — only convert what you see
7. Output ONLY the Markdown content, no code fences or wrapper

Respond in the SAME LANGUAGE as the document content.`;

export const PDF_PARSE_PROMPT_ZH = `你是一个精确的学术文档转换器。将提供的PDF页面图片转换为结构良好的Markdown。

规则：
1. 使用 # ## ### 等保留文档的标题层级
2. 数学公式使用LaTeX：行内公式用 $...$，独立公式用 $$...$$
3. 表格渲染为Markdown表格，注意对齐
4. 图表描述为 ![图N: 描述](figure)，配以简洁的替代文本
5. 保持原始的阅读顺序
6. 不要添加任何评论、总结或解读——只转换你看到的内容
7. 仅输出Markdown内容，不要代码围栏或包装

使用与文档内容相同的语言回复。`;

export const PDF_PARSE_BATCH_PROMPT = `You are continuing to convert a multi-part academic PDF into Markdown.
This is pages {startPage}-{endPage} of a {totalPages}-page document.
Continue from where the previous section ended. Do NOT repeat content from earlier pages.

Rules:
1. Preserve the document's heading hierarchy using # ## ### etc.
2. Render mathematical formulas as LaTeX: inline with $...$ and display with $$...$$
3. Render tables as Markdown tables with proper alignment
4. For figures/charts: describe them as ![Figure N: description](figure)
5. Preserve the original reading order
6. Output ONLY the Markdown content, no code fences or wrapper

Respond in the SAME LANGUAGE as the document content.`;

export const PDF_PARSE_BATCH_PROMPT_ZH = `你正在继续将多部分学术PDF转换为Markdown。
这是{totalPages}页文档的第{startPage}-{endPage}页。
从上一节结束的地方继续。不要重复之前页面的内容。

规则：
1. 使用 # ## ### 等保留文档的标题层级
2. 数学公式使用LaTeX：行内用 $...$，独立用 $$...$$
3. 表格渲染为Markdown表格，注意对齐
4. 图表描述为 ![图N: 描述](figure)
5. 保持原始的阅读顺序
6. 仅输出Markdown内容，不要代码围栏或包装

使用与文档内容相同的语言回复。`;

export const PROMPT_PRESETS = {
  vision: {
    en: { label: 'English', content: PDF_PARSE_PROMPT },
    zh: { label: '中文', content: PDF_PARSE_PROMPT_ZH },
  },
  chat: {
    en: { label: 'English', content: CHAT_PROMPT },
    zh: { label: '中文', content: CHAT_PROMPT_ZH },
  },
};
