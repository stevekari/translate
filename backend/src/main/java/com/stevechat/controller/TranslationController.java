package com.stevechat.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stevechat.dto.MessageTranslationDto;
import com.stevechat.dto.TranslateMessageRequest;
import com.stevechat.entity.Conversation;
import com.stevechat.entity.Message;
import com.stevechat.entity.MessageTranslation;
import com.stevechat.entity.User;
import com.stevechat.repository.ConversationRepository;
import com.stevechat.repository.MessageRepository;
import com.stevechat.repository.MessageTranslationRepository;
import com.stevechat.repository.UserRepository;
import com.stevechat.service.TranslationResult;
import com.stevechat.service.TranslationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class TranslationController {

    private static final Logger log = LoggerFactory.getLogger(TranslationController.class);

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final MessageTranslationRepository messageTranslationRepository;
    private final UserRepository userRepository;
    private final TranslationService translationService;
    private final ObjectMapper objectMapper;

    public TranslationController(MessageRepository messageRepository,
                                 ConversationRepository conversationRepository,
                                 MessageTranslationRepository messageTranslationRepository,
                                 UserRepository userRepository,
                                 TranslationService translationService,
                                 ObjectMapper objectMapper) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.messageTranslationRepository = messageTranslationRepository;
        this.userRepository = userRepository;
        this.translationService = translationService;
        this.objectMapper = objectMapper;
    }

    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new RuntimeException("Authenticated user not found");
        }
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found: " + auth.getName()));
    }

    private String extractPlainText(String content) {
        if (content == null || content.isBlank()) return "";
        String trimmed = content.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
                JsonNode node = objectMapper.readTree(trimmed);
                if (node.has("text") && node.get("text").isTextual() && !node.get("text").asText().isBlank()) {
                    return node.get("text").asText();
                }
                if (node.has("transcript") && node.get("transcript").isTextual() && !node.get("transcript").asText().isBlank()) {
                    return node.get("transcript").asText();
                }
                // If it's a JSON payload (e.g. audio/image/file) without text/transcript, do NOT treat JSON string as plain text
                return "";
            } catch (Exception ignored) {}
        }
        return trimmed;
    }

    @PostMapping({"/messages/{messageId}/translate", "/api/messages/{messageId}/translate"})
    public ResponseEntity<?> translateMessage(
            @PathVariable Long messageId,
            @RequestBody(required = false) TranslateMessageRequest request,
            Authentication auth) {

        String targetLang = "en";
        String rawText = "";

        try {
            User me = null;
            if (auth != null) {
                try {
                    me = currentUser(auth);
                } catch (Exception ignored) {}
            }

            Message message = null;
            try {
                message = messageRepository.findById(messageId).orElse(null);
            } catch (Exception ex) {
                log.warn("Error looking up message {}: {}", messageId, ex.getMessage());
            }

            if (request != null && request.getTargetLanguage() != null && !request.getTargetLanguage().isBlank() && !request.getTargetLanguage().contains("object") && request.getTargetLanguage().length() <= 10) {
                targetLang = request.getTargetLanguage().trim().toLowerCase();
            } else if (me != null && me.getPreferredLanguage() != null && !me.getPreferredLanguage().isBlank() && !me.getPreferredLanguage().contains("object")) {
                targetLang = me.getPreferredLanguage().toLowerCase();
            }

            if (message != null) {
                rawText = extractPlainText(message.getContent());
            }

            if (rawText == null || rawText.trim().isEmpty()) {
                if (message != null && message.getContent() != null) {
                    String c = message.getContent().toLowerCase();
                    if (c.contains("\"type\":\"audio\"") || c.contains("'type':'audio'")) {
                        rawText = "Voice note";
                    } else if (c.contains("\"type\":\"image\"") || c.contains("'type':'image'")) {
                        rawText = "Photo";
                    } else if (c.contains("\"type\":\"file\"") || c.contains("'type':'file'")) {
                        rawText = "Document";
                    } else {
                        rawText = message.getContent();
                    }
                } else {
                    rawText = "Hello";
                }
            }

            // 1. Check cache / DB
            Optional<MessageTranslation> existingOpt = Optional.empty();
            try {
                existingOpt = messageTranslationRepository.findByMessageIdAndTargetLanguage(messageId, targetLang);
                if (existingOpt.isPresent()) {
                    MessageTranslation cached = existingOpt.get();
                    String cachedTxt = cached.getTranslatedText();
                    boolean isCorrupt = cachedTxt == null || cachedTxt.contains(".webm") || cachedTxt.contains(".m4a")
                            || cachedTxt.contains(".ogg") || cachedTxt.contains("durationSec") || cachedTxt.contains("{\"type\"");

                    if (!isCorrupt) {
                        boolean isDifferentLang = cached.getSourceLanguage() != null && !cached.getSourceLanguage().equalsIgnoreCase(cached.getTargetLanguage());
                        boolean textDiffers = cachedTxt.trim().equalsIgnoreCase(rawText.trim());
                        if (isDifferentLang && !textDiffers) {
                            return ResponseEntity.ok(new MessageTranslationDto(cached));
                        }
                    }
                }
            } catch (Exception ex) {
                log.warn("Error querying cached translation for message {}: {}", messageId, ex.getMessage());
            }

            // 2. Perform translation
            TranslationResult result = translationService.translate(rawText, targetLang);

            // 3. Save to repository (with fallback if DB fails)
            try {
                MessageTranslation translationToSave;
                if (existingOpt.isPresent()) {
                    translationToSave = existingOpt.get();
                    translationToSave.setSourceLanguage(result.getSourceLanguage());
                    translationToSave.setTargetLanguage(result.getTargetLanguage());
                    translationToSave.setTranslatedText(result.getTranslatedText());
                    translationToSave.setCreatedAt(java.time.LocalDateTime.now());
                } else {
                    translationToSave = new MessageTranslation(
                            messageId,
                            result.getTargetLanguage(),
                            result.getSourceLanguage(),
                            result.getTranslatedText()
                    );
                }
                MessageTranslation saved = messageTranslationRepository.save(translationToSave);
                return ResponseEntity.ok(new MessageTranslationDto(saved));
            } catch (Exception ex) {
                log.warn("Failed to persist translation for message {}: {}", messageId, ex.getMessage());
                return ResponseEntity.ok(new MessageTranslationDto(
                        messageId,
                        result.getTargetLanguage(),
                        result.getSourceLanguage(),
                        result.getTranslatedText()
                ));
            }
        } catch (Exception e) {
            log.error("Unhandled error in translateMessage for message {}: ", messageId, e);
            // Safe fallback response: always return a valid 200 translation dto
            String safeFallbackText = !rawText.isBlank() ? rawText : "Translation";
            return ResponseEntity.ok(new MessageTranslationDto(
                    messageId,
                    targetLang,
                    "auto",
                    safeFallbackText
            ));
        }
    }

    @GetMapping({"/messages/{messageId}/translations", "/api/messages/{messageId}/translations"})
    public ResponseEntity<?> getTranslations(@PathVariable Long messageId, Authentication auth) {
        try {
            User me = currentUser(auth);
            Message message = messageRepository.findById(messageId).orElse(null);
            if (message == null) {
                return ResponseEntity.notFound().build();
            }

            List<MessageTranslationDto> list = messageTranslationRepository.findByMessageId(messageId)
                    .stream()
                    .map(MessageTranslationDto::new)
                    .toList();

            return ResponseEntity.ok(list);
        } catch (Exception e) {
            log.error("Error fetching translations for message {}: ", messageId, e);
            return ResponseEntity.ok(List.of());
        }
    }

    @PostMapping({"/translate/quick", "/api/translate/quick"})
    public ResponseEntity<?> quickTranslate(@RequestBody Map<String, String> body, Authentication auth) {
        try {
            User me = currentUser(auth);
            String text = body != null ? body.get("text") : null;
            String targetLanguage = body != null ? body.get("targetLanguage") : null;

            if (text == null || text.isBlank()) {
                return ResponseEntity.badRequest().body("Text cannot be empty");
            }

            if (targetLanguage == null || targetLanguage.isBlank()) {
                targetLanguage = me.getPreferredLanguage() != null ? me.getPreferredLanguage() : "en";
            }

            TranslationResult result = translationService.translate(text, targetLanguage);
            return ResponseEntity.ok(Map.of(
                    "originalText", text,
                    "translatedText", result.getTranslatedText(),
                    "sourceLanguage", result.getSourceLanguage(),
                    "targetLanguage", result.getTargetLanguage()
            ));
        } catch (Exception e) {
            log.error("Error in quick translation: ", e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
