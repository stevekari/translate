package com.stevechat.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Defense service against brute-force password guessing and automated hacker intrusions.
 * Locks accounts temporarily after 5 consecutive failed login attempts.
 */
@Service
public class LoginAttemptService {

    public static final int MAX_ATTEMPTS = 5;
    public static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private static class AttemptRecord {
        int attempts;
        Instant lockExpiration;
        Instant lastAttempt;

        AttemptRecord(int attempts, Instant lastAttempt) {
            this.attempts = attempts;
            this.lastAttempt = lastAttempt;
        }
    }

    private final Map<String, AttemptRecord> attemptsCache = new ConcurrentHashMap<>();

    private String normalize(String username) {
        return username == null ? "" : username.trim().toLowerCase();
    }

    public boolean isBlocked(String username) {
        String key = normalize(username);
        AttemptRecord record = attemptsCache.get(key);
        if (record == null) {
            return false;
        }

        if (record.lockExpiration != null) {
            if (Instant.now().isBefore(record.lockExpiration)) {
                return true;
            } else {
                // Lock has expired
                attemptsCache.remove(key);
                return false;
            }
        }
        return false;
    }

    public long getRemainingLockMinutes(String username) {
        String key = normalize(username);
        AttemptRecord record = attemptsCache.get(key);
        if (record != null && record.lockExpiration != null) {
            long seconds = Duration.between(Instant.now(), record.lockExpiration).getSeconds();
            return Math.max(1, (seconds + 59) / 60);
        }
        return 0;
    }

    public int getRemainingAttempts(String username) {
        String key = normalize(username);
        AttemptRecord record = attemptsCache.get(key);
        if (record == null) {
            return MAX_ATTEMPTS;
        }
        return Math.max(0, MAX_ATTEMPTS - record.attempts);
    }

    public void loginFailed(String username) {
        String key = normalize(username);
        if (key.isBlank()) return;

        attemptsCache.compute(key, (k, existing) -> {
            Instant now = Instant.now();
            if (existing == null) {
                return new AttemptRecord(1, now);
            }

            // If lock expired, restart counter
            if (existing.lockExpiration != null && now.isAfter(existing.lockExpiration)) {
                return new AttemptRecord(1, now);
            }

            existing.attempts++;
            existing.lastAttempt = now;

            if (existing.attempts >= MAX_ATTEMPTS) {
                existing.lockExpiration = now.plus(LOCK_DURATION);
            }
            return existing;
        });
    }

    public void loginSucceeded(String username) {
        String key = normalize(username);
        attemptsCache.remove(key);
    }
}

