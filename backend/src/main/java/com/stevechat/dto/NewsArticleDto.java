package com.stevechat.dto;

public class NewsArticleDto {
    private String id;
    private String title;
    private String summary;
    private String url;
    private String source;
    private String handle;
    private String sourceLogo;
    private String category;
    private String country;
    private String pubDate;
    private String timeAgo;
    private String imageUrl;
    private int likes;
    private int reposts;

    public NewsArticleDto() {}

    public NewsArticleDto(String id, String title, String summary, String url, String source,
                          String handle, String sourceLogo, String category, String country,
                          String pubDate, String timeAgo, String imageUrl, int likes, int reposts) {
        this.id = id;
        this.title = title;
        this.summary = summary;
        this.url = url;
        this.source = source;
        this.handle = handle;
        this.sourceLogo = sourceLogo;
        this.category = category;
        this.country = country;
        this.pubDate = pubDate;
        this.timeAgo = timeAgo;
        this.imageUrl = imageUrl;
        this.likes = likes;
        this.reposts = reposts;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getHandle() { return handle; }
    public void setHandle(String handle) { this.handle = handle; }

    public String getSourceLogo() { return sourceLogo; }
    public void setSourceLogo(String sourceLogo) { this.sourceLogo = sourceLogo; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getPubDate() { return pubDate; }
    public void setPubDate(String pubDate) { this.pubDate = pubDate; }

    public String getTimeAgo() { return timeAgo; }
    public void setTimeAgo(String timeAgo) { this.timeAgo = timeAgo; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public int getLikes() { return likes; }
    public void setLikes(int likes) { this.likes = likes; }

    public int getReposts() { return reposts; }
    public void setReposts(int reposts) { this.reposts = reposts; }
}
