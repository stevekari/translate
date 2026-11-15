-- Giochat schema
-- Works on MySQL 8+ and PostgreSQL 13+ with the noted tweaks.

CREATE TABLE users (
    id                 BIGINT PRIMARY KEY AUTO_INCREMENT,   -- Postgres: GENERATED ALWAYS AS IDENTITY
    username           VARCHAR(50)  NOT NULL UNIQUE,
    email              VARCHAR(255) NOT NULL UNIQUE,
    password           VARCHAR(255) NOT NULL,
    avatar_url         VARCHAR(500),
    preferred_language VARCHAR(20)  DEFAULT 'en',
    auto_translate     BOOLEAN      DEFAULT TRUE,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per unique pair of users (user_a_id is always the smaller id).
CREATE TABLE conversations (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,   -- Postgres: GENERATED ALWAYS AS IDENTITY
    user_a_id    BIGINT NOT NULL REFERENCES users(id),
    user_b_id    BIGINT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE messages (
    id               BIGINT PRIMARY KEY AUTO_INCREMENT,  -- Postgres: GENERATED ALWAYS AS IDENTITY
    conversation_id  BIGINT NOT NULL REFERENCES conversations(id),
    sender_id        BIGINT NOT NULL REFERENCES users(id),
    content          TEXT NOT NULL,
    timestamp        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE message_translations (
    id               BIGINT PRIMARY KEY AUTO_INCREMENT,  -- Postgres: GENERATED ALWAYS AS IDENTITY
    message_id       BIGINT NOT NULL REFERENCES messages(id),
    target_language  VARCHAR(20) NOT NULL,
    source_language  VARCHAR(20),
    translated_text  TEXT NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (message_id, target_language)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, timestamp);
CREATE INDEX idx_conversations_user_a ON conversations(user_a_id);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id);
CREATE INDEX idx_translations_message ON message_translations(message_id, target_language);

-- Track deleted accounts to detect returning / re-registering users
CREATE TABLE deleted_accounts (
    id                      BIGINT PRIMARY KEY AUTO_INCREMENT,
    email                   VARCHAR(255) NOT NULL,
    username                VARCHAR(50),
    display_name            VARCHAR(255),
    reason                  VARCHAR(1000),
    deleted_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletion_count          INT DEFAULT 1,
    last_re_registered_at   TIMESTAMP,
    re_registration_count   INT DEFAULT 0
);

CREATE INDEX idx_deleted_accounts_email ON deleted_accounts(email);
CREATE INDEX idx_deleted_accounts_username ON deleted_accounts(username);
