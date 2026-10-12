package com.stevechat.repository;

import com.stevechat.entity.BlockedUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface BlockedUserRepository extends JpaRepository<BlockedUser, Long> {
    Optional<BlockedUser> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    List<BlockedUser> findByBlockerId(Long blockerId);

    @Transactional
    @Modifying
    @Query("DELETE FROM BlockedUser b WHERE b.blockerId = :blockerId AND b.blockedId = :blockedId")
    void deleteByBlockerIdAndBlockedId(@Param("blockerId") Long blockerId, @Param("blockedId") Long blockedId);

    @Transactional
    @Modifying
    @Query("DELETE FROM BlockedUser b WHERE b.blockerId = :id1 OR b.blockedId = :id2")
    void deleteByBlockerIdOrBlockedId(@Param("id1") Long id1, @Param("id2") Long id2);
}

