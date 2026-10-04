package com.stevechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "message_translations", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"message_id", "target_language"})
})
public class MessageTranslation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "message_id", nullable = false)
    private Long messageId;

    @Column(name = "target_language", nullable = false, length = 20)
    private String targetLanguage;

    @Column(name = "source_language", length = 20)
    private String sourceLanguage;

    @Column(name = "translated_text", nullable = false, columnDefinition = "TEXT")
    private String translatedText;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public MessageTranslation() {}

    public MessageTranslation(Long messageId, String targetLanguage, String sourceLanguage, String translatedText) {
        this.messageId = messageId;
        this.targetLanguage = targetLanguage != null ? targetLanguage.toLowerCase() : "en";
        this.sourceLanguage = sourceLanguage != null ? sourceLanguage.toLowerCase() : "auto";
        this.translatedText = translatedText != null ? translatedText : "";
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
