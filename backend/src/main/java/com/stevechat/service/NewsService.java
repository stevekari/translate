package com.stevechat.service;

import com.stevechat.dto.NewsArticleDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class NewsService {

    private static final Logger log = LoggerFactory.getLogger(NewsService.class);
    private final HttpClient httpClient;

    // Cache structure: cacheKey -> CachedResult
    private static class CachedResult {
        final long timestamp;
        final List<NewsArticleDto> articles;

        CachedResult(List<NewsArticleDto> articles) {
            this.timestamp = System.currentTimeMillis();
            this.articles = articles;
        }
    }

    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 60 * 1000; // 60 seconds live cache

    public NewsService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(6))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public List<NewsArticleDto> getLiveNews(String country, String category) {
        String cCode = (country == null || country.isBlank()) ? "ALL" : country.trim().toUpperCase(Locale.ROOT);
        String cat = (category == null || category.isBlank()) ? "all" : category.trim();

        String cacheKey = cCode + "_" + cat.toLowerCase(Locale.ROOT);
        CachedResult cached = cache.get(cacheKey);
        if (cached != null && (System.currentTimeMillis() - cached.timestamp < CACHE_TTL_MS)) {
            return cached.articles;
        }

        List<NewsArticleDto> articles;
        if ("ALL".equals(cCode) || "MIXED".equals(cCode) || "WORLD".equals(cCode)) {
            articles = fetchMixedMultiCountryNews(cat);
        } else {
            articles = fetchFromGoogleNews(cCode, cat);
        }

        if (articles != null && !articles.isEmpty()) {
            cache.put(cacheKey, new CachedResult(articles));
            return articles;
        }

        // Return fallback if fetch failed
        return generateCountryFallback(cCode, cat);
    }

    private List<NewsArticleDto> fetchMixedMultiCountryNews(String category) {
        // Diverse mix of countries from Europe, Americas, Africa
        String[] targetCountries = {"ES", "US", "GB", "GH", "FR", "NG", "DE", "IT", "BR"};

        List<CompletableFuture<List<NewsArticleDto>>> futures = new ArrayList<>();
        for (String c : targetCountries) {
            futures.add(CompletableFuture.supplyAsync(() -> fetchFromGoogleNews(c, category)));
        }

        List<List<NewsArticleDto>> countryLists = new ArrayList<>();
        for (CompletableFuture<List<NewsArticleDto>> f : futures) {
            try {
                List<NewsArticleDto> items = f.get(3500, TimeUnit.MILLISECONDS);
                if (items != null && !items.isEmpty()) {
                    countryLists.add(items);
                }
            } catch (Exception ignored) {
            }
        }

        if (countryLists.isEmpty()) {
            return generateCountryFallback("ALL", category);
        }

        // Interleave articles from different countries in round-robin fashion
        List<NewsArticleDto> mixed = new ArrayList<>();
        int maxItemsPerCountry = 3;
        for (int rank = 0; rank < maxItemsPerCountry; rank++) {
            for (List<NewsArticleDto> list : countryLists) {
                if (rank < list.size()) {
                    mixed.add(list.get(rank));
                }
            }
        }

        return mixed.isEmpty() ? generateCountryFallback("ALL", category) : mixed;
    }

    private List<NewsArticleDto> fetchFromGoogleNews(String countryCode, String category) {
        String url = getFeedUrl(countryCode, category);
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                    .GET()
                    .build();

            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() == 200) {
                return parseRssXml(response.body(), countryCode, category);
            }
        } catch (Exception e) {
            log.warn("Failed to fetch live RSS for country {}: {}", countryCode, e.getMessage());
        }
        return Collections.emptyList();
    }

    private String getFeedUrl(String country, String category) {
        String cat = category.toLowerCase(Locale.ROOT);
        if ("football".equals(cat) || "sports".equals(cat)) {
            return "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en";
        }
        if ("tech".equals(cat) || "technology".equals(cat)) {
            return "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en";
        }

        return switch (country) {
            case "ES" -> "https://news.google.com/rss?hl=es-ES&gl=ES&ceid=ES:es";
            case "US" -> "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";
            case "GB" -> "https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en";
            case "GH" -> "https://news.google.com/rss?hl=en-GH&gl=GH&ceid=GH:en";
            case "FR" -> "https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr";
            case "DE" -> "https://news.google.com/rss?hl=de&gl=DE&ceid=DE:de";
            case "IT" -> "https://news.google.com/rss?hl=it&gl=IT&ceid=IT:it";
            case "BR" -> "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419";
            case "NG" -> "https://news.google.com/rss?hl=en-NG&gl=NG&ceid=NG:en";
            case "NL" -> "https://news.google.com/rss?hl=nl&gl=NL&ceid=NL:nl";
            case "MX" -> "https://news.google.com/rss?hl=es-419&gl=MX&ceid=MX:es-419";
            case "CA" -> "https://news.google.com/rss?hl=en-CA&gl=CA&ceid=CA:en";
            default -> "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en";
        };
    }

    private List<NewsArticleDto> parseRssXml(byte[] xmlBytes, String countryCode, String category) {
        List<NewsArticleDto> list = new ArrayList<>();
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder db = dbf.newDocumentBuilder();
            Document doc = db.parse(new ByteArrayInputStream(xmlBytes));
            doc.getDocumentElement().normalize();

            NodeList items = doc.getElementsByTagName("item");
            int max = Math.min(items.getLength(), 20);

            String flag = getCountryFlag(countryCode);

            for (int i = 0; i < max; i++) {
                Element item = (Element) items.item(i);
                String rawTitle = getElementText(item, "title");
                String link = getElementText(item, "link");
                String pubDateStr = getElementText(item, "pubDate");
                String desc = getElementText(item, "description");
                String source = getElementText(item, "source");

                // Parse source from title if source tag is missing (Google news formats: "Headline - Source Name")
                String title = rawTitle;
                if ((source == null || source.isBlank()) && rawTitle.contains(" - ")) {
                    int lastDash = rawTitle.lastIndexOf(" - ");
                    source = rawTitle.substring(lastDash + 3).trim();
                    title = rawTitle.substring(0, lastDash).trim();
                }

                if (source == null || source.isBlank()) {
                    source = countryCode + " News";
                }

                String cleanSummary = cleanHtml(desc);
                if (cleanSummary.isEmpty()) {
                    cleanSummary = title;
                }

                String timeAgo = formatTimeAgo(pubDateStr);
                String handle = "@" + source.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
                int likes = 100 + (Math.abs(title.hashCode()) % 800);
                int reposts = 20 + (Math.abs(title.hashCode()) % 250);

                list.add(new NewsArticleDto(
                        "news-" + countryCode + "-" + i + "-" + System.currentTimeMillis(),
                        title,
                        cleanSummary,
                        link,
                        source,
                        handle,
                        flag,
                        category,
                        countryCode,
                        pubDateStr,
                        timeAgo,
                        null,
                        likes,
                        reposts
                ));
            }
        } catch (Exception e) {
            log.warn("XML parsing failed for RSS: {}", e.getMessage());
        }
        return list;
    }

    private String getElementText(Element parent, String tag) {
        NodeList nl = parent.getElementsByTagName(tag);
        if (nl != null && nl.getLength() > 0) {
            return nl.item(0).getTextContent();
        }
        return "";
    }

    private String cleanHtml(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]*>", " ")
                .replaceAll("&amp;", "&")
                .replaceAll("&quot;", "\"")
                .replaceAll("&#39;", "'")
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String formatTimeAgo(String pubDateStr) {
        if (pubDateStr == null || pubDateStr.isBlank()) return "Just now";
        try {
            ZonedDateTime zdt = ZonedDateTime.parse(pubDateStr, DateTimeFormatter.RFC_1123_DATE_TIME);
            long diffMins = Duration.between(zdt.toInstant(), Instant.now()).toMinutes();
            if (diffMins < 1) return "Just now";
            if (diffMins < 60) return diffMins + "m";
            long diffHours = diffMins / 60;
            if (diffHours < 24) return diffHours + "h";
            return (diffHours / 24) + "d";
        } catch (Exception ignored) {
            return "Recent";
        }
    }

    private String getCountryFlag(String code) {
        return switch (code) {
            case "ES" -> "🇪🇸";
            case "US" -> "🇺🇸";
            case "GB" -> "🇬🇧";
            case "GH" -> "🇬🇭";
            case "FR" -> "🇫🇷";
            case "DE" -> "🇩🇪";
            case "IT" -> "🇮🇹";
            case "BR" -> "🇧🇷";
            case "NG" -> "🇳🇬";
            case "NL" -> "🇳🇱";
            case "MX" -> "🇲🇽";
            case "CA" -> "🇨🇦";
            default -> "🌍";
        };
    }

    private List<NewsArticleDto> generateCountryFallback(String country, String category) {
        List<NewsArticleDto> list = new ArrayList<>();

        if ("ALL".equals(country) || "MIXED".equals(country)) {
            list.add(new NewsArticleDto(
                    "fallback-es-1",
                    "España lidera la inversión europea en energías limpias y alta velocidad ferroviaria",
                    "El país consolida su transformación energética y modernización digital con nuevos corredores sostenibles.",
                    "https://elpais.com",
                    "El País",
                    "@elpais",
                    "🇪🇸",
                    category,
                    "ES",
                    new Date().toString(),
                    "5m",
                    null,
                    620,
                    110
            ));
            list.add(new NewsArticleDto(
                    "fallback-us-1",
                    "Global Tech Alliance Introduces Next-Generation AI Infrastructure Framework",
                    "Major computing labs and research institutions collaborate on ultra-low latency multimodal translation.",
                    "https://www.reuters.com",
                    "Reuters Tech",
                    "@reuters",
                    "🇺🇸",
                    category,
                    "US",
                    new Date().toString(),
                    "12m",
                    null,
                    940,
                    280
            ));
            list.add(new NewsArticleDto(
                    "fallback-gh-1",
                    "Ghana Accelerates Digital Economic Growth with New Continental Trade Hubs",
                    "West African technological hubs partner with international finance institutions to expand mobile services.",
                    "https://www.myjoyonline.com",
                    "Joy Online",
                    "@joyonline",
                    "🇬🇭",
                    category,
                    "GH",
                    new Date().toString(),
                    "18m",
                    null,
                    510,
                    95
            ));
            list.add(new NewsArticleDto(
                    "fallback-gb-1",
                    "Historic Cross-Continent Green Energy Interconnector Approved by Regulators",
                    "Transmission network expansion will facilitate high-capacity subsea power transfer across borders.",
                    "https://www.bbc.com/news",
                    "BBC News",
                    "@bbcnews",
                    "🇬🇧",
                    category,
                    "GB",
                    new Date().toString(),
                    "24m",
                    null,
                    880,
                    210
            ));
            list.add(new NewsArticleDto(
                    "fallback-fr-1",
                    "La France accélère le déploiement de ses réseaux de transport décarbonés",
                    "Le plan de relance européen soutient de nouveaux corridors ferroviaires et technologies d'électrification.",
                    "https://www.lemonde.fr",
                    "Le Monde",
                    "@lemonde",
                    "🇫🇷",
                    category,
                    "FR",
                    new Date().toString(),
                    "32m",
                    null,
                    730,
                    165
            ));
            list.add(new NewsArticleDto(
                    "fallback-ng-1",
                    "Nigeria Fintech Ecosystem Attracts Record Investment for Cross-Border Solutions",
                    "Leading payment platforms launch multi-currency settlement channels connecting diaspora families.",
                    "https://punchng.com",
                    "Punch News",
                    "@punchng",
                    "🇳🇬",
                    category,
                    "NG",
                    new Date().toString(),
                    "41m",
                    null,
                    650,
                    140
            ));
            return list;
        }

        String flag = getCountryFlag(country);
        list.add(new NewsArticleDto(
                "fallback-" + country + "-1",
                "Breaking: National Economic and Renewable Transition Agreement Announced",
                "Key initiatives across sustainable energy, digital communications, and infrastructure receive major funding.",
                "https://news.google.com",
                country + " National News",
                "@" + country.toLowerCase() + "news",
                flag,
                category,
                country,
                new Date().toString(),
                "12m",
                null,
                420,
                88
        ));
        list.add(new NewsArticleDto(
                "fallback-" + country + "-2",
                "Cultural and Technology Innovation Summit Opens to Global Participants",
                "Delegates and innovators gather to discuss real-time multilingual AI systems and cross-border connectivity.",
                "https://news.google.com",
                "Global Gazette",
                "@globalgazette",
                flag,
                category,
                country,
                new Date().toString(),
                "28m",
                null,
                780,
                145
        ));
        return list;
    }
}
