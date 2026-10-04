package com.stevechat.repository;

import com.stevechat.entity.MessageTranslation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageTranslationRepository extends JpaRepository<MessageTranslation, Long> {
    Optional<MessageTranslation> findByMessageIdAndTargetLanguage(Long messageId, String targetLanguage);
    List<MessageTranslation> findByMessageId(Long messageId);
}
