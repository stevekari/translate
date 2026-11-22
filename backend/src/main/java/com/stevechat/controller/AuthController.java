package com.stevechat.controller;

import com.stevechat.dto.AuthRequest;
import com.stevechat.dto.AuthResponse;
import com.stevechat.dto.GoogleAuthRequest;
import com.stevechat.dto.RegisterRequest;
import com.stevechat.entity.DeletedAccount;
import com.stevechat.entity.User;
import com.stevechat.repository.DeletedAccountRepository;
import com.stevechat.repository.UserRepository;
import com.stevechat.security.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/auth", "/api/auth", "/api"})
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final com.stevechat.security.PasswordValidator passwordValidator;
    private final com.stevechat.security.LoginAttemptService loginAttemptService;
    private final DeletedAccountRepository deletedAccountRepository;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtUtil jwtUtil,
                          com.stevechat.security.PasswordValidator passwordValidator,
                          com.stevechat.security.LoginAttemptService loginAttemptService,
                          DeletedAccountRepository deletedAccountRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.passwordValidator = passwordValidator;
        this.loginAttemptService = loginAttemptService;
        this.deletedAccountRepository = deletedAccountRepository;
    }

    @GetMapping({"/health", "/status"})
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(status);
    }

    @GetMapping({"/check-deleted", "/status/check-deleted"})
    public ResponseEntity<?> checkDeleted(@RequestParam(required = false) String email,
                                          @RequestParam(required = false) String username) {
        String cleanEmail = email != null ? email.trim().toLowerCase() : null;
        String cleanUsername = username != null ? username.trim() : null;

        java.util.Optional<DeletedAccount> match = java.util.Optional.empty();
        if (cleanEmail != null && !cleanEmail.isBlank()) {
            match = deletedAccountRepository.findTopByEmailOrderByDeletedAtDesc(cleanEmail);
        }
        if (match.isEmpty() && cleanUsername != null && !cleanUsername.isBlank()) {
            match = deletedAccountRepository.findTopByUsernameOrderByDeletedAtDesc(cleanUsername);
        }

        if (match.isPresent()) {
            DeletedAccount da = match.get();
            Map<String, Object> resp = new HashMap<>();
            resp.put("previouslyDeleted", true);
            resp.put("email", da.getEmail());
            resp.put("username", da.getUsername());
            resp.put("deletedAt", da.getDeletedAt() != null ? da.getDeletedAt().toString() : null);
            resp.put("message", "Welcome back! An account with this email/username was previously deleted on "
                    + (da.getDeletedAt() != null ? da.getDeletedAt().toLocalDate().toString() : "a previous date")
                    + ". You can re-register anytime with a fresh account.");
            return ResponseEntity.ok(resp);
        }

        return ResponseEntity.ok(Map.of("previouslyDeleted", false));
    }

    @PostMapping({"/register", "/auth/register"})
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (request.getUsername() == null || request.getUsername().trim().isBlank()) {
            return ResponseEntity.badRequest().body("Username cannot be empty");
        }
        if (request.getEmail() == null || request.getEmail().trim().isBlank()) {
            return ResponseEntity.badRequest().body("Email cannot be empty");
        }
        if (userRepository.existsByUsername(request.getUsername().trim())) {
            return ResponseEntity.badRequest().body("Username is already taken");
        }
        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            return ResponseEntity.badRequest().body("Email is already registered");
        }

        try {
            passwordValidator.validate(request.getPassword(), request.getUsername().trim(), request.getEmail().trim());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }

        String email = request.getEmail().trim().toLowerCase();
        String username = request.getUsername().trim();

        // Detect if person previously had an account that was deleted
        java.util.Optional<DeletedAccount> previouslyDeletedOpt = deletedAccountRepository.findTopByEmailOrderByDeletedAtDesc(email);
        if (previouslyDeletedOpt.isEmpty()) {
            previouslyDeletedOpt = deletedAccountRepository.findTopByUsernameOrderByDeletedAtDesc(username);
        }

        boolean wasDeleted = previouslyDeletedOpt.isPresent();
        String welcomeBackMsg = null;
        String deletedAtStr = null;

        if (wasDeleted) {
            DeletedAccount da = previouslyDeletedOpt.get();
            da.setLastReRegisteredAt(LocalDateTime.now());
            da.setReRegistrationCount(da.getReRegistrationCount() != null ? da.getReRegistrationCount() + 1 : 1);
            deletedAccountRepository.save(da);
            deletedAtStr = da.getDeletedAt() != null ? da.getDeletedAt().toString() : null;
            welcomeBackMsg = "Welcome back to Giochat! We detected you previously had an account with us that was deleted. We are glad to have you back!";
            System.out.println("[RE-REGISTER DETECTED] Person with email " + email + " (username @" + username
                    + ") previously deleted account on " + deletedAtStr + " and has now re-registered!");
        }

        User user = new User(
                username,
                email,
                passwordEncoder.encode(request.getPassword())
        );
        String displayName = request.getDisplayName() != null && !request.getDisplayName().trim().isBlank()
                ? request.getDisplayName().trim()
                : username;
        user.setDisplayName(displayName);
        user.setAutoTranslate(true);
        user.setPreviouslyDeleted(wasDeleted);
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getUsername());
        AuthResponse authResponse = new AuthResponse(token, user.getId(), user.getUsername(), user.getAvatarUrl(), user.getEmail(), user.getAuthProvider());
        authResponse.setDisplayName(user.getDisplayName());
        authResponse.setPreviouslyDeleted(wasDeleted);
        authResponse.setWelcomeBackMessage(welcomeBackMsg);
        authResponse.setPreviousDeletedAt(deletedAtStr);
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping({"/login", "/auth/login"})
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        String username = request.getUsername() != null ? request.getUsername().trim() : "";

        if (loginAttemptService.isBlocked(username)) {
            long remainingMinutes = loginAttemptService.getRemainingLockMinutes(username);
            return ResponseEntity.status(429).body(
                    "Security Lockout: Account temporarily locked due to multiple failed login attempts. Try again in "
                            + remainingMinutes + " minute" + (remainingMinutes == 1 ? "" : "s") + " to protect against unauthorized access."
            );
        }

        User user = userRepository.findByUsername(username).orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            loginAttemptService.loginFailed(username);
            if (loginAttemptService.isBlocked(username)) {
                long remainingMinutes = loginAttemptService.getRemainingLockMinutes(username);
                return ResponseEntity.status(429).body(
                        "Security Lockout Activated: 5 consecutive failed login attempts reached. Account locked for "
                                + remainingMinutes + " minutes to block hacker intrusions."
                );
            }
            int remaining = loginAttemptService.getRemainingAttempts(username);
            return ResponseEntity.status(401).body(
                    "Invalid username or password. " + remaining + " attempt" + (remaining == 1 ? "" : "s")
                            + " remaining before account security lockout."
            );
        }

        // Reset failed login attempts on successful authentication
        loginAttemptService.loginSucceeded(username);

        user.setLastSeen(LocalDateTime.now());
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getUsername());
        AuthResponse authResponse = new AuthResponse(token, user.getId(), user.getUsername(), user.getAvatarUrl(), user.getEmail(), user.getAuthProvider());
        authResponse.setDisplayName(user.getDisplayName());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping({"/google", "/auth/google", "/login/google"})
    public ResponseEntity<?> googleAuth(@RequestBody GoogleAuthRequest request) {
        if (request.getEmail() == null || request.getEmail().trim().isBlank()) {
            return ResponseEntity.badRequest().body("Email is required for Google authentication");
        }

        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(email).orElse(null);

        boolean wasDeleted = false;
        String welcomeBackMsg = null;
        String deletedAtStr = null;

        if (user == null) {
            // Check if this Google user previously had an account and deleted it
            java.util.Optional<DeletedAccount> previouslyDeletedOpt = deletedAccountRepository.findTopByEmailOrderByDeletedAtDesc(email);
            if (previouslyDeletedOpt.isPresent()) {
                wasDeleted = true;
                DeletedAccount da = previouslyDeletedOpt.get();
                da.setLastReRegisteredAt(LocalDateTime.now());
                da.setReRegistrationCount(da.getReRegistrationCount() != null ? da.getReRegistrationCount() + 1 : 1);
                deletedAccountRepository.save(da);
                deletedAtStr = da.getDeletedAt() != null ? da.getDeletedAt().toString() : null;
                welcomeBackMsg = "Welcome back to Giochat! We detected you previously had an account with us that was deleted. We are glad to have you back!";
                System.out.println("[RE-REGISTER DETECTED Google] Person with email " + email
                        + " previously deleted account on " + deletedAtStr + " and has now re-registered!");
            }

            // Generate clean unique username based on display name or email prefix
            String baseUsername = (request.getDisplayName() != null && !request.getDisplayName().trim().isBlank())
                    ? request.getDisplayName().trim().replaceAll("[^a-zA-Z0-9_]", "").toLowerCase()
                    : email.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "").toLowerCase();

            if (baseUsername.isBlank()) {
                baseUsername = "user";
            }

            String candidateUsername = baseUsername;
            int counter = 1;
            while (userRepository.existsByUsername(candidateUsername)) {
                candidateUsername = baseUsername + counter;
                counter++;
            }

            user = new User(
                    candidateUsername,
                    email,
                    passwordEncoder.encode(UUID.randomUUID().toString())
            );

            String photoUrl = request.getPhotoUrl() != null ? request.getPhotoUrl().trim() : null;
            if (photoUrl != null && photoUrl.length() > 2000) {
                photoUrl = photoUrl.substring(0, 2000);
            }

            if (request.getDisplayName() != null && !request.getDisplayName().trim().isBlank()) {
                user.setDisplayName(request.getDisplayName().trim());
            }
            if (photoUrl != null && !photoUrl.isBlank()) {
                user.setAvatarUrl(photoUrl);
            }

            user.setAutoTranslate(true);
            user.setPreviouslyDeleted(wasDeleted);
            user.setAuthProvider("google");
            user = userRepository.save(user);
        } else {
            String photoUrl = request.getPhotoUrl() != null ? request.getPhotoUrl().trim() : null;
            if (photoUrl != null && photoUrl.length() > 2000) {
                photoUrl = photoUrl.substring(0, 2000);
            }

            boolean updated = false;
            if (!"google".equalsIgnoreCase(user.getAuthProvider())) {
                user.setAuthProvider("google");
                updated = true;
            }
            if ((user.getAvatarUrl() == null || user.getAvatarUrl().isBlank()) && photoUrl != null && !photoUrl.isBlank()) {
                user.setAvatarUrl(photoUrl);
                updated = true;
            }
            if ((user.getDisplayName() == null || user.getDisplayName().isBlank()) && request.getDisplayName() != null && !request.getDisplayName().isBlank()) {
                user.setDisplayName(request.getDisplayName().trim());
                updated = true;
            }
            user.setLastSeen(LocalDateTime.now());
            user = userRepository.save(user);
        }

        String token = jwtUtil.generateToken(user.getUsername());
        AuthResponse authResponse = new AuthResponse(token, user.getId(), user.getUsername(), user.getAvatarUrl(), user.getEmail(), "google");
        authResponse.setDisplayName(user.getDisplayName());
        authResponse.setPreviouslyDeleted(wasDeleted);
        authResponse.setWelcomeBackMessage(welcomeBackMsg);
        authResponse.setPreviousDeletedAt(deletedAtStr);
        return ResponseEntity.ok(authResponse);
    }
}
