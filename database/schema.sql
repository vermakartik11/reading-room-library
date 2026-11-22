-- Relational schema for a production online library (PostgreSQL).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE library_users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('student', 'librarian')),
    member_number VARCHAR(32) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE authors (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE
);

CREATE TABLE genres (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE books (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    isbn VARCHAR(17) UNIQUE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    publisher VARCHAR(200),
    publication_year SMALLINT,
    genre_id BIGINT REFERENCES genres(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE book_authors (
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    author_order SMALLINT NOT NULL DEFAULT 1,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE book_copies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    barcode VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(16) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'loaned', 'maintenance', 'lost')),
    shelf_location VARCHAR(80)
);

CREATE TABLE loans (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    copy_id BIGINT NOT NULL REFERENCES book_copies(id),
    user_id BIGINT NOT NULL REFERENCES library_users(id),
    checked_out_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    CHECK (due_at > checked_out_at),
    CHECK (returned_at IS NULL OR returned_at >= checked_out_at)
);

-- Common lookups and foreign-key access paths.
CREATE INDEX books_genre_idx ON books (genre_id);
CREATE INDEX book_authors_author_idx ON book_authors (author_id);
CREATE INDEX book_copies_book_status_idx ON book_copies (book_id, status);
CREATE INDEX loans_copy_idx ON loans (copy_id);

CREATE INDEX books_title_search_idx ON books USING GIN (to_tsvector('english', title));
CREATE INDEX authors_name_search_idx ON authors USING GIN (to_tsvector('english', name));
CREATE INDEX loans_user_history_idx ON loans (user_id, checked_out_at DESC);
CREATE INDEX loans_active_due_idx ON loans (due_at) WHERE returned_at IS NULL;
CREATE UNIQUE INDEX one_active_loan_per_copy_idx ON loans(copy_id) WHERE returned_at IS NULL;
