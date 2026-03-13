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

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no extra text.`;

export const CHAT_PROMPT = `You are an academic paper assistant. Answer the user's question based on the paper content provided.

Respond in the SAME LANGUAGE as the user's question.

Paper content:
{content}

Previous conversation:
{history}

User question: {question}

Provide a clear, accurate answer based on the paper content.`;
