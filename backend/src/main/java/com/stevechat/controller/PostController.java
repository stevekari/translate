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
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

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

    public PostController(PostRepository postRepository,
                          PostCommentRepository postCommentRepository,
                          UserRepository userRepository) {
        this.postRepository = postRepository;
        this.postCommentRepository = postCommentRepository;
        this.userRepository = userRepository;
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
        dto.setLikedByMe(post.getLikedUserIds() != null && post.getLikedUserIds().contains(currentUserId));
        dto.setCommentsCount(post.getCommentsCount());
        dto.setCreatedAt(post.getCreatedAt());
        return dto;
    }

    private CommentDto toCommentDto(PostComment comment) {
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
        dto.setCreatedAt(comment.getCreatedAt());
        return dto;
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

        if (post.getLikedUserIds().contains(me.getId())) {
            post.getLikedUserIds().remove(me.getId());
        } else {
            post.getLikedUserIds().add(me.getId());
        }

        Post saved = postRepository.save(post);
        return ResponseEntity.ok(toPostDto(saved, me.getId()));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<CommentDto>> getComments(@PathVariable Long id) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));
        List<PostComment> comments = postCommentRepository.findByPostOrderByCreatedAtAsc(post);
        List<CommentDto> dtos = comments.stream().map(this::toCommentDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentDto> addComment(@PathVariable Long id,
                                                 @RequestBody Map<String, String> request,
                                                 Authentication auth) {
        User me = currentUser(auth);
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        String content = request.get("content");
        if (content == null || content.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        PostComment comment = new PostComment(post, me, content.trim());
        PostComment savedComment = postCommentRepository.save(comment);

        post.setCommentsCount(post.getCommentsCount() + 1);
        postRepository.save(post);

        return ResponseEntity.ok(toCommentDto(savedComment));
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
