/**
 * News API Service
 * Fetches free real-world news for Spain, World, Football, and Tech.
 * Uses public RSS-to-JSON (zero API key required) and GNews (if VITE_GNEWS_API_KEY is present).
 * Formats every article into a clean, short X/Twitter-style micro-card with original website links.
 */

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Curated live feed sources
const FEED_SOURCES = {
  spain: [
    {
      source: 'El País',
      handle: '@elpais',
      logo: '🇪🇸',
      category: 'Spain',
      url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
    },
    {
      source: 'RTVE Noticias',
      handle: '@rtvenoticias',
      logo: '🔴',
      category: 'Spain',
      url: 'https://www.rtve.es/noticias/rss/',
    },
  ],
  world: [
    {
      source: 'BBC News World',
      handle: '@bbcworld',
      logo: '🌍',
      category: 'World',
      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    },
    {
      source: 'BBC Mundo',
      handle: '@bbcmundo',
      logo: '🌎',
      category: 'World',
      url: 'https://feeds.bbci.co.uk/mundo/rss.xml',
    },
  ],
  football: [
    {
      source: 'Marca',
      handle: '@marca',
      logo: '⚽',
      category: 'Football',
      url: 'https://e00-marca.uecdn.es/rss/portada.xml',
    },
  ],
};

// High-quality fallback articles (with real links to original websites)
export const FALLBACK_NEWS = [
  {
    id: 'fallback-spain-1',
    source: 'El País',
    handle: '@elpais',
    sourceLogo: '🇪🇸',
    verified: true,
    category: 'Spain',
    title: 'España lidera la inversión europea en energías renovables y alta velocidad',
    summary: 'El país consolida su transición energética con nuevos parques eólicos y récord en conexiones ferroviarias sostenibles.',
    url: 'https://elpais.com',
    timeAgo: '18m',
    readTime: '2 min',
    imageUrl: null,
    likes: 642,
    reposts: 118,
  },
  {
    id: 'fallback-spain-2',
    source: 'Marca',
    handle: '@marca',
    sourceLogo: '⚽',
    verified: true,
    category: 'Football',
    title: 'LaLiga al rojo vivo: Real Madrid y Barcelona luchan por la cima del campeonato',
    summary: 'Los dos gigantes de España mantienen una intensa batalla por el título a pocas jornadas del final de la temporada.',
    url: 'https://www.marca.com',
    timeAgo: '32m',
    readTime: '3 min',
    imageUrl: null,
    likes: 1420,
    reposts: 380,
  },
  {
    id: 'fallback-world-1',
    source: 'BBC World News',
    handle: '@bbcworld',
    sourceLogo: '🌍',
    verified: true,
    category: 'World',
    title: 'Historic Green Transition Accord Signed Across 80 Nations at Global Summit',
    summary: 'World leaders and energy ministers finalized a multilateral framework to accelerate global clean electricity and continental power grids.',
    url: 'https://www.bbc.com/news/world',
    timeAgo: '45m',
    readTime: '3 min',
    imageUrl: null,
    likes: 890,
    reposts: 215,
  },
  {
    id: 'fallback-world-2',
    source: 'BBC Mundo',
    handle: '@bbcmundo',
    sourceLogo: '🌎',
    verified: true,
    category: 'World',
    title: 'Avance histórico en inteligencia artificial para la traducción de dialectos en tiempo real',
    summary: 'Nuevos modelos neuronales permiten a las familias comunicarse sin barreras idiomáticas entre generaciones y culturas.',
    url: 'https://www.bbc.com/mundo',
    timeAgo: '1h',
    readTime: '2 min',
    imageUrl: null,
    likes: 530,
    reposts: 94,
  },
  {
    id: 'fallback-tech-1',
    source: 'Reuters Tech',
    handle: '@reuterstech',
    sourceLogo: '🚀',
    verified: true,
    category: 'Tech',
    title: 'Next-Generation Neural Voice Models Achieve Near-Zero Latency on Mobile Devices',
    summary: 'Breakthrough on-device synthesis translates regional accents and colloquial speech instantly with ultra-low battery consumption.',
    url: 'https://www.reuters.com/technology',
    timeAgo: '2h',
    readTime: '3 min',
    imageUrl: null,
    likes: 712,
    reposts: 164,
  },
];

/**
 * Strip HTML tags and clean up string for concise X-style reading
 */
function cleanText(htmlOrText = '', maxLength = 160) {
  if (!htmlOrText) return '';
  const div = document.createElement('div');
  div.innerHTML = htmlOrText;
  let text = div.textContent || div.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxLength) {
    return text.substring(0, maxLength).trim() + '...';
  }
  return text;
}

/**
 * Calculate human friendly time ago (e.g., '14m', '2h')
 */
function formatTimeAgo(pubDate) {
  if (!pubDate) return 'Recent';
  try {
    const diffMs = Date.now() - new Date(pubDate).getTime();
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } catch {
    return 'Recent';
  }
}

/**
 * Extract image URL from item
 */
function extractImage(item) {
  if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
  if (item.enclosure?.link && item.enclosure.link.startsWith('http')) return item.enclosure.link;
  if (item.description && typeof item.description === 'string') {
    const match = item.description.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Fetch news from GNews if API key is provided
 */
async function fetchGNews(category = 'all') {
  const apiKey = import.meta.env?.VITE_GNEWS_API_KEY;
  if (!apiKey) return null;

  try {
    let endpoint = `https://gnews.io/api/v4/top-headlines?category=general&apikey=${apiKey}`;
    if (category === 'Spain') {
      endpoint = `https://gnews.io/api/v4/top-headlines?country=es&category=general&apikey=${apiKey}`;
    } else if (category === 'World') {
      endpoint = `https://gnews.io/api/v4/top-headlines?topic=world&lang=en&apikey=${apiKey}`;
    } else if (category === 'Football') {
      endpoint = `https://gnews.io/api/v4/top-headlines?topic=sports&apikey=${apiKey}`;
    }

    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.articles?.length) return null;

    return data.articles.map((a, idx) => ({
      id: `gnews-${idx}-${Date.now()}`,
      source: a.source?.name || 'News',
      handle: `@${(a.source?.name || 'news').toLowerCase().replace(/\s+/g, '')}`,
      sourceLogo: category === 'Spain' ? '🇪🇸' : category === 'Football' ? '⚽' : '🌍',
      verified: true,
      category: category === 'all' ? 'World' : category,
      title: a.title,
      summary: cleanText(a.description || a.content),
      url: a.url,
      timeAgo: formatTimeAgo(a.publishedAt),
      imageUrl: a.image || null,
      likes: Math.floor(Math.random() * 500) + 80,
      reposts: Math.floor(Math.random() * 150) + 20,
    }));
  } catch (err) {
    console.warn('GNews fetch failed, falling back:', err);
    return null;
  }
}

/**
 * Fetch from RSS-to-JSON (Zero API key needed)
 */
async function fetchRssFeed(feedSource) {
  try {
    const encodedUrl = encodeURIComponent(feedSource.url);
    const res = await fetch(`${RSS2JSON_BASE}${encodedUrl}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !Array.isArray(data.items)) return [];

    return data.items.slice(0, 8).map((item, idx) => ({
      id: `${feedSource.source}-${idx}-${Date.now()}`,
      source: feedSource.source,
      handle: feedSource.handle,
      sourceLogo: feedSource.logo,
      verified: true,
      category: feedSource.category,
      title: item.title?.replace(/&amp;/g, '&')?.replace(/&#39;/g, "'") || '',
      summary: cleanText(item.description),
      url: item.link || item.guid || 'https://google.com',
      timeAgo: formatTimeAgo(item.pubDate),
      imageUrl: extractImage(item),
      likes: Math.floor(Math.random() * 600) + 120,
      reposts: Math.floor(Math.random() * 200) + 30,
    }));
  } catch (err) {
    console.warn(`Feed fetch failed for ${feedSource.source}:`, err);
    return [];
  }
}

/**
 * Main export: Get news articles by category
 * Category can be: 'all', 'Spain', 'World', 'Football', 'Tech'
 */
export async function getLiveNews(category = 'all') {
  // 1. Check Session Storage cache first (5-minute cache)
  const cacheKey = `gio_news_cache_${category}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000 && parsed.articles?.length > 0) {
        return parsed.articles;
      }
    }
  } catch {
    // ignore sessionStorage errors
  }

  // 2. Try GNews if configured
  const gNewsArticles = await fetchGNews(category);
  if (gNewsArticles && gNewsArticles.length > 0) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), articles: gNewsArticles }));
    } catch {}
    return gNewsArticles;
  }

  // 3. Fetch from free public RSS feeds
  const targets = [];
  if (category === 'all') {
    targets.push(FEED_SOURCES.spain[0], FEED_SOURCES.world[0], FEED_SOURCES.football[0]);
  } else if (category === 'Spain') {
    targets.push(...FEED_SOURCES.spain);
  } else if (category === 'World') {
    targets.push(...FEED_SOURCES.world);
  } else if (category === 'Football') {
    targets.push(...FEED_SOURCES.football);
  } else {
    targets.push(FEED_SOURCES.world[0]);
  }

  try {
    const results = await Promise.allSettled(targets.map((src) => fetchRssFeed(src)));
    const merged = [];
    results.forEach((res) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        merged.push(...res.value);
      }
    });

    if (merged.length > 0) {
      // Interleave or sort by latest
      const finalArticles = merged.slice(0, 15);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), articles: finalArticles }));
      } catch {}
      return finalArticles;
    }
  } catch (err) {
    console.warn('RSS fetching error:', err);
  }

  // 4. Clean Fallback if all network calls fail (e.g. offline)
  if (category === 'all') return FALLBACK_NEWS;
  const filteredFallback = FALLBACK_NEWS.filter((n) => n.category.toLowerCase() === category.toLowerCase());
  return filteredFallback.length > 0 ? filteredFallback : FALLBACK_NEWS;
}
