package com.stevechat.dto;

public class AuthResponse {
    private String token;
    private Long userId;
    private String username;
    private String avatarUrl;
    private String email;
    private String authProvider;
    private String displayName;
    private Boolean previouslyDeleted = false;
    private String welcomeBackMessage;
    private String previousDeletedAt;

    public AuthResponse(String token, Long userId, String username, String avatarUrl) {
        this.token = token;
        this.userId = userId;
        this.username = username;
        this.avatarUrl = avatarUrl;
    }

    public AuthResponse(String token, Long userId, String username, String avatarUrl, String email, String authProvider) {
        this.token = token;
        this.userId = userId;
        this.username = username;
        this.avatarUrl = avatarUrl;
        this.email = email;
        this.authProvider = authProvider;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAuthProvider() { return authProvider; }
    public void setAuthProvider(String authProvider) { this.authProvider = authProvider; }

    public Boolean getPreviouslyDeleted() { return previouslyDeleted != null ? previouslyDeleted : false; }
    public void setPreviouslyDeleted(Boolean previouslyDeleted) { this.previouslyDeleted = previouslyDeleted; }

    public String getWelcomeBackMessage() { return welcomeBackMessage; }
    public void setWelcomeBackMessage(String welcomeBackMessage) { this.welcomeBackMessage = welcomeBackMessage; }

    public String getPreviousDeletedAt() { return previousDeletedAt; }
    public void setPreviousDeletedAt(String previousDeletedAt) { this.previousDeletedAt = previousDeletedAt; }
}
