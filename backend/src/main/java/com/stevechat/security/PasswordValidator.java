package com.stevechat.security;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Validates password strength to protect user accounts from unauthorized brute-force and dictionary attacks.
 */
@Component
public class PasswordValidator {

    private static final int MIN_LENGTH = 8;
    private static final int MAX_LENGTH = 128;

    private static final Pattern UPPERCASE_PATTERN = Pattern.compile("[A-Z]");
    private static final Pattern LOWERCASE_PATTERN = Pattern.compile("[a-z]");
    private static final Pattern DIGIT_PATTERN = Pattern.compile("[0-9]");
    private static final Pattern SPECIAL_PATTERN = Pattern.compile("[!@#$%^&*()_+\\-=\\[\\]{}|;:,.<>?/~`]");

    private static final Set<String> COMMON_PASSWORDS = Set.of(
            "password", "password123", "12345678", "123456789", "qwerty123",
            "admin123", "welcome123", "abc12345", "changeme", "iloveyou"
    );

    public void validate(String password, String username) {
        validate(password, username, null);
    }

    public void validate(String password, String username, String email) {
        if (password == null || password.trim().isEmpty()) {
            throw new IllegalArgumentException("Password cannot be empty.");
        }

        List<String> missing = new ArrayList<>();

        if (password.length() < MIN_LENGTH) {
            missing.add("at least 8 characters");
        }
        if (password.length() > MAX_LENGTH) {
            missing.add("at most 128 characters");
        }
        if (!UPPERCASE_PATTERN.matcher(password).find()) {
            missing.add("an uppercase letter (A-Z)");
        }
        if (!LOWERCASE_PATTERN.matcher(password).find()) {
            missing.add("a lowercase letter (a-z)");
        }
        if (!DIGIT_PATTERN.matcher(password).find()) {
            missing.add("a number (0-9)");
        }
        if (!SPECIAL_PATTERN.matcher(password).find()) {
            missing.add("a special character (!@#$%^&*)");
        }

        if (username != null && !username.isBlank()) {
            String cleanUser = username.trim().toLowerCase();
            if (cleanUser.length() >= 3 && password.toLowerCase().contains(cleanUser)) {
                missing.add("must not contain your username");
            }
        }

        if (email != null && !email.isBlank()) {
            String cleanEmail = email.trim().toLowerCase();
            String prefix = cleanEmail.contains("@") ? cleanEmail.split("@")[0] : cleanEmail;
            if (cleanEmail.length() >= 4 && password.toLowerCase().contains(cleanEmail)) {
                missing.add("must not contain your email address");
            } else if (prefix.length() >= 3 && password.toLowerCase().contains(prefix)) {
                missing.add("must not contain your email name/prefix");
            }
        }

        if (COMMON_PASSWORDS.contains(password.toLowerCase().trim())) {
            missing.add("must not be a commonly guessed password");
        }

        if (!missing.isEmpty()) {
            throw new IllegalArgumentException(
                    "Password must be stronger for security: Requires " + String.join(", ", missing) + "."
            );
        }
    }
}

