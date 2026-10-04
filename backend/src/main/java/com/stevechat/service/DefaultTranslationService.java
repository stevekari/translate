package com.stevechat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class DefaultTranslationService implements TranslationService {

    private static final Logger log = LoggerFactory.getLogger(DefaultTranslationService.class);
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    // Rich offline phrase dictionary mapping lowercased phrase -> (targetLang -> translatedText)
    private static final Map<String, Map<String, String>> DICT = new HashMap<>();

    private static void addEntry(String phrase, String... pairs) {
        Map<String, String> map = DICT.computeIfAbsent(phrase.toLowerCase(Locale.ROOT).trim(), k -> new HashMap<>());
        for (int i = 0; i < pairs.length; i += 2) {
            if (i + 1 < pairs.length) {
                map.put(pairs[i].toLowerCase(Locale.ROOT), pairs[i + 1]);
            }
        }
    }

    static {
        // Greetings & Basics
        addEntry("good", "es", "bueno", "en", "good", "fr", "bon", "de", "gut", "nl", "goed", "pt", "bom", "tw", "papa / kyerɛ");
        addEntry("bueno", "en", "good", "es", "bueno", "fr", "bon", "de", "gut", "nl", "goed", "pt", "bom", "tw", "papa");
        addEntry("bien", "en", "good / fine", "es", "bien", "fr", "bien", "de", "gut", "nl", "goed", "pt", "bem", "tw", "eye");
        addEntry("hello", "es", "hola", "fr", "bonjour", "de", "hallo", "nl", "hallo", "pt", "olá", "tw", "akwaaba / maho", "en", "hello");
        addEntry("hi", "es", "hola", "fr", "salut", "de", "hallo", "nl", "hallo", "pt", "olá", "tw", "maho", "en", "hi");
        addEntry("hola", "en", "Hello", "fr", "Bonjour", "de", "Hallo", "nl", "Hallo", "pt", "Olá", "tw", "Akwaaba / Maho", "es", "hola");
        addEntry("how are you", "es", "¿cómo estás?", "fr", "comment vas-tu ?", "de", "wie geht es dir?", "nl", "hoe gaat het?", "pt", "como você está?", "tw", "wo ho te sɛn?", "en", "how are you");
        addEntry("how are you?", "es", "¿cómo estás?", "fr", "comment vas-tu ?", "de", "wie geht es dir?", "nl", "hoe gaat het?", "pt", "como você está?", "tw", "wo ho te sɛn?", "en", "how are you?");
        addEntry("¿cómo estás?", "en", "How are you?", "fr", "Comment vas-tu ?", "de", "Wie geht es dir?", "nl", "Hoe gaat het?", "pt", "Como vai?", "tw", "Wo ho te sɛn?", "es", "¿cómo estás?");
        addEntry("como estas", "en", "How are you?", "fr", "Comment vas-tu ?", "de", "Wie geht es dir?", "nl", "Hoe gaat het?", "pt", "Como vai?", "tw", "Wo ho te sɛn?", "es", "¿cómo estás?");
        addEntry("¿cómo estás hoy?", "en", "How are you today?", "fr", "Comment vas-tu aujourd'hui ?", "de", "Wie geht es dir heute?", "nl", "Hoe gaat het vandaag?", "pt", "Como vai hoje?", "tw", "Wo ho te sɛn ɛnnɛ?", "es", "¿cómo estás hoy?");
        addEntry("good morning", "es", "buenos días", "fr", "bonjour", "de", "guten Morgen", "nl", "goedemorgen", "pt", "bom dia", "tw", "mema wo akye", "en", "good morning");
        addEntry("buenos días", "en", "Good morning", "fr", "Bonjour", "de", "Guten Morgen", "nl", "Goedemorgen", "pt", "Bom dia", "tw", "Mema wo akye", "es", "buenos días");
        addEntry("good night", "es", "buenas noches", "fr", "bonne nuit", "de", "gute Nacht", "nl", "goedenacht", "pt", "boa noite", "tw", "mema wo da yie", "en", "good night");
        addEntry("buenas noches", "en", "Good night", "fr", "Bonne nuit", "de", "Gute Nacht", "nl", "Goedenacht", "pt", "Boa noite", "tw", "Mema wo da yie", "es", "buenas noches");
        addEntry("thank you", "es", "gracias", "fr", "merci", "de", "danke", "nl", "bedankt", "pt", "obrigado", "tw", "medaase", "en", "thank you");
        addEntry("thanks", "es", "gracias", "fr", "merci", "de", "danke", "nl", "bedankt", "pt", "obrigado", "tw", "medaase", "en", "thanks");
        addEntry("gracias", "en", "Thank you", "fr", "Merci", "de", "Danke", "nl", "Bedankt", "pt", "Obrigado", "tw", "Medaase", "es", "gracias");
        addEntry("you are welcome", "es", "de nada", "fr", "de rien", "de", "bitte", "nl", "graag gedaan", "pt", "de nada", "tw", "meda wo ase nso", "en", "you are welcome");
        addEntry("de nada", "en", "You're welcome", "fr", "De rien", "de", "Bitte", "nl", "Graag gedaan", "pt", "De nada", "tw", "Meda wo ase nso", "es", "de nada");
        addEntry("yes", "es", "sí", "fr", "oui", "de", "ja", "nl", "ja", "pt", "sim", "tw", "aane", "en", "yes");
        addEntry("no", "es", "no", "fr", "non", "de", "nein", "nl", "nee", "pt", "não", "tw", "daabi", "en", "no");
        addEntry("friend", "es", "amigo", "fr", "ami", "de", "Freund", "nl", "vriend", "pt", "amigo", "tw", "adamfo", "en", "friend");
        addEntry("amigo", "en", "friend", "fr", "ami", "de", "Freund", "nl", "vriend", "pt", "amigo", "tw", "adamfo", "es", "amigo");
        addEntry("great", "es", "genial / excelente", "fr", "génial", "de", "großartig", "nl", "geweldig", "pt", "ótimo", "tw", "ɛyɛ paa", "en", "great");
        addEntry("see you later", "es", "hasta luego", "fr", "à plus tard", "de", "bis später", "nl", "tot later", "pt", "até logo", "tw", "yɛbɛhyia akyire", "en", "see you later");
        addEntry("hasta luego", "en", "See you later", "fr", "À plus tard", "de", "Bis später", "nl", "Tot later", "pt", "Até logo", "tw", "Yɛbɛhyia akyire", "es", "hasta luego");
        addEntry("what are you doing?", "es", "¿qué estás haciendo?", "fr", "que fais-tu ?", "de", "was machst du?", "nl", "wat ben je aan het doen?", "pt", "o que você está fazendo?", "tw", "wode dɛn na ɛreyɛ?", "en", "what are you doing?");
        addEntry("i love you", "es", "te amo / te quiero", "fr", "je t'aime", "de", "ich liebe dich", "nl", "ik hou van jou", "pt", "eu te amo", "tw", "medɔ wo", "en", "i love you");
        addEntry("me pɛ sɛ yɛkɔ", "en", "I want us to go", "es", "Quiero que nos vayamos", "fr", "Je veux que nous partions", "de", "Ich möchte, dass wir gehen", "tw", "me pɛ sɛ yɛkɔ");
        addEntry("wo ho te sɛn?", "en", "How are you?", "es", "¿Cómo estás?", "fr", "Comment vas-tu ?", "de", "Wie geht es dir?", "tw", "wo ho te sɛn?");
    }

    public DefaultTranslationService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    private String normalizeLanguageCode(String code) {
        if (code == null || code.isBlank()) return "en";
        String lower = code.trim().toLowerCase();
        if ("twi".equals(lower) || "tw".equals(lower)) {
            return "ak"; // Akan / Twi in Google Translate
        }
        return lower;
    }

    private String denormalizeLanguageCode(String code) {
        if ("ak".equalsIgnoreCase(code)) return "tw";
        if (code == null || code.isBlank() || "auto".equalsIgnoreCase(code) || "autodetect".equalsIgnoreCase(code)) {
            return "en";
        }
        return code.toLowerCase();
    }

    /**
     * Heuristic language detector for when external API is unreachable or returns "auto".
     */
    public String detectLanguage(String text) {
        if (text == null || text.isBlank()) return "en";
        String str = text.trim();
        String lower = str.toLowerCase(Locale.ROOT);

        // Check non-Latin scripts
        if (str.matches(".*\\p{InCyrillic}.*")) return "ru";
        if (str.matches(".*\\p{InArabic}.*")) return "ar";
        if (str.matches(".*[\\p{InHiragana}\\p{InKatakana}].*")) return "ja";
        if (str.matches(".*\\p{InCJKUnifiedIdeographs}.*")) return "zh";

        // Twi / Akan specific characters or phrases
        if (str.contains("ɛ") || str.contains("ɔ") || str.contains("Ɛ") || str.contains("Ɔ")
                || lower.contains("wo ho te") || lower.contains("ɛte sɛn") || lower.contains("akwaaba")
                || lower.contains("medaase") || lower.contains("mema wo") || lower.contains("me pɛ")
                || lower.contains("da yie") || lower.contains("chale") || lower.contains("papa")) {
            return "tw";
        }

        // Spanish punctuation and common words
        if (str.contains("¿") || str.contains("¡") || str.contains("ñ") || str.contains("Ñ")
                || lower.matches(".*\\b(hola|cómo|como|estás|estas|bueno|buena|buenos|buenas|días|noches|gracias|amigo|amiga|adiós|hoy|estoy|hacer|llamada|quieres|bien|donde|dónde|qué|que|por favor|genial|hasta|luego)\\b.*")) {
            return "es";
        }

        // French
        if (str.contains("œ") || lower.matches(".*\\b(bonjour|merci|comment|vas-tu|ça va|salut|oui|non|s'il vous plaît|au revoir|je|suis|très|avec|pourquoi|génial)\\b.*")) {
            return "fr";
        }

        // German
        if (str.contains("ß") || str.contains("ä") || str.contains("ö") || str.contains("ü")
                || lower.matches(".*\\b(hallo|danke|wie|geht|guten|morgen|abend|bitte|tschüss|nicht|schön|sehr|großartig)\\b.*")) {
            return "de";
        }

        // Portuguese
        if (str.contains("ã") || str.contains("õ") || lower.matches(".*\\b(olá|como|vai|obrigado|obrigada|bom dia|boa noite|tudo|bem|você|ótimo)\\b.*")) {
            return "pt";
        }

        // Italian
        if (lower.matches(".*\\b(ciao|come|stai|grazie|buongiorno|buonasera|prego|arrivederci|molto|bene)\\b.*")) {
            return "it";
        }

        // Dutch
        if (lower.matches(".*\\b(hoe|gaat|het|goedemorgen|bedankt|alsjeblieft|tot ziens|fijn|dag|welkom|geweldig)\\b.*")) {
            return "nl";
        }

        // English keywords
        if (lower.matches(".*\\b(hello|hi|hey|how|are|you|today|good|morning|night|thank|thanks|welcome|what|where|when|why|please|doing|great|fine|doing)\\b.*")) {
            return "en";
        }

        return "en";
    }

    @Override
    public TranslationResult translate(String text, String targetLanguage) {
        return translate(text, targetLanguage, "auto");
    }

    @Override
    public TranslationResult translate(String text, String targetLanguage, String sourceLanguage) {
        if (text == null || text.trim().isEmpty()) {
            return new TranslationResult(text, "", "en", targetLanguage != null ? targetLanguage : "en");
        }

        String targetCode = normalizeLanguageCode(targetLanguage);
        String sourceCode = (sourceLanguage == null || sourceLanguage.isBlank() || "auto".equalsIgnoreCase(sourceLanguage))
                ? "auto"
                : normalizeLanguageCode(sourceLanguage);

        String trimmed = text.trim();
        String detectedLang = "auto".equals(sourceCode) ? detectLanguage(trimmed) : sourceCode;

        // If detected source language is the same as the target language, flip target to the counterpart (e.g. en -> es or es -> en)
        if (detectedLang.equalsIgnoreCase(targetCode) || "ak".equalsIgnoreCase(detectedLang) && "ak".equalsIgnoreCase(targetCode)) {
            if ("en".equalsIgnoreCase(targetCode)) {
                targetCode = "es";
            } else if ("es".equalsIgnoreCase(targetCode)) {
                targetCode = "en";
            } else {
                targetCode = "en";
            }
        }

        // 1. Fast Dictionary Lookup
        String cleanKey = trimmed.toLowerCase(Locale.ROOT)
                .replaceAll("[.,!?¿¡]+$", "")
                .replaceAll("^[¿¡]+", "")
                .trim();

        if (DICT.containsKey(trimmed.toLowerCase(Locale.ROOT))) {
            Map<String, String> m = DICT.get(trimmed.toLowerCase(Locale.ROOT));
            String denormTarget = denormalizeLanguageCode(targetCode);
            if (m.containsKey(denormTarget)) {
                return new TranslationResult(text, m.get(denormTarget), denormalizeLanguageCode(detectedLang), denormTarget);
            }
        }
        if (DICT.containsKey(cleanKey)) {
            Map<String, String> m = DICT.get(cleanKey);
            String denormTarget = denormalizeLanguageCode(targetCode);
            if (m.containsKey(denormTarget)) {
                return new TranslationResult(text, m.get(denormTarget), denormalizeLanguageCode(detectedLang), denormTarget);
            }
        }

        // 2. Try Google Translate Public Engine
        try {
            String encodedQuery = URLEncoder.encode(trimmed, StandardCharsets.UTF_8);
            String url = String.format(
                    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=%s&tl=%s&dt=t&dt=ld&q=%s",
                    sourceCode,
                    targetCode,
                    encodedQuery
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                StringBuilder translatedBuilder = new StringBuilder();

                if (root.isArray() && root.size() > 0) {
                    JsonNode sentences = root.get(0);
                    if (sentences.isArray()) {
                        for (JsonNode sentence : sentences) {
                            if (sentence.isArray() && sentence.size() > 0) {
                                translatedBuilder.append(sentence.get(0).asText(""));
                            }
                        }
                    }

                    String apiDetectedLang = sourceCode;
                    if ("auto".equals(sourceCode)) {
                        if (root.size() > 2 && !root.get(2).isNull() && root.get(2).isTextual() && !root.get(2).asText().isBlank()) {
                            apiDetectedLang = root.get(2).asText();
                        } else if (root.size() > 8 && !root.get(8).isNull() && root.get(8).isArray() && root.get(8).size() > 0) {
                            apiDetectedLang = root.get(8).get(0).get(0).asText();
                        } else if (root.size() > 1 && !root.get(1).isNull() && root.get(1).isTextual() && !root.get(1).asText().isBlank()) {
                            apiDetectedLang = root.get(1).asText();
                        } else {
                            apiDetectedLang = detectedLang;
                        }
                    }

                    String result = translatedBuilder.toString().trim();
                    if (!result.isEmpty()) {
                        return new TranslationResult(
                                text,
                                result,
                                denormalizeLanguageCode(apiDetectedLang),
                                denormalizeLanguageCode(targetCode)
                        );
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Google Translate call failed: {}", e.getMessage());
        }

        // 3. Try MyMemory Translation API Fallback
        try {
            String myMemoryPair = ("auto".equals(sourceCode) ? detectedLang : sourceCode) + "|" + targetCode;
            String mmUrl = "https://api.mymemory.translated.net/get?q=" +
                    URLEncoder.encode(trimmed, StandardCharsets.UTF_8) +
                    "&langpair=" + URLEncoder.encode(myMemoryPair, StandardCharsets.UTF_8);

            HttpRequest mmReq = HttpRequest.newBuilder()
                    .uri(URI.create(mmUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("User-Agent", "Mozilla/5.0")
                    .GET()
                    .build();

            HttpResponse<String> mmRes = httpClient.send(mmReq, HttpResponse.BodyHandlers.ofString());
            if (mmRes.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(mmRes.body());
                if (root.has("responseData") && root.get("responseData").has("translatedText")) {
                    String mmResult = root.get("responseData").get("translatedText").asText();
                    if (mmResult != null && !mmResult.isBlank() && !mmResult.startsWith("MYMEMORY WARNING")) {
                        return new TranslationResult(
                                text,
                                mmResult,
                                denormalizeLanguageCode(detectedLang),
                                denormalizeLanguageCode(targetCode)
                        );
                    }
                }
            }
        } catch (Exception e) {
            log.warn("MyMemory fallback call failed: {}", e.getMessage());
        }

        // 4. Safe fallback: return original text with accurate language pair
        return new TranslationResult(
                text,
                text,
                denormalizeLanguageCode(detectedLang),
                denormalizeLanguageCode(targetCode)
        );
    }
}
