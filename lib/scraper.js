import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.maduraonline.com';

export async function scrapeTranslations(word) {
  const url = `${BASE_URL}/?find=${encodeURIComponent(word)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  // Try to find translation table
  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    rows.each((_, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 2) {
        const english = $(cols[0]).text().trim();
        const sinhala = $(cols[1]).text().trim();
        if (english || sinhala) {
          let type = '';
          if (cols.length >= 3) type = $(cols[2]).text().trim();
          results.push({ english, sinhala, type });
        }
      }
    });
  });

  // Fallback: line‑based extraction
  if (results.length === 0) {
    const sinhalaRegex = /[\u0D80-\u0DFF]/;
    const lines = $('body').text().split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (sinhalaRegex.test(line)) {
        const parts = line.split(/\t|\s{2,}/);
        const eng = parts.find(p => !sinhalaRegex.test(p));
        const sin = parts.find(p => sinhalaRegex.test(p));
        if (eng && sin) {
          results.push({ english: eng.trim(), sinhala: sin.trim(), type: '' });
        }
      }
    }
  }

  if (results.length === 0) {
    throw new Error(`No translations found for "${word}"`);
  }
  return results;
}
