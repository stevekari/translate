package com.stevechat.dto;

import java.time.LocalDateTime;
import java.util.Set;

public class PostDto {
    private Long id;
    private Long userId;
    private String username;
    private String displayName;
    private String avatarUrl;
    private String content;
    private String mediaUrl;
    private String mediaType;
    private String language;
    private int likeCount;
    private boolean likedByMe;
    private Set<Long> likedUserIds;
    private int commentsCount;
    private LocalDateTime createdAt;

    public PostDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }

    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public int getLikeCount() { return likeCount; }
    public void setLikeCount(int likeCount) { this.likeCount = likeCount; }

    public boolean isLikedByMe() { return likedByMe; }
    public void setLikedByMe(boolean likedByMe) { this.likedByMe = likedByMe; }

    public Set<Long> getLikedUserIds() { return likedUserIds; }
    public void setLikedUserIds(Set<Long> likedUserIds) { this.likedUserIds = likedUserIds; }

    public int getCommentsCount() { return commentsCount; }
    public void setCommentsCount(int commentsCount) { this.commentsCount = commentsCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
