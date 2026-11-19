package com.stevechat.dto;

public class AiAnswerResponse {
    private String answer;
    private String model;
    private boolean success;

    public AiAnswerResponse() {}

    public AiAnswerResponse(String answer, String model, boolean success) {
        this.answer = answer;
        this.model = model;
        this.success = success;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }
}
