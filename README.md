# The Reading Room

A responsive online library website prototype. Open `index.html` in a modern browser to explore the catalog, search and filter books, borrow and return titles, and view loans and reading history. The prototype stores activity in browser local storage. The profile dialog includes simulated sign-in and sign-out controls; each email address has a separate demo account with its own loans and reading history. Borrowing requires signing in. A Librarian demo account can view a catalog and inventory summary, see active loans across demo accounts, and add titles and physical copies. These controls do not authenticate real accounts, and inventory remains shared in this browser.

## Relational database

The `database` folder contains a PostgreSQL relational database design and sample catalog data:

- `schema.sql` creates the tables, relationships, constraints, and indexes.
- `seed.sql` inserts the eight demo books, their genres and authors, and physical copy records. Run it after the schema. It is safe to rerun.

The model uses `library_users` for members and staff; `books`, `authors`, and `genres` for catalog information; `book_authors` to model the many-to-many relationship between books and authors; `book_copies` to track individual physical copies; and `loans` to record checkout and return history. Foreign keys connect related rows. A loan points to one physical copy and one library user.

With PostgreSQL installed, create a database and load the files from the project directory:

```sh
createdb reading_room
psql -d reading_room -f database/schema.sql
psql -d reading_room -f database/seed.sql
```

On Windows, run `setup-local-db.ps1` from PowerShell to create the application database role, initialize the database and sample catalog, and write the local connection string to `.env`. It asks for the PostgreSQL administrator password with hidden input; the password is not written to the project.

For example, this query lists each book, its author, genre, and copy count:

```sql
SELECT b.title, a.name AS author, g.name AS genre,
       COUNT(c.id) AS total_copies,
       COUNT(c.id) FILTER (WHERE c.status = 'available') AS available_copies
FROM books AS b
LEFT JOIN genres AS g ON g.id = b.genre_id
LEFT JOIN book_authors AS ba ON ba.book_id = b.id
LEFT JOIN authors AS a ON a.id = ba.author_id
LEFT JOIN book_copies AS c ON c.book_id = b.id
GROUP BY b.id, b.title, a.name, g.name
ORDER BY b.title;
```

## Run the connected app

The frontend now calls the Express API for the catalog, student and librarian signup/sign-in, loans, returns, and librarian catalog actions. PostgreSQL stores users, books, copy inventory, and loan history. Set `DATABASE_URL` and `LIBRARIAN_SIGNUP_CODE`, then install and initialize the database:

```sh
npm install
createdb reading_room
psql -d reading_room -f database/schema.sql
psql -d reading_room -f database/seed.sql
npm start
```

Open `http://localhost:3000`. Students can create accounts in the profile dialog. Librarian registration requires the private code configured in `LIBRARIAN_SIGNUP_CODE`; set the same variable in the hosting provider (for example, Render) before using librarian signup. Keep this code private and share it only with people authorized to create librarian accounts. The current API session store is in memory, so signing in again is required after a server restart; use a persistent session store before running multiple server instances.
