package com.stevechat.controller;

import com.stevechat.dto.AiAnswerResponse;
import com.stevechat.dto.AiQuestionRequest;
import com.stevechat.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/ai", "/ai"})
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/ask")
    public ResponseEntity<AiAnswerResponse> askAi(@RequestBody AiQuestionRequest request) {
        if (request == null || request.getQuestion() == null || request.getQuestion().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new AiAnswerResponse("Question cannot be empty", "GioAI", false));
        }

        AiAnswerResponse response = aiService.ask(request.getQuestion(), request.getContext(), request.getLanguage());
        return ResponseEntity.ok(response);
    }
}
