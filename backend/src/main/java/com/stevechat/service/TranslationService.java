package com.stevechat.service;

public interface TranslationService {
    TranslationResult translate(String text, String targetLanguage, String sourceLanguage);
    TranslationResult translate(String text, String targetLanguage);
}
