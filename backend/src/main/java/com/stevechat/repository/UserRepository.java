package com.stevechat.repository;

import com.stevechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    List<User> findByIdNot(Long id);
    List<User> findByIdNotAndUsernameContainingIgnoreCase(Long id, String username);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE u.id <> :myId AND (LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(COALESCE(u.displayName, '')) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<User> searchUsers(@org.springframework.data.repository.query.Param("myId") Long myId, @org.springframework.data.repository.query.Param("query") String query);
}
