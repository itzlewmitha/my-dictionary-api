// lib/scraper.js
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.maduraonline.com';

/**
 * Scrape translations for a given word from Madura Online.
 * @param {string} word - the word to look up (English or Sinhala)
 * @returns {Promise<Array<{english: string, sinhala: string, type?: string}>>}
 */
export async function scrapeTranslations(word) {
  const url = `${BASE_URL}/?find=${encodeURIComponent(word)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Try to locate the translation table.
  // The site often uses a table with class "table" or a container like "#result".
  // We'll look for a table that contains the word we searched for.
  let results = [];

  // Common pattern: the table may have rows, each with two cells.
  // We'll try to find tables that contain the search term.
  $('table').each((_, table) => {
    const rows = $(table).find('tr');
    rows.each((_, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 2) {
        const english = $(cols[0]).text().trim();
        const sinhala = $(cols[1]).text().trim();
        // Only add if both are non‑empty and at least one contains the search term (optional)
        if (english || sinhala) {
          // Try to detect part‑of‑speech from a third column if present
          let type = '';
          if (cols.length >= 3) {
            type = $(cols[2]).text().trim();
          }
          results.push({ english, sinhala, type });
        }
      }
    });
  });

  // If no results from table, fallback: look for any visible text that contains Sinhala script.
  // (Unicode range for Sinhala: U+0D80–U+0DFF)
  if (results.length === 0) {
    // Find all text nodes that contain Sinhala characters and try to pair with nearby English.
    // This is a fallback; the table approach should work.
    const sinhalaRegex = /[\u0D80-\u0DFF]/;
    const bodyText = $('body').text();
    // Simple extraction: find lines that have both English and Sinhala
    const lines = bodyText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    for (const line of lines) {
      if (sinhalaRegex.test(line)) {
        // try to split by tabs or multiple spaces
        const parts = line.split(/\t|\s{2,}/);
        if (parts.length >= 2) {
          const eng = parts.find(p => !sinhalaRegex.test(p));
          const sin = parts.find(p => sinhalaRegex.test(p));
          if (eng && sin) {
            results.push({ english: eng.trim(), sinhala: sin.trim(), type: '' });
          }
        }
      }
    }
  }

  // If still empty, throw an error (or return empty array)
  if (results.length === 0) {
    throw new Error(`No translations found for "${word}"`);
  }

  return results;
}
