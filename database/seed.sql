-- Demo catalog seed data for The Reading Room.
-- Run schema.sql first. This script can be rerun safely.

INSERT INTO genres (name) VALUES
    ('Fiction'), ('Nonfiction'), ('Fantasy'), ('Mystery'), ('Science'), ('History')
ON CONFLICT (name) DO NOTHING;

INSERT INTO authors (name) VALUES
    ('Gabrielle Zevin'), ('Tara Westover'), ('Erin Morgenstern'),
    ('Alex Michaelides'), ('Robin Wall Kimmerer'), ('Matt Haig'),
    ('Yuval Noah Harari'), ('Susanna Clarke')
ON CONFLICT (name) DO NOTHING;

INSERT INTO books (isbn, title, description, genre_id)
SELECT v.isbn, v.title, v.description, g.id
FROM (VALUES
    ('9780735211292', 'Tomorrow, and Tomorrow, and Tomorrow', 'A friendship, a game, and a lifetime of making things together.', 'Fiction'),
    ('9780399590504', 'Educated', 'A young woman leaves a life in the mountains to find an education.', 'Nonfiction'),
    ('9780307744432', 'The Night Circus', 'A mysterious circus appears without warning, open only at night.', 'Fantasy'),
    ('9781250301697', 'The Silent Patient', 'A therapist investigates why a celebrated painter has stopped speaking.', 'Mystery'),
    ('9781571313560', 'Braiding Sweetgrass', 'Essays bringing science, Indigenous knowledge, and the natural world together.', 'Science'),
    ('9780525559474', 'The Midnight Library', 'A woman explores the lives she might have lived.', 'Fiction'),
    ('9780062316097', 'Sapiens', 'A journey through the history of humankind.', 'History'),
    ('9781635575637', 'Piranesi', 'An explorer maps an endless house of halls, statues, and tides.', 'Fantasy')
) AS v(isbn, title, description, genre_name)
JOIN genres g ON g.name = v.genre_name
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id
FROM (VALUES
    ('9780735211292', 'Gabrielle Zevin'),
    ('9780399590504', 'Tara Westover'),
    ('9780307744432', 'Erin Morgenstern'),
    ('9781250301697', 'Alex Michaelides'),
    ('9781571313560', 'Robin Wall Kimmerer'),
    ('9780525559474', 'Matt Haig'),
    ('9780062316097', 'Yuval Noah Harari'),
    ('9781635575637', 'Susanna Clarke')
) AS v(isbn, author_name)
JOIN books b ON b.isbn = v.isbn
JOIN authors a ON a.name = v.author_name
ON CONFLICT (book_id, author_id) DO NOTHING;

-- Physical inventory starts with the same totals shown in app.js.
INSERT INTO book_copies (book_id, barcode, status)
SELECT b.id, b.isbn || '-' || copy_number,
       CASE WHEN b.isbn = '9780307744432' THEN 'loaned' ELSE 'available' END
FROM (VALUES
    ('9780735211292', 4), ('9780399590504', 3), ('9780307744432', 2),
    ('9781250301697', 5), ('9781571313560', 2), ('9780525559474', 3),
    ('9780062316097', 6), ('9781635575637', 2)
) AS inventory(isbn, total_copies)
JOIN books b ON b.isbn = inventory.isbn
CROSS JOIN LATERAL generate_series(1, inventory.total_copies) AS copy_number
ON CONFLICT (barcode) DO NOTHING;
