package com.stevechat.dto;

public class UpdateProfileRequest {
    private String username;
    private String displayName;
    private String avatarUrl;
    private String bio;
    private String customStatus;
    private String preferredLanguage;
    private Boolean autoTranslate;
    private String currentPassword;
    private String newPassword;

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getCustomStatus() { return customStatus; }
    public void setCustomStatus(String customStatus) { this.customStatus = customStatus; }

    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }

    public Boolean getAutoTranslate() { return autoTranslate; }
    public void setAutoTranslate(Boolean autoTranslate) { this.autoTranslate = autoTranslate; }

    public String getCurrentPassword() { return currentPassword; }
    public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }

    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
