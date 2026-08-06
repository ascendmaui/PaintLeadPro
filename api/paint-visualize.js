export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { image, colorName, colorHex, scope } = req.body || {};

  if (!image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.includes('your_') || apiKey === '') {
    console.log('GEMINI_API_KEY missing — returning mock');
    await new Promise((r) => setTimeout(r, 900));
    return res.status(200).json({
      success: true,
      mode: 'MOCK',
      message: 'Add GEMINI_API_KEY in Vercel project settings for real AI recoloring',
      image: null,
    });
  }

  try {
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (typeof image === 'string' && image.startsWith('data:')) {
      const parts = image.split(',');
      base64Data = parts[1] || '';
      const header = parts[0] || '';
      const match = header.match(/data:([^;]+)/);
      if (match) mimeType = match[1];
    } else if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
      const imgRes = await fetch(image);
      if (!imgRes.ok) throw new Error('Failed to fetch source image');
      const arrayBuffer = await imgRes.arrayBuffer();
      base64Data = Buffer.from(arrayBuffer).toString('base64');
      mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    } else if (typeof image === 'string') {
      base64Data = image;
    } else {
      return res.status(400).json({ error: 'Unsupported image format' });
    }

    if (base64Data.length > 5500000) {
      return res.status(413).json({ error: 'Image too large — please use a photo under ~3 MB' });
    }

    const surface =
      scope === 'interior'
        ? 'interior walls and painted surfaces'
        : scope === 'cabinet'
          ? 'kitchen cabinet fronts and frames'
          : scope === 'deck'
            ? 'deck boards and railings'
            : 'exterior siding, walls, and painted trim';

    const promptText = `Using the provided photograph of a residential property, change ONLY the ${surface} to the exact color of Sherwin-Williams ${colorName || 'paint'} (approximately ${colorHex || 'the requested color'}).

Strict requirements:
- Keep the architecture, windows, doors, roof, landscaping, sky, perspective, and camera angle identical.
- Preserve original lighting, shadows, reflections, and material texture.
- Only the painted surfaces should change color.
- Photorealistic result. No text or extra objects.`;

    const model = 'gemini-3.1-flash-image';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: [
            { type: 'text', text: promptText },
            { type: 'image', data: base64Data, mime_type: mimeType },
          ],
          response_modalities: ['image'],
        }),
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Interactions error:', response.status, errText.slice(0, 500));
      return res.status(502).json({ error: 'Gemini image generation failed', details: errText.slice(0, 300), mode: 'ERROR' });
    }

    const data = await response.json();

    let outB64 = null;
    let outMime = 'image/png';

    if (data.output_image && data.output_image.data) {
      outB64 = data.output_image.data;
      outMime = data.output_image.mime_type || outMime;
    } else if (Array.isArray(data.outputs)) {
      const imgPart = data.outputs.find((o) => o.type === 'image' || o.mime_type?.startsWith('image/'));
      if (imgPart) {
        outB64 = imgPart.data;
        outMime = imgPart.mime_type || outMime;
      }
    } else if (data.candidates?.[0]?.content?.parts) {
      const part = data.candidates[0].content.parts.find((p) => p.inlineData || p.inline_data);
      if (part) {
        const inline = part.inlineData || part.inline_data;
        outB64 = inline.data;
        outMime = inline.mimeType || inline.mime_type || outMime;
      }
    }

    if (!outB64) {
      return res.status(502).json({ error: 'Gemini returned no image', mode: 'ERROR' });
    }

    return res.status(200).json({
      success: true,
      mode: 'PROD',
      model,
      image: `data:${outMime};base64,${outB64}`,
    });
  } catch (error) {
    console.error('paint-visualize failed:', error);
    return res.status(500).json({
      error: 'AI visualization failed',
      details: error.message || String(error),
      mode: 'ERROR',
    });
  }
}
