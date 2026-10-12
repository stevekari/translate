package com.stevechat.repository;

import com.stevechat.entity.Post;
import com.stevechat.entity.PostComment;
import com.stevechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostCommentRepository extends JpaRepository<PostComment, Long> {
    List<PostComment> findByPostOrderByCreatedAtAsc(Post post);
    List<PostComment> findByUser(User user);
    void deleteByPost(Post post);
    void deleteByUser(User user);
}
