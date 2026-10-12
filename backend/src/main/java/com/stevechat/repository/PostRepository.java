package com.stevechat.repository;

import com.stevechat.entity.Post;
import com.stevechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findAllByOrderByCreatedAtDesc();
    List<Post> findByUser(User user);
    void deleteByUser(User user);
}
