package com.stevechat.dto;

import com.stevechat.entity.MessageReaction;

public class ReactionDto {
    private Long id;
    private Long messageId;
    private Long userId;
    private String username;
    private String emoji;

    public ReactionDto() {}

    public ReactionDto(MessageReaction reaction) {
        if (reaction != null) {
            this.id = reaction.getId();
            this.messageId = reaction.getMessageId();
            this.userId = reaction.getUserId();
            this.username = reaction.getUsername();
            this.emoji = reaction.getEmoji();
        }
    }

    public ReactionDto(Long id, Long messageId, Long userId, String username, String emoji) {
        this.id = id;
        this.messageId = messageId;
        this.userId = userId;
        this.username = username;
        this.emoji = emoji;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
}
