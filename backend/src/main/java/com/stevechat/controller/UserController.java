package com.stevechat.controller;

import com.stevechat.config.WebSocketEventListener;
import com.stevechat.dto.UpdateProfileRequest;
import com.stevechat.dto.UserDto;
import com.stevechat.entity.BlockedUser;
import com.stevechat.entity.Conversation;
import com.stevechat.entity.DeletedAccount;
import com.stevechat.entity.Message;
import com.stevechat.entity.Post;
import com.stevechat.entity.PostComment;
import com.stevechat.entity.User;
import com.stevechat.repository.BlockedUserRepository;
import com.stevechat.repository.ConversationRepository;
import com.stevechat.repository.DeletedAccountRepository;
import com.stevechat.repository.MessageReactionRepository;
import com.stevechat.repository.MessageRepository;
import com.stevechat.repository.MessageTranslationRepository;
import com.stevechat.repository.PostCommentRepository;
import com.stevechat.repository.PostRepository;
import com.stevechat.repository.UserRepository;
import com.stevechat.security.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/users", "/api/users"})
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PostRepository postRepository;
    private final PostCommentRepository postCommentRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MessageReactionRepository messageReactionRepository;
    private final MessageTranslationRepository messageTranslationRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final DeletedAccountRepository deletedAccountRepository;
    private final com.stevechat.security.PasswordValidator passwordValidator;
    private final JwtUtil jwtUtil;

    public UserController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          PostRepository postRepository,
                          PostCommentRepository postCommentRepository,
                          ConversationRepository conversationRepository,
                          MessageRepository messageRepository,
                          MessageReactionRepository messageReactionRepository,
                          MessageTranslationRepository messageTranslationRepository,
                          BlockedUserRepository blockedUserRepository,
                          DeletedAccountRepository deletedAccountRepository,
                          com.stevechat.security.PasswordValidator passwordValidator,
                          JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.postRepository = postRepository;
        this.postCommentRepository = postCommentRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.messageReactionRepository = messageReactionRepository;
        this.messageTranslationRepository = messageTranslationRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.deletedAccountRepository = deletedAccountRepository;
        this.passwordValidator = passwordValidator;
        this.jwtUtil = jwtUtil;
    }

    private User currentUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    @GetMapping("/all")
    public List<UserDto> getAllExceptSelf(Authentication auth) {
        User me = currentUser(auth);
        return userRepository.findByIdNot(me.getId())
                .stream()
                .map(UserDto::new)
                .toList();
    }

    @GetMapping("/search")
    public List<UserDto> searchByUsername(@RequestParam String query, Authentication auth) {
        User me = currentUser(auth);
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.startsWith("@")) {
            trimmed = trimmed.substring(1).trim();
        }
        if (trimmed.isEmpty()) {
            return List.of();
        }
        return userRepository.searchUsers(me.getId(), trimmed)
                .stream()
                .map(UserDto::new)
                .limit(30)
                .toList();
    }

    @PostMapping("/block/{id}")
    public ResponseEntity<?> blockUser(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        if (me.getId().equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("error", "You cannot block yourself"));
        }
        userRepository.findById(id).orElseThrow(() -> new RuntimeException("User to block not found"));
        if (!blockedUserRepository.existsByBlockerIdAndBlockedId(me.getId(), id)) {
            blockedUserRepository.save(new BlockedUser(me.getId(), id));
        }
        return ResponseEntity.ok(Map.of("success", true, "blocked", true, "message", "User blocked successfully"));
    }

    @PostMapping("/unblock/{id}")
    public ResponseEntity<?> unblockUser(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        blockedUserRepository.deleteByBlockerIdAndBlockedId(me.getId(), id);
        return ResponseEntity.ok(Map.of("success", true, "blocked", false, "message", "User unblocked successfully"));
    }

    @DeleteMapping("/block/{id}")
    public ResponseEntity<?> unblockUserDelete(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        blockedUserRepository.deleteByBlockerIdAndBlockedId(me.getId(), id);
        return ResponseEntity.ok(Map.of("success", true, "blocked", false, "message", "User unblocked successfully"));
    }

    @GetMapping("/blocked")
    public List<UserDto> getBlockedUsers(Authentication auth) {
        User me = currentUser(auth);
        List<BlockedUser> list = blockedUserRepository.findByBlockerId(me.getId());
        List<Long> blockedIds = list.stream().map(BlockedUser::getBlockedId).toList();
        return userRepository.findAllById(blockedIds).stream().map(UserDto::new).toList();
    }

    @GetMapping("/is-blocked/{id}")
    public ResponseEntity<?> checkIsBlocked(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        boolean blockedByMe = blockedUserRepository.existsByBlockerIdAndBlockedId(me.getId(), id);
        boolean blockedByThem = blockedUserRepository.existsByBlockerIdAndBlockedId(id, me.getId());
        return ResponseEntity.ok(Map.of(
                "blockedByMe", blockedByMe,
                "blockedByThem", blockedByThem,
                "blocked", blockedByMe || blockedByThem
        ));
    }

    @GetMapping("/me")
    public UserDto getMe(Authentication auth) {
        return new UserDto(currentUser(auth));
    }

    @GetMapping("/{id}/profile")
    public ResponseEntity<UserDto> getUserProfile(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(UserDto::new)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/presence")
    public Map<Long, Map<String, Object>> getPresence() {
        Map<Long, String> statusMap = WebSocketEventListener.getUserStatuses();
        List<User> users = userRepository.findAll();
        Map<Long, Map<String, Object>> result = new HashMap<>();

        for (User u : users) {
            Map<String, Object> p = new HashMap<>();
            boolean isOnline = WebSocketEventListener.isUserOnline(u.getId());
            String status = statusMap.getOrDefault(u.getId(), u.getCustomStatus() != null ? u.getCustomStatus() : "offline");
            if (!isOnline && "online".equals(status)) {
                status = "offline";
            }
            p.put("status", status);
            p.put("online", isOnline);
            p.put("lastSeen", u.getLastSeen());
            p.put("displayName", u.getDisplayName());
            result.put(u.getId(), p);
        }

        return result;
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@RequestBody UpdateProfileRequest request, Authentication auth) {
        User me = currentUser(auth);
        boolean usernameChanged = false;

        if (request.getUsername() != null && !request.getUsername().isBlank()
                && !request.getUsername().trim().equalsIgnoreCase(me.getUsername())) {
            String newUsername = request.getUsername().trim();
            if (userRepository.existsByUsername(newUsername)) {
                return ResponseEntity.badRequest().body("Username is already taken");
            }
            me.setUsername(newUsername);
            usernameChanged = true;
        }

        if (request.getDisplayName() != null) {
            me.setDisplayName(request.getDisplayName().trim());
        }

        if (request.getAvatarUrl() != null) {
            me.setAvatarUrl(request.getAvatarUrl().trim());
        }

        if (request.getBio() != null) {
            me.setBio(request.getBio());
        }

        if (request.getCustomStatus() != null && !request.getCustomStatus().isBlank()) {
            me.setCustomStatus(request.getCustomStatus());
            WebSocketEventListener.setUserCustomStatus(me.getId(), request.getCustomStatus());
        }

        if (request.getPreferredLanguage() != null && !request.getPreferredLanguage().isBlank()) {
            me.setPreferredLanguage(request.getPreferredLanguage().trim().toLowerCase());
        }

        if (request.getAutoTranslate() != null) {
            me.setAutoTranslate(request.getAutoTranslate());
        }

        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            boolean isGoogleUser = me.getAuthProvider() != null && "google".equalsIgnoreCase(me.getAuthProvider());
            if (!isGoogleUser) {
                if (request.getCurrentPassword() == null
                        || !passwordEncoder.matches(request.getCurrentPassword(), me.getPassword())) {
                    return ResponseEntity.status(401).body("Current password is incorrect");
                }
            }

            try {
                passwordValidator.validate(request.getNewPassword(), me.getUsername());
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(ex.getMessage());
            }

            me.setPassword(passwordEncoder.encode(request.getNewPassword()));
        }

        userRepository.save(me);
        UserDto dto = new UserDto(me);
        if (usernameChanged) {
            String newToken = jwtUtil.generateToken(me.getUsername());
            dto.setToken(newToken);
        }
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/me")
    @Transactional
    public ResponseEntity<?> deleteAccount(@RequestBody(required = false) Map<String, String> body, Authentication auth) {
        User me = currentUser(auth);

        String reason = body != null ? body.get("reason") : null;
        if (reason != null && !reason.isBlank()) {
            System.out.println("[ACCOUNT DELETED] User @" + me.getUsername() + " (" + me.getEmail() + ") deleted account. Reason: " + reason.trim());
        }

        boolean isGoogleUser = "google".equalsIgnoreCase(me.getAuthProvider());
        String googleEmail = body != null ? body.get("googleEmail") : null;
        String confirmation = body != null ? body.get("confirmation") : null;
        String enteredPassword = body != null ? body.get("password") : null;

        boolean verified = false;

        // 1. Verify with Google account email match
        if (googleEmail != null && !googleEmail.isBlank() && googleEmail.trim().equalsIgnoreCase(me.getEmail())) {
            verified = true;
            if (!isGoogleUser) {
                me.setAuthProvider("google");
            }
        }

        // 2. Explicit confirmation ("DELETE" or typing their email handle)
        if (!verified && confirmation != null && !confirmation.isBlank()) {
            String trimmed = confirmation.trim();
            if (trimmed.equalsIgnoreCase("DELETE") || trimmed.equalsIgnoreCase(me.getEmail())) {
                verified = true;
            }
        }

        // 3. Password verification (for standard password users, or "DELETE" confirmation)
        if (!verified && enteredPassword != null && !enteredPassword.isBlank()) {
            if (enteredPassword.trim().equalsIgnoreCase("DELETE")) {
                verified = true;
            } else if (me.getPassword() != null && passwordEncoder.matches(enteredPassword, me.getPassword())) {
                verified = true;
            } else {
                return ResponseEntity.status(401).body(Map.of("error", "Incorrect password"));
            }
        }

        if (!verified) {
            if (isGoogleUser) {
                return ResponseEntity.status(400).body(Map.of("error", "Please verify with your Google account or type DELETE to confirm."));
            } else {
                return ResponseEntity.status(400).body(Map.of("error", "Please enter your password or type DELETE to confirm account deletion."));
            }
        }

        recordDeletedAccount(me, reason);
        performUserDeletion(me);

        return ResponseEntity.ok(Map.of("message", "Your account has been deleted permanently."));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteUserById(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        if (me.getId().equals(id)) {
            return ResponseEntity.badRequest().body(Map.of("error", "To delete your own account, please use the Delete Account section."));
        }
        java.util.Optional<User> opt = userRepository.findById(id);
        if (opt.isEmpty()) {
            WebSocketEventListener.setUserCustomStatus(id, "offline");
            return ResponseEntity.ok(Map.of(
                    "message", "User already cleaned up or does not exist.",
                    "deletedUserId", id
            ));
        }

        User target = opt.get();
        performUserDeletion(target);
        return ResponseEntity.ok(Map.of(
                "message", "User @" + target.getUsername() + " has been permanently deleted and cleaned up.",
                "deletedUserId", id,
                "deletedUsername", target.getUsername()
        ));
    }

    @DeleteMapping("/by-username/{username}")
    @Transactional
    public ResponseEntity<?> deleteUserByUsername(@PathVariable String username, Authentication auth) {
        User me = currentUser(auth);
        if (me.getUsername().equalsIgnoreCase(username)) {
            return ResponseEntity.badRequest().body(Map.of("error", "To delete your own account, please use the Delete Account section."));
        }
        java.util.Optional<User> opt = userRepository.findByUsername(username);
        if (opt.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "message", "User @" + username + " is already removed or does not exist.",
                    "deletedUsername", username
            ));
        }

        User target = opt.get();
        performUserDeletion(target);
        return ResponseEntity.ok(Map.of(
                "message", "User @" + target.getUsername() + " has been permanently deleted and cleaned up.",
                "deletedUserId", target.getId(),
                "deletedUsername", target.getUsername()
        ));
    }

    @PostMapping("/clean-duplicates")
    @Transactional
    public ResponseEntity<?> cleanDuplicates(Authentication auth) {
        User me = currentUser(auth);

        // 1. Clean duplicate conversations
        List<Conversation> allConvs = conversationRepository.findAll();
        Map<String, Conversation> seenPairs = new HashMap<>();
        List<Conversation> duplicateConvs = new java.util.ArrayList<>();

        for (Conversation c : allConvs) {
            Long a = Math.min(c.getUserAId(), c.getUserBId());
            Long b = Math.max(c.getUserAId(), c.getUserBId());
            String pairKey = a + "_" + b;
            if (seenPairs.containsKey(pairKey)) {
                duplicateConvs.add(c);
            } else {
                seenPairs.put(pairKey, c);
            }
        }

        for (Conversation dup : duplicateConvs) {
            List<Message> msgs = messageRepository.findByConversationIdOrderByTimestampAsc(dup.getId());
            for (Message m : msgs) {
                messageReactionRepository.deleteByMessageId(m.getId());
                messageTranslationRepository.findByMessageId(m.getId()).forEach(messageTranslationRepository::delete);
                messageRepository.delete(m);
            }
            conversationRepository.delete(dup);
        }

        // 2. Clean case-insensitive duplicate usernames
        List<User> allUsers = userRepository.findAll();
        Map<String, User> seenUsernames = new HashMap<>();
        List<User> duplicateUsers = new java.util.ArrayList<>();

        for (User u : allUsers) {
            if (u.getId().equals(me.getId())) continue;
            String lower = u.getUsername().trim().toLowerCase();
            if (seenUsernames.containsKey(lower)) {
                duplicateUsers.add(u);
            } else {
                seenUsernames.put(lower, u);
            }
        }

        for (User dup : duplicateUsers) {
            performUserDeletion(dup);
        }

        return ResponseEntity.ok(Map.of(
                "message", "Double usernames and duplicate conversations cleaned successfully.",
                "deletedDuplicateUsersCount", duplicateUsers.size(),
                "deletedDuplicateConversationsCount", duplicateConvs.size()
        ));
    }

    private void recordDeletedAccount(User user, String reason) {
        if (user == null || user.getEmail() == null) return;
        try {
            String email = user.getEmail().trim().toLowerCase();
            DeletedAccount da = deletedAccountRepository.findTopByEmailOrderByDeletedAtDesc(email)
                    .orElse(new DeletedAccount(email, user.getUsername(), user.getDisplayName(), reason));
            if (da.getId() != null) {
                da.setUsername(user.getUsername());
                da.setDisplayName(user.getDisplayName());
                da.setReason(reason != null && !reason.isBlank() ? reason : da.getReason());
                da.setDeletedAt(java.time.LocalDateTime.now());
                da.setDeletionCount(da.getDeletionCount() != null ? da.getDeletionCount() + 1 : 1);
            }
            deletedAccountRepository.save(da);
        } catch (Exception e) {
            System.err.println("Could not record deleted account: " + e.getMessage());
        }
    }

    private void performUserDeletion(User targetUser) {
        recordDeletedAccount(targetUser, "Account deleted");
        Long targetId = targetUser.getId();

        // 1. Clean up user's post comments
        List<PostComment> myComments = postCommentRepository.findByUser(targetUser);
        postCommentRepository.deleteAll(myComments);

        // 2. Remove user from liked comments
        List<PostComment> allComments = postCommentRepository.findAll();
        for (PostComment c : allComments) {
            if (c.getLikedUserIds() != null && c.getLikedUserIds().remove(targetId)) {
                postCommentRepository.save(c);
            }
        }

        // 3. Clean up user's posts (and their comments)
        List<Post> myPosts = postRepository.findByUser(targetUser);
        for (Post p : myPosts) {
            postCommentRepository.deleteByPost(p);
        }
        postRepository.deleteAll(myPosts);

        // 4. Remove user from liked posts
        List<Post> allPosts = postRepository.findAll();
        for (Post p : allPosts) {
            if (p.getLikedUserIds() != null && p.getLikedUserIds().remove(targetId)) {
                postRepository.save(p);
            }
        }

        // 5. Clean up conversations, messages, reactions, and translations
        List<Conversation> myConvs = conversationRepository.findByUserAIdOrUserBId(targetId, targetId);
        for (Conversation c : myConvs) {
            List<Message> messages = messageRepository.findByConversationIdOrderByTimestampAsc(c.getId());
            for (Message m : messages) {
                messageReactionRepository.deleteByMessageId(m.getId());
                messageTranslationRepository.findByMessageId(m.getId()).forEach(messageTranslationRepository::delete);
                messageRepository.delete(m);
            }
            conversationRepository.delete(c);
        }

        // 6. Delete remaining message reactions by user
        messageReactionRepository.deleteByUserId(targetId);

        // 7. Update live presence to offline
        WebSocketEventListener.setUserCustomStatus(targetId, "offline");

        // 8. Delete blocked user relationships
        blockedUserRepository.deleteByBlockerIdOrBlockedId(targetId, targetId);

        // 9. Delete user account record
        userRepository.delete(targetUser);
    }
}
