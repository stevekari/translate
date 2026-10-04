package com.stevechat.repository;

import com.stevechat.entity.Post;
import com.stevechat.entity.PostComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostCommentRepository extends JpaRepository<PostComment, Long> {
    List<PostComment> findByPostOrderByCreatedAtAsc(Post post);
    void deleteByPost(Post post);
}
