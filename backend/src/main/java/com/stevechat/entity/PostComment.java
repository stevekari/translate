package com.stevechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "post_comments")
public class PostComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 1000, nullable = false)
    private String content;

    private Long parentCommentId;

    @Column(length = 100)
    private String replyToUsername;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "comment_likes", joinColumns = @JoinColumn(name = "comment_id"))
    @Column(name = "user_id")
    private Set<Long> likedUserIds = new HashSet<>();

    private LocalDateTime createdAt = LocalDateTime.now();

    public PostComment() {}

    public PostComment(Post post, User user, String content) {
        this.post = post;
        this.user = user;
        this.content = content;
        this.createdAt = LocalDateTime.now();
    }

    public PostComment(Post post, User user, String content, Long parentCommentId, String replyToUsername) {
        this.post = post;
        this.user = user;
        this.content = content;
        this.parentCommentId = parentCommentId;
        this.replyToUsername = replyToUsername;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Long getParentCommentId() { return parentCommentId; }
    public void setParentCommentId(Long parentCommentId) { this.parentCommentId = parentCommentId; }

    public String getReplyToUsername() { return replyToUsername; }
    public void setReplyToUsername(String replyToUsername) { this.replyToUsername = replyToUsername; }

    public Set<Long> getLikedUserIds() { return likedUserIds; }
    public void setLikedUserIds(Set<Long> likedUserIds) { this.likedUserIds = likedUserIds; }

    public int getLikeCount() { return likedUserIds != null ? likedUserIds.size() : 0; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
