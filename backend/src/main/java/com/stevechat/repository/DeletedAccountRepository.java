package com.stevechat.repository;

import com.stevechat.entity.DeletedAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeletedAccountRepository extends JpaRepository<DeletedAccount, Long> {
    Optional<DeletedAccount> findTopByEmailOrderByDeletedAtDesc(String email);
    Optional<DeletedAccount> findTopByUsernameOrderByDeletedAtDesc(String username);
    List<DeletedAccount> findByEmailOrderByDeletedAtDesc(String email);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
}
