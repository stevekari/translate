package com.stevechat.dto;

public class AiQuestionRequest {
    private String question;
    private String context;
    private String language;

    public AiQuestionRequest() {}

    public AiQuestionRequest(String question, String context, String language) {
        this.question = question;
        this.context = context;
        this.language = language;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }
}
