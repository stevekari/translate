package com.stevechat.dto;

public class TranslateMessageRequest {
    private String targetLanguage;

    public TranslateMessageRequest() {}

    public TranslateMessageRequest(String targetLanguage) {
        this.targetLanguage = targetLanguage;
    }

    public String getTargetLanguage() { return targetLanguage; }
    public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }
}
