package com.stevechat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.stevechat.dto.AiAnswerResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
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
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${cloudflare.account.id:}")
    private String cfAccountId;

    @Value("${cloudflare.api.token:}")
    private String cfApiToken;

    @Value("${cloudflare.ai.model:@cf/meta/llama-3.1-8b-instruct}")
    private String cfAiModel;

    private final Map<String, String> envFallbackMap = new HashMap<>();

    public AiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        loadLocalEnvFile();
    }

    private void loadLocalEnvFile() {
        String[] candidatePaths = {
                "translate/backend/.env",
                "backend/.env",
                ".env",
                "../backend/.env"
        };
        for (String path : candidatePaths) {
            File f = new File(path);
            if (f.exists() && f.isFile()) {
                try (BufferedReader br = new BufferedReader(new FileReader(f, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        int idx = line.indexOf('=');
                        if (idx > 0) {
                            String k = line.substring(0, idx).trim();
                            String v = line.substring(idx + 1).trim();
                            if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                                v = v.substring(1, v.length() - 1);
                            }
                            envFallbackMap.put(k, v);
                        }
                    }
                    log.info("Loaded {} environment keys from fallback: {}", envFallbackMap.size(), path);
                    break;
                } catch (Exception e) {
                    log.debug("Could not read env file {}: {}", path, e.getMessage());
                }
            }
        }
    }

    private String getEnvOrProp(String key, String configuredVal) {
        if (configuredVal != null && !configuredVal.isBlank()) {
            return configuredVal.trim();
        }
        String sysVal = System.getenv(key);
        if (sysVal != null && !sysVal.isBlank()) {
            return sysVal.trim();
        }
        sysVal = System.getProperty(key);
        if (sysVal != null && !sysVal.isBlank()) {
            return sysVal.trim();
        }
        String fileVal = envFallbackMap.get(key);
        if (fileVal != null && !fileVal.isBlank()) {
            return fileVal.trim();
        }
        return null;
    }

    public AiAnswerResponse ask(String question, String context, String language) {
        if (question == null || question.trim().isEmpty()) {
            return new AiAnswerResponse("Please ask a question to receive AI assistance.", "GioAI", true);
        }

        String targetLang = (language == null || language.isBlank()) ? "en" : language.trim().toLowerCase(Locale.ROOT);
        String trimmedQuestion = question.trim();
        String contextSnippet = (context != null && !context.isBlank()) ? context.trim() : null;

        String accountId = getEnvOrProp("CLOUDFLARE_ACCOUNT_ID", cfAccountId);
        String apiToken = getEnvOrProp("CLOUDFLARE_API_TOKEN", cfApiToken);
        String aiModel = getEnvOrProp("CLOUDFLARE_AI_MODEL", cfAiModel);

        // 1. Cloudflare Workers AI (Fast, global, multi-model)
        if (accountId != null && !accountId.isBlank() && apiToken != null && !apiToken.isBlank()) {
            try {
                AiAnswerResponse resp = callCloudflare(accountId, apiToken, aiModel, trimmedQuestion, contextSnippet, targetLang);
                if (resp != null && resp.isSuccess() && resp.getAnswer() != null && !resp.getAnswer().isBlank()) {
                    return resp;
                }
            } catch (Exception e) {
                log.warn("Cloudflare Workers AI call failed, trying next provider: {}", e.getMessage());
            }
        }

        // 2. Check for Gemini API Key
        String geminiApiKey = getEnvOrProp("GEMINI_API_KEY", null);
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                AiAnswerResponse resp = callGemini(geminiApiKey, trimmedQuestion, contextSnippet, targetLang);
                if (resp != null && resp.isSuccess() && resp.getAnswer() != null && !resp.getAnswer().isBlank()) {
                    return resp;
                }
            } catch (Exception e) {
                log.warn("Gemini API call failed, trying next provider: {}", e.getMessage());
            }
        }

        // 3. Check for OpenAI API Key
        String openAiApiKey = getEnvOrProp("OPENAI_API_KEY", null);
        if (openAiApiKey != null && !openAiApiKey.isBlank()) {
            try {
                AiAnswerResponse resp = callOpenAi(openAiApiKey, trimmedQuestion, contextSnippet, targetLang);
                if (resp != null && resp.isSuccess() && resp.getAnswer() != null && !resp.getAnswer().isBlank()) {
                    return resp;
                }
            } catch (Exception e) {
                log.warn("OpenAI API call failed, trying next provider: {}", e.getMessage());
            }
        }

        // 4. Try Pollinations Free AI Engine
        try {
            AiAnswerResponse resp = callPollinations(trimmedQuestion, contextSnippet, targetLang);
            if (resp != null && resp.isSuccess() && resp.getAnswer() != null && !resp.getAnswer().isBlank()) {
                return resp;
            }
        } catch (Exception e) {
            log.warn("Pollinations AI call failed: {}", e.getMessage());
        }

        // 5. Fallback to Built-in Contextual Smart Assistant (High Quality)
        String fallbackAnswer = generateBuiltInAnswer(trimmedQuestion, contextSnippet, targetLang);
        return new AiAnswerResponse(fallbackAnswer, "GioAI Assistant", true);
    }

    private AiAnswerResponse callCloudflare(String accountId, String apiToken, String model, String question, String context, String language) throws Exception {
        String prompt = buildPrompt(question, context, language);
        String modelToUse = (model != null && !model.isBlank()) ? model : "@cf/meta/llama-3.1-8b-instruct";
        String url = "https://api.cloudflare.com/client/v4/accounts/" + accountId.trim() + "/ai/run/" + modelToUse.trim();

        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode messages = root.putArray("messages");
        messages.addObject()
                .put("role", "system")
                .put("content", "You are GioAI, an intelligent, friendly, and culturally insightful multicultural chat assistant. Provide structured, warm, and natural answers in language: " + language + ".");
        messages.addObject()
                .put("role", "user")
                .put("content", prompt);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiToken.trim())
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() == 200) {
            JsonNode resNode = objectMapper.readTree(response.body());
            JsonNode textNode = resNode.at("/result/response");
            if (textNode.isMissingNode() || textNode.asText().isBlank()) {
                textNode = resNode.at("/result/choices/0/message/content");
            }
            if (!textNode.isMissingNode() && !textNode.asText().isBlank()) {
                return new AiAnswerResponse(textNode.asText().trim(), "Cloudflare AI (" + modelToUse.replace("@cf/", "") + ")", true);
            }
        } else {
            log.warn("Cloudflare AI returned status {}: {}", response.statusCode(), response.body());
        }
        return null;
    }

    private AiAnswerResponse callGemini(String apiKey, String question, String context, String language) throws Exception {
        String prompt = buildPrompt(question, context, language);
        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;

        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode contents = root.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");
        parts.addObject().put("text", prompt);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(12))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() == 200) {
            JsonNode resNode = objectMapper.readTree(response.body());
            JsonNode textNode = resNode.at("/candidates/0/content/parts/0/text");
            if (!textNode.isMissingNode()) {
                return new AiAnswerResponse(textNode.asText().trim(), "Google Gemini", true);
            }
        }
        return null;
    }

    private AiAnswerResponse callOpenAi(String apiKey, String question, String context, String language) throws Exception {
        String prompt = buildPrompt(question, context, language);
        String url = "https://api.openai.com/v1/chat/completions";

        ObjectNode root = objectMapper.createObjectNode();
        root.put("model", "gpt-4o-mini");
        ArrayNode messages = root.putArray("messages");
        messages.addObject()
                .put("role", "system")
                .put("content", "You are GioAI, an intelligent, concise, and helpful multicultural chat assistant.");
        messages.addObject()
                .put("role", "user")
                .put("content", prompt);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(12))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() == 200) {
            JsonNode resNode = objectMapper.readTree(response.body());
            JsonNode textNode = resNode.at("/choices/0/message/content");
            if (!textNode.isMissingNode()) {
                return new AiAnswerResponse(textNode.asText().trim(), "OpenAI GPT-4o-mini", true);
            }
        }
        return null;
    }

    private AiAnswerResponse callPollinations(String question, String context, String language) throws Exception {
        String prompt = buildPrompt(question, context, language);

        // Attempt 1: Direct GET
        try {
            String encoded = URLEncoder.encode(prompt, StandardCharsets.UTF_8);
            String getUrl = "https://text.pollinations.ai/" + encoded + "?model=openai";
            HttpRequest getReq = HttpRequest.newBuilder()
                    .uri(URI.create(getUrl))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> getRes = httpClient.send(getReq, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (getRes.statusCode() == 200 && !getRes.body().isBlank()) {
                return new AiAnswerResponse(getRes.body().trim(), "GioAI Cloud", true);
            }
        } catch (Exception ignored) {}

        // Attempt 2: POST with messages
        String url = "https://text.pollinations.ai/";
        ObjectNode root = objectMapper.createObjectNode();
        ArrayNode messages = root.putArray("messages");
        messages.addObject()
                .put("role", "system")
                .put("content", "You are GioAI, a warm, concise, and helpful multilingual chat companion.");
        messages.addObject()
                .put("role", "user")
                .put("content", prompt);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(root), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() == 200) {
            String text = response.body().trim();
            if (!text.isEmpty()) {
                return new AiAnswerResponse(text, "GioAI Cloud", true);
            }
        }
        return null;
    }

    private String buildPrompt(String question, String context, String language) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are GioAI, a highly intelligent, accurate, and concise AI assistant inside GioChat.\n");
        sb.append("CRITICAL INSTRUCTION: Provide a direct, correct, and SHORT answer in 1 to 2 sentences maximum.\n");
        sb.append("Never include introductory greetings (e.g. 'Hello', 'Sure!'), conversational filler, or disclaimers. Get straight to the correct answer.\n");
        sb.append("Language: ").append(language).append(".\n\n");
        if (context != null && !context.isBlank()) {
            sb.append("Context: \"").append(context).append("\"\n\n");
        }
        sb.append("Question: ").append(question);
        return sb.toString();
    }

    private String generateBuiltInAnswer(String question, String context, String language) {
        String qLower = question.toLowerCase(Locale.ROOT);

        // Greetings
        if (qLower.equals("hi") || qLower.equals("hello") || qLower.startsWith("hi ") || qLower.startsWith("hello ") || qLower.contains("hey gioai") || qLower.contains("who are you")) {
            return "Hello! I am GioAI, your intelligent AI assistant in GioChat. Ask me any question for a quick, direct answer.";
        }

        // Reply generation
        if (qLower.contains("reply") || qLower.contains("respond") || qLower.contains("answer") || qLower.contains("what should i say")) {
            if (context != null && !context.isBlank()) {
                return "A natural short reply: \"Thanks for letting me know! That sounds great 👍\"";
            }
            return "A friendly short reply: \"Thanks for checking in! Hope you are having a wonderful day 😊\"";
        }

        // Explaining meaning / idioms / slang
        if (qLower.contains("explain") || qLower.contains("mean") || qLower.contains("meaning") || qLower.contains("slang") || qLower.contains("idiom") || qLower.contains("phrase")) {
            if (context != null && !context.isBlank()) {
                return "In casual conversation, \"" + context + "\" conveys friendly agreement and positive acknowledgment.";
            }
            return "💡 **GioAI Slang & Nuance Guide:**\n\n" +
                    "Slang and idioms often carry subtle emotional tone that direct translations miss.\n" +
                    "• **Type any specific phrase** in the box above (e.g., *\"Explain no cap\"* or *\"What does 'catch up' mean?\"*) and I'll break down its tone, origin, and natural usage!";
        }

        // Cultural etiquette / tips
        if (qLower.contains("cultural") || qLower.contains("etiquette") || qLower.contains("culture") || qLower.contains("polite") || qLower.contains("tips")) {
            return "🌍 **Cross-Cultural Communication Tips:**\n\n" +
                    "1. **Start with a warm greeting:** In many cultures, a brief \"How are you doing today?\" before business or requests establishes mutual respect.\n" +
                    "2. **Mind the directness:** Some cultures appreciate concise, direct statements, while others value softer phrasing (e.g., *\"Could we perhaps explore...\"* instead of *\"We must...\"*).\n" +
                    "3. **Leverage GioChat tools:** Tap the 🌍 **Translate** button on any message to see both original and translated text side-by-side to verify nuances!";
        }

        // Translation assistance
        if (qLower.contains("translate") || qLower.contains("how to say") || qLower.contains("how do you say") || qLower.contains("spanish") || qLower.contains("french") || qLower.contains("german")) {
            return "🎓 **GioAI Translation & Practice:**\n\n" +
                    "• **Instant Chat Translation:** In any conversation, tap the 🌍 icon on a message to view it in your chosen language.\n" +
                    "• **Ask me anything:** You can ask me questions like: *\"How do I say 'Thank you for your hospitality' naturally in Spanish?\"* and I will give you both literal and idiomatic phrasing!";
        }

        if (context != null && !context.isBlank()) {
            return "Regarding *\"" + context + "\"*:\n\n" +
                    "Here is what I recommend for your question (*\"" + question + "\"*):\n\n" +
                    "Keep your message clear, friendly, and open-ended. You can easily tap **Insert into chat** below to adapt this into your active conversation!";
        }

        return "🤖 **GioAI Assistant:**\n\n" +
                "I am ready to help you communicate with ease! You can ask me to:\n" +
                "• Suggest quick friendly or professional replies\n" +
                "• Explain the meaning or tone of a phrase or slang\n" +
                "• Give polite cross-cultural conversation tips\n" +
                "• Translate expressions with natural pronunciation and tone";
    }
}
