package com.stevechat.controller;

import com.stevechat.dto.NewsArticleDto;
import com.stevechat.service.NewsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/news", "/news"})
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class NewsController {

    private final NewsService newsService;

    public NewsController(NewsService newsService) {
        this.newsService = newsService;
    }

    @GetMapping
    public ResponseEntity<List<NewsArticleDto>> getLiveNews(
            @RequestParam(required = false, defaultValue = "ALL") String country,
            @RequestParam(required = false, defaultValue = "all") String category,
            @RequestParam(required = false, defaultValue = "false") boolean forceRefresh) {
        List<NewsArticleDto> articles = newsService.getLiveNews(country, category, forceRefresh);
        return ResponseEntity.ok(articles);
    }
}
