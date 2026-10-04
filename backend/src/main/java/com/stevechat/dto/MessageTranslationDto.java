package com.stevechat.dto;

import com.stevechat.entity.MessageTranslation;
import java.time.LocalDateTime;

public class MessageTranslationDto {
    private Long id;
    private Long messageId;
    private String targetLanguage;
    private String sourceLanguage;
    private String translatedText;
    private LocalDateTime createdAt;

    public MessageTranslationDto() {}

    public MessageTranslationDto(MessageTranslation entity) {
        if (entity != null) {
            this.id = entity.getId();
            this.messageId = entity.getMessageId();
            this.targetLanguage = entity.getTargetLanguage();
            this.sourceLanguage = entity.getSourceLanguage();
            this.translatedText = entity.getTranslatedText();
            this.createdAt = entity.getCreatedAt();
        }
    }

    public MessageTranslationDto(Long messageId, String targetLanguage, String sourceLanguage, String translatedText) {
        this.messageId = messageId;
        this.targetLanguage = targetLanguage;
        this.sourceLanguage = sourceLanguage;
        this.translatedText = translatedText;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }

    public String getTargetLanguage() { return targetLanguage; }
    public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }

    public String getSourceLanguage() { return sourceLanguage; }
    public void setSourceLanguage(String sourceLanguage) { this.sourceLanguage = sourceLanguage; }

    public String getTranslatedText() { return translatedText; }
    public void setTranslatedText(String translatedText) { this.translatedText = translatedText; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
