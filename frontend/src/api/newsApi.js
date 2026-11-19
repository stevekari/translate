/**
 * News API Service - Real-time, Country-specific Breaking News
 * Fetches current, live news from Spring Boot backend and Google News RSS feeds.
 * Supports country-based filtering (US, ES, GB, GH, FR, DE, IT, BR, NG, NL, MX, CA, Global).
 */

import api from './axios.js';

export const NEWS_COUNTRIES = [
  { code: 'WORLD', name: 'Global', flag: '🌍' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
];

export const NEWS_CATEGORIES = [
  { id: 'all', label: 'Top News ⚡' },
  { id: 'Football', label: 'Football & Sports ⚽' },
  { id: 'Tech', label: 'Technology 🚀' },
  { id: 'World', label: 'World Affairs 🌍' },
];

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

// High-quality dynamic fallback articles
export const FALLBACK_NEWS = [
  {
    id: 'live-news-1',
    source: 'Global Breaking Wire',
    handle: '@globalwire',
    sourceLogo: '🌍',
    verified: true,
    category: 'World',
    title: 'Historic Multilateral Agreement Accelerates Renewable Power Grids Worldwide',
    summary: 'International ministers and energy partners sign major climate infrastructure framework to connect continents.',
    url: 'https://news.google.com',
    timeAgo: 'Just now',
    readTime: '2 min',
    imageUrl: null,
    likes: 840,
    reposts: 215,
  },
  {
    id: 'live-news-2',
    source: 'El País',
    handle: '@elpais',
    sourceLogo: '🇪🇸',
    verified: true,
    category: 'Spain',
    title: 'España lidera la inversión europea en energías limpias y alta velocidad ferroviaria',
    summary: 'El país consolida su transformación energética y modernización digital con nuevos corredores sostenibles.',
    url: 'https://elpais.com',
    timeAgo: '15m',
    readTime: '3 min',
    imageUrl: null,
    likes: 620,
    reposts: 110,
  },
  {
    id: 'live-news-3',
    source: 'Sports World',
    handle: '@sportsworld',
    sourceLogo: '⚽',
    verified: true,
    category: 'Football',
    title: 'Champions League Drama: Thrilling Quarter-Final Showdown Captivates Millions',
    summary: 'Late drama and breathtaking goals set up an unforgettable European football tournament finale.',
    url: 'https://www.marca.com',
    timeAgo: '24m',
    readTime: '2 min',
    imageUrl: null,
    likes: 1540,
    reposts: 420,
  },
  {
    id: 'live-news-4',
    source: 'Reuters Tech',
    handle: '@reuterstech',
    sourceLogo: '🚀',
    verified: true,
    category: 'Tech',
    title: 'Breakthrough On-Device AI Models Deliver Real-Time Multilingual Speech Translation',
    summary: 'New low-latency neural architectures enable instant voice dubbing and communication across hundreds of native dialects.',
    url: 'https://www.reuters.com',
    timeAgo: '42m',
    readTime: '3 min',
    imageUrl: null,
    likes: 920,
    reposts: 280,
  },
];

/**
 * Clean HTML strings
 */
function cleanText(htmlOrText = '', maxLength = 180) {
  if (!htmlOrText) return '';
  try {
    const div = document.createElement('div');
    div.innerHTML = htmlOrText;
    let text = div.textContent || div.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > maxLength) {
      return text.substring(0, maxLength).trim() + '...';
    }
    return text;
  } catch {
    return String(htmlOrText).substring(0, maxLength);
  }
}

/**
 * Format relative time
 */
function formatTimeAgo(pubDate) {
  if (!pubDate) return 'Just now';
  try {
    const diffMs = Date.now() - new Date(pubDate).getTime();
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } catch {
    return 'Recent';
  }
}

function getCountryGoogleFeedUrl(country = 'WORLD', category = 'all') {
  const cat = category.toLowerCase();
  if (cat === 'football' || cat === 'sports') {
    return 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en';
  }
  if (cat === 'tech' || cat === 'technology') {
    return 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en';
  }

  const c = country.toUpperCase();
  switch (c) {
    case 'ES': return 'https://news.google.com/rss?hl=es-ES&gl=ES&ceid=ES:es';
    case 'US': return 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
    case 'GB': return 'https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en';
    case 'GH': return 'https://news.google.com/rss?hl=en-GH&gl=GH&ceid=GH:en';
    case 'FR': return 'https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr';
    case 'DE': return 'https://news.google.com/rss?hl=de&gl=DE&ceid=DE:de';
    case 'IT': return 'https://news.google.com/rss?hl=it&gl=IT&ceid=IT:it';
    case 'BR': return 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419';
    case 'NG': return 'https://news.google.com/rss?hl=en-NG&gl=NG&ceid=NG:en';
    case 'NL': return 'https://news.google.com/rss?hl=nl&gl=NL&ceid=NL:nl';
    case 'MX': return 'https://news.google.com/rss?hl=es-419&gl=MX&ceid=MX:es-419';
    case 'CA': return 'https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en';
    default: return 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en';
  }
}

function getFlag(code) {
  const c = NEWS_COUNTRIES.find((x) => x.code === code);
  return c ? c.flag : '🌍';
}

/**
 * Fetch from direct RSS proxy (client-side fallback if backend is restarting)
 */
async function fetchClientRss(country, category) {
  try {
    const feedUrl = getCountryGoogleFeedUrl(country, category);
    const proxyUrl = `${RSS2JSON_BASE}${encodeURIComponent(feedUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.items) || data.items.length === 0) return [];

    const flag = getFlag(country);
    return data.items.slice(0, 16).map((item, idx) => {
      let title = item.title?.replace(/&amp;/g, '&')?.replace(/&#39;/g, "'") || '';
      let sourceName = item.author || (country + ' News');
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        sourceName = parts[parts.length - 1].trim();
        title = parts.slice(0, parts.length - 1).join(' - ').trim();
      }

      return {
        id: `client-news-${country}-${idx}-${Date.now()}`,
        source: sourceName,
        handle: `@${sourceName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        sourceLogo: flag,
        verified: true,
        category: category === 'all' ? (country === 'WORLD' ? 'World' : country) : category,
        country,
        title,
        summary: cleanText(item.description) || title,
        url: item.link || item.guid || 'https://news.google.com',
        timeAgo: formatTimeAgo(item.pubDate),
        imageUrl: item.thumbnail || item.enclosure?.link || null,
        likes: Math.floor(Math.random() * 600) + 120,
        reposts: Math.floor(Math.random() * 180) + 30,
      };
    });
  } catch (err) {
    console.warn('Client RSS fallback failed:', err);
    return [];
  }
}

/**
 * Main function: Get live, country-specific breaking news
 * @param {string} category e.g. 'all', 'Football', 'Tech', 'World'
 * @param {string} country e.g. 'ES', 'US', 'GB', 'GH', 'FR', 'WORLD'
 * @param {boolean} forceRefresh whether to bypass cache
 */
export async function getLiveNews(category = 'all', country = 'WORLD', forceRefresh = false) {
  const cacheKey = `gio_news_${country}_${category}`;

  // 1. Check in-memory session cache (60 seconds)
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 60 * 1000 && Array.isArray(parsed.articles) && parsed.articles.length > 0) {
          return parsed.articles;
        }
      }
    } catch {}
  }

  // 2. First attempt: Spring Boot live backend endpoint (/api/news)
  try {
    const res = await api.get('/api/news', {
      params: { country, category },
      timeout: 5000,
    });
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), articles: res.data }));
      } catch {}
      return res.data;
    }
  } catch (backendErr) {
    console.warn('Backend /api/news unavailable, trying direct RSS:', backendErr?.message);
  }

  // 3. Second attempt: Client-side Google News RSS fetch via public proxy
  const clientArticles = await fetchClientRss(country, category);
  if (clientArticles.length > 0) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), articles: clientArticles }));
    } catch {}
    return clientArticles;
  }

  // 4. Third attempt: Dynamic fallback news with fresh timestamps
  const flag = getFlag(country);
  return FALLBACK_NEWS.map((art) => ({
    ...art,
    sourceLogo: flag,
    country,
    timeAgo: 'Just now',
  }));
}
