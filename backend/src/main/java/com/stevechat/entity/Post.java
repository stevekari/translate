package com.stevechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 4000, nullable = false)
    private String content;

    @Column(length = 2048)
    private String mediaUrl;

    @Column(length = 50)
    private String mediaType; // "text", "image", "video", "polo"

    @Column(length = 20)
    private String language = "en";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "post_likes", joinColumns = @JoinColumn(name = "post_id"))
    @Column(name = "user_id")
    private Set<Long> likedUserIds = new HashSet<>();

    private int commentsCount = 0;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Post() {}

    public Post(User user, String content, String mediaUrl, String mediaType, String language) {
        this.user = user;
        this.content = content;
        this.mediaUrl = mediaUrl;
        this.mediaType = mediaType != null ? mediaType : "text";
        this.language = language != null ? language : "en";
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }

    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public Set<Long> getLikedUserIds() { return likedUserIds; }
    public void setLikedUserIds(Set<Long> likedUserIds) { this.likedUserIds = likedUserIds; }

    public int getLikeCount() { return likedUserIds != null ? likedUserIds.size() : 0; }

    public int getCommentsCount() { return commentsCount; }
    public void setCommentsCount(int commentsCount) { this.commentsCount = commentsCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
