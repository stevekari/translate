package com.stevechat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.junit.jupiter.api.Test;

public class TestTranslate {
    @Test
    void testTranslations() {
        ObjectMapper mapper = new ObjectMapper();
        DefaultTranslationService service = new DefaultTranslationService(mapper);
        
        System.out.println("--- Test 1: Spanish to English ---");
        TranslationResult r1 = service.translate("¿Cómo estás hoy?", "en");
        System.out.println("Src: " + r1.getSourceLanguage() + ", Target: " + r1.getTargetLanguage() + ", Text: " + r1.getTranslatedText());

        System.out.println("--- Test 2: English to Spanish ---");
        TranslationResult r2 = service.translate("I am doing very well, thank you!", "es");
        System.out.println("Src: " + r2.getSourceLanguage() + ", Target: " + r2.getTargetLanguage() + ", Text: " + r2.getTranslatedText());

        System.out.println("--- Test 3: English to French ---");
        TranslationResult r3 = service.translate("Where are we going tonight?", "fr");
        System.out.println("Src: " + r3.getSourceLanguage() + ", Target: " + r3.getTargetLanguage() + ", Text: " + r3.getTranslatedText());
    }
}
