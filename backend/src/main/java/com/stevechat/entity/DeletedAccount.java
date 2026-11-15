package com.stevechat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "deleted_accounts")
public class DeletedAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    private String username;

    private String displayName;

    @Column(length = 1000)
    private String reason;

    private LocalDateTime deletedAt = LocalDateTime.now();

    private Integer deletionCount = 1;

    private LocalDateTime lastReRegisteredAt;

    private Integer reRegistrationCount = 0;

    public DeletedAccount() {}

    public DeletedAccount(String email, String username, String displayName, String reason) {
        this.email = email != null ? email.trim().toLowerCase() : "";
        this.username = username;
        this.displayName = displayName;
        this.reason = reason;
        this.deletedAt = LocalDateTime.now();
        this.deletionCount = 1;
        this.reRegistrationCount = 0;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email != null ? email.trim().toLowerCase() : null; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

    public Integer getDeletionCount() { return deletionCount; }
    public void setDeletionCount(Integer deletionCount) { this.deletionCount = deletionCount; }

    public LocalDateTime getLastReRegisteredAt() { return lastReRegisteredAt; }
    public void setLastReRegisteredAt(LocalDateTime lastReRegisteredAt) { this.lastReRegisteredAt = lastReRegisteredAt; }

    public Integer getReRegistrationCount() { return reRegistrationCount; }
    public void setReRegistrationCount(Integer reRegistrationCount) { this.reRegistrationCount = reRegistrationCount; }
}
