const PROMPT = `You are a fashion assistant. Analyze this clothing item image and return ONLY a valid JSON object with these fields:
- color: string (dominant color name, e.g. "navy", "cream", "forest green")
- category: one of ["top","bottom","outerwear","shoes","accessory"]
- warmth: integer 1-5 (1=very light/summer, 5=very warm/winter)
- style_tags: array of 1-4 style descriptors (e.g. ["casual","minimalist","streetwear"])
Return nothing but the JSON object.`;

export async function autoTagItem(item) {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: item.imageUrl, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
