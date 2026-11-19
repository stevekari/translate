package com.stevechat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.stevechat.dto.AiAnswerResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public AiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public AiAnswerResponse ask(String question, String context, String language) {
        if (question == null || question.trim().isEmpty()) {
            return new AiAnswerResponse("Please ask a question to receive AI assistance.", "GioAI", true);
        }

        String targetLang = (language == null || language.isBlank()) ? "en" : language.trim().toLowerCase(Locale.ROOT);
        String trimmedQuestion = question.trim();
        String contextSnippet = (context != null && !context.isBlank()) ? context.trim() : null;

        // 1. Check for Gemini API Key
        String geminiApiKey = System.getenv("GEMINI_API_KEY");
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            geminiApiKey = System.getProperty("gemini.api.key");
        }

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

        // 2. Check for OpenAI API Key
        String openAiApiKey = System.getenv("OPENAI_API_KEY");
        if (openAiApiKey == null || openAiApiKey.isBlank()) {
            openAiApiKey = System.getProperty("openai.api.key");
        }

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

        // 3. Try Pollinations Free AI Engine
        try {
            AiAnswerResponse resp = callPollinations(trimmedQuestion, contextSnippet, targetLang);
            if (resp != null && resp.isSuccess() && resp.getAnswer() != null && !resp.getAnswer().isBlank()) {
                return resp;
            }
        } catch (Exception e) {
            log.warn("Pollinations AI call failed: {}", e.getMessage());
        }

        // 4. Fallback to Built-in Contextual Smart Assistant
        String fallbackAnswer = generateBuiltInAnswer(trimmedQuestion, contextSnippet, targetLang);
        return new AiAnswerResponse(fallbackAnswer, "GioAI Built-in Assistant", true);
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
                .timeout(Duration.ofSeconds(12))
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
        sb.append("You are GioAI, an assistant embedded inside GioChat (a global multilingual chat platform).\n");
        sb.append("Respond naturally, warmly, and concisely in language code '").append(language).append("'.\n\n");
        if (context != null && !context.isBlank()) {
            sb.append("Current conversation context with friend:\n\"").append(context).append("\"\n\n");
        }
        sb.append("User's Question / Prompt:\n").append(question);
        return sb.toString();
    }

    private String generateBuiltInAnswer(String question, String context, String language) {
        String qLower = question.toLowerCase(Locale.ROOT);

        if (qLower.contains("reply") || qLower.contains("respond") || qLower.contains("answer")) {
            if (context != null && !context.isBlank()) {
                return "Here are 3 friendly ways to reply to \"" + context + "\":\n\n" +
                        "1. Friendly & casual: \"Thanks for letting me know! Sounds good.\"\n" +
                        "2. Enthusiastic: \"That's awesome! Looking forward to it 😊\"\n" +
                        "3. Polite: \"Understood, thank you! Let me know if you need anything else.\"";
            }
            return "Here are quick reply suggestions:\n" +
                    "• \"Thanks! Talk to you soon.\"\n" +
                    "• \"Sounds great, let's catch up later!\"\n" +
                    "• \"Got it, thank you for sharing!\"";
        }

        if (qLower.contains("explain") || qLower.contains("mean") || qLower.contains("meaning")) {
            if (context != null && !context.isBlank()) {
                return "Explanation for: \"" + context + "\"\n\n" +
                        "This phrase is commonly used in casual conversation to share updates or express feelings. " +
                        "It has a friendly and approachable tone.";
            }
            return "GioAI Linguistic Tip: In cross-cultural chat, keeping messages warm and adding emojis helps prevent misunderstandings across languages!";
        }

        if (qLower.contains("translate") || qLower.contains("how to say") || qLower.contains("how do you say")) {
            return "GioAI Translation Tip:\n" +
                    "You can tap the 🌍 Translate button directly on any chat message to translate into your preferred language instantly!";
        }

        if (context != null && !context.isBlank()) {
            return "Regarding \"" + context + "\":\n\n" +
                    "Based on your conversation, here is some insight: " + question + "\n" +
                    "Tip: You can use GioAI to draft replies, clarify expressions, or practice pronunciation with your chat partner!";
        }

        return "GioAI Assistant: I am here to help you communicate smoothly with your friends! " +
                "You can ask me to draft replies, explain what someone meant, or ask general questions.";
    }
}
