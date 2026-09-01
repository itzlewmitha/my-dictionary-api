// api/translate.js
import { kv } from '@vercel/kv';
import { scrapeTranslations } from '../lib/scraper.js';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { word } = req.query;
  if (!word) {
    return res.status(400).json({ error: 'Missing "word" query parameter' });
  }

  try {
    // 1. Try to get from cache
    const cacheKey = `translation:${word.toLowerCase()}`;
    const cached = await kv.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        source: 'cache',
        word,
        translations: cached,
      });
    }

    // 2. Not in cache → scrape
    const translations = await scrapeTranslations(word);

    // 3. Store in KV (expire after 7 days, for example)
    await kv.set(cacheKey, translations, { ex: 60 * 60 * 24 * 7 });

    return res.status(200).json({
      source: 'scrape',
      word,
      translations,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch translation',
      details: error.message,
    });
  }
}
