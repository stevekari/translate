package com.stevechat.controller;

import com.stevechat.dto.CommentDto;
import com.stevechat.dto.PostDto;
import com.stevechat.entity.Post;
import com.stevechat.entity.PostComment;
import com.stevechat.entity.User;
import com.stevechat.repository.PostCommentRepository;
import com.stevechat.repository.PostRepository;
import com.stevechat.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/posts", "/api/posts"})
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class PostController {

    private final PostRepository postRepository;
    private final PostCommentRepository postCommentRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public PostController(PostRepository postRepository,
                          PostCommentRepository postCommentRepository,
                          UserRepository userRepository,
                          SimpMessagingTemplate messagingTemplate) {
        this.postRepository = postRepository;
        this.postCommentRepository = postCommentRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    private User currentUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    private PostDto toPostDto(Post post, Long currentUserId) {
        PostDto dto = new PostDto();
        dto.setId(post.getId());
        if (post.getUser() != null) {
            dto.setUserId(post.getUser().getId());
            dto.setUsername(post.getUser().getUsername());
            dto.setDisplayName(post.getUser().getDisplayName());
            dto.setAvatarUrl(post.getUser().getAvatarUrl());
        }
        dto.setContent(post.getContent());
        dto.setMediaUrl(post.getMediaUrl());
        dto.setMediaType(post.getMediaType());
        dto.setLanguage(post.getLanguage());
        dto.setLikeCount(post.getLikeCount());
        dto.setLikedUserIds(post.getLikedUserIds());
        dto.setLikedByMe(post.getLikedUserIds() != null && currentUserId != null && post.getLikedUserIds().contains(currentUserId));
        dto.setCommentsCount(post.getCommentsCount());
        dto.setCreatedAt(post.getCreatedAt());
        return dto;
    }

    private CommentDto toCommentDto(PostComment comment, Long currentUserId) {
        CommentDto dto = new CommentDto();
        dto.setId(comment.getId());
        dto.setPostId(comment.getPost().getId());
        if (comment.getUser() != null) {
            dto.setUserId(comment.getUser().getId());
            dto.setUsername(comment.getUser().getUsername());
            dto.setDisplayName(comment.getUser().getDisplayName());
            dto.setAvatarUrl(comment.getUser().getAvatarUrl());
        }
        dto.setContent(comment.getContent());
        dto.setParentCommentId(comment.getParentCommentId());
        dto.setReplyToUsername(comment.getReplyToUsername());
        dto.setLikeCount(comment.getLikeCount());
        dto.setLikedUserIds(comment.getLikedUserIds());
        dto.setLikedByMe(comment.getLikedUserIds() != null && currentUserId != null && comment.getLikedUserIds().contains(currentUserId));
        dto.setCreatedAt(comment.getCreatedAt());
        return dto;
    }

    private void sendNotification(Long targetUserId, Map<String, Object> payload) {
        if (targetUserId == null || messagingTemplate == null) return;
        try {
            messagingTemplate.convertAndSend("/topic/user." + targetUserId + ".notifications", payload);
        } catch (Exception e) {
            // Log & ignore websocket broadcast errors gracefully
        }
    }

    @GetMapping
    public ResponseEntity<List<PostDto>> getAllPosts(Authentication auth) {
        User me = currentUser(auth);
        List<Post> posts = postRepository.findAllByOrderByCreatedAtDesc();
        List<PostDto> dtos = posts.stream()
                .map(p -> toPostDto(p, me.getId()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping
    public ResponseEntity<PostDto> createPost(@RequestBody Map<String, String> request, Authentication auth) {
        User me = currentUser(auth);
        String content = request.get("content");
        if (content == null || content.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        String mediaUrl = request.get("mediaUrl");
        String mediaType = request.get("mediaType");
        String language = request.get("language");

        Post post = new Post(me, content.trim(), mediaUrl, mediaType, language);
        Post saved = postRepository.save(post);
        return ResponseEntity.ok(toPostDto(saved, me.getId()));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<PostDto> toggleLike(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        boolean isLiked;
        if (post.getLikedUserIds().contains(me.getId())) {
            post.getLikedUserIds().remove(me.getId());
            isLiked = false;
        } else {
            post.getLikedUserIds().add(me.getId());
            isLiked = true;
        }

        Post saved = postRepository.save(post);

        // Send real-time top notification if liked by a friend
        if (isLiked && post.getUser() != null && !post.getUser().getId().equals(me.getId())) {
            Map<String, Object> notif = new HashMap<>();
            notif.put("type", "POST_LIKE");
            notif.put("postId", post.getId());
            notif.put("senderId", me.getId());
            notif.put("senderName", me.getDisplayName() != null ? me.getDisplayName() : me.getUsername());
            notif.put("senderUsername", me.getUsername());
            notif.put("senderAvatarUrl", me.getAvatarUrl());
            notif.put("snippet", post.getContent() != null && post.getContent().length() > 50 
                    ? post.getContent().substring(0, 50) + "..." : post.getContent());
            notif.put("message", (me.getDisplayName() != null ? me.getDisplayName() : me.getUsername()) + " liked your post ❤️");
            notif.put("timestamp", LocalDateTime.now().toString());
            sendNotification(post.getUser().getId(), notif);
        }

        return ResponseEntity.ok(toPostDto(saved, me.getId()));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        List<PostComment> comments = postCommentRepository.findByPostOrderByCreatedAtAsc(post);
        List<CommentDto> dtos = comments.stream().map(c -> toCommentDto(c, me.getId())).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentDto> addComment(@PathVariable Long id,
                                                 @RequestBody Map<String, Object> request,
                                                 Authentication auth) {
        User me = currentUser(auth);
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        String content = request.get("content") != null ? String.valueOf(request.get("content")) : null;
        if (content == null || content.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Long parentCommentId = null;
        if (request.get("parentCommentId") != null) {
            try {
                parentCommentId = Long.valueOf(String.valueOf(request.get("parentCommentId")));
            } catch (Exception ignored) {}
        }

        String replyToUsername = request.get("replyToUsername") != null 
                ? String.valueOf(request.get("replyToUsername")).trim() : null;

        PostComment comment = new PostComment(post, me, content.trim(), parentCommentId, replyToUsername);
        PostComment savedComment = postCommentRepository.save(comment);

        post.setCommentsCount(post.getCommentsCount() + 1);
        postRepository.save(post);

        // If this is a reply to another user's comment, notify that user
        if (parentCommentId != null) {
            PostComment parent = postCommentRepository.findById(parentCommentId).orElse(null);
            if (parent != null && parent.getUser() != null && !parent.getUser().getId().equals(me.getId())) {
                Map<String, Object> notif = new HashMap<>();
                notif.put("type", "COMMENT_REPLY");
                notif.put("postId", post.getId());
                notif.put("commentId", savedComment.getId());
                notif.put("senderId", me.getId());
                notif.put("senderName", me.getDisplayName() != null ? me.getDisplayName() : me.getUsername());
                notif.put("senderUsername", me.getUsername());
                notif.put("senderAvatarUrl", me.getAvatarUrl());
                notif.put("snippet", comment.getContent().length() > 50 
                        ? comment.getContent().substring(0, 50) + "..." : comment.getContent());
                notif.put("message", (me.getDisplayName() != null ? me.getDisplayName() : me.getUsername()) + " replied to your comment 💬");
                notif.put("timestamp", LocalDateTime.now().toString());
                sendNotification(parent.getUser().getId(), notif);
            }
        }

        // Notify post owner (if not current user and not already notified as parent commenter)
        if (post.getUser() != null && !post.getUser().getId().equals(me.getId())) {
            Map<String, Object> notif = new HashMap<>();
            notif.put("type", "POST_COMMENT");
            notif.put("postId", post.getId());
            notif.put("commentId", savedComment.getId());
            notif.put("senderId", me.getId());
            notif.put("senderName", me.getDisplayName() != null ? me.getDisplayName() : me.getUsername());
            notif.put("senderUsername", me.getUsername());
            notif.put("senderAvatarUrl", me.getAvatarUrl());
            notif.put("snippet", comment.getContent().length() > 50 
                    ? comment.getContent().substring(0, 50) + "..." : comment.getContent());
            notif.put("message", (me.getDisplayName() != null ? me.getDisplayName() : me.getUsername()) + " commented on your post 💬");
            notif.put("timestamp", LocalDateTime.now().toString());
            sendNotification(post.getUser().getId(), notif);
        }

        return ResponseEntity.ok(toCommentDto(savedComment, me.getId()));
    }

    @PostMapping({"/{postId}/comments/{commentId}/like", "/api/posts/{postId}/comments/{commentId}/like"})
    public ResponseEntity<CommentDto> toggleCommentLike(@PathVariable Long postId,
                                                        @PathVariable Long commentId,
                                                        Authentication auth) {
        User me = currentUser(auth);
        PostComment comment = postCommentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Comment not found"));

        boolean isLiked;
        if (comment.getLikedUserIds().contains(me.getId())) {
            comment.getLikedUserIds().remove(me.getId());
            isLiked = false;
        } else {
            comment.getLikedUserIds().add(me.getId());
            isLiked = true;
        }

        PostComment saved = postCommentRepository.save(comment);

        // Send notification to comment owner if liked by someone else
        if (isLiked && comment.getUser() != null && !comment.getUser().getId().equals(me.getId())) {
            Map<String, Object> notif = new HashMap<>();
            notif.put("type", "COMMENT_LIKE");
            notif.put("postId", postId);
            notif.put("commentId", comment.getId());
            notif.put("senderId", me.getId());
            notif.put("senderName", me.getDisplayName() != null ? me.getDisplayName() : me.getUsername());
            notif.put("senderUsername", me.getUsername());
            notif.put("senderAvatarUrl", me.getAvatarUrl());
            notif.put("snippet", comment.getContent().length() > 50 
                    ? comment.getContent().substring(0, 50) + "..." : comment.getContent());
            notif.put("message", (me.getDisplayName() != null ? me.getDisplayName() : me.getUsername()) + " liked your comment ❤️");
            notif.put("timestamp", LocalDateTime.now().toString());
            sendNotification(comment.getUser().getId(), notif);
        }

        return ResponseEntity.ok(toCommentDto(saved, me.getId()));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deletePost(@PathVariable Long id, Authentication auth) {
        User me = currentUser(auth);
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        if (!post.getUser().getId().equals(me.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to delete this post"));
        }

        postCommentRepository.deleteByPost(post);
        postRepository.delete(post);
        return ResponseEntity.ok(Map.of("message", "Post deleted successfully"));
    }
}
