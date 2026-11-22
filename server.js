require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
if (!process.env.DATABASE_URL) console.warn('DATABASE_URL is not set. Configure it before starting the library server.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());
app.use((req,res,next)=>{const sid=req.headers['x-session-id'];if(sid&&sessions.has(sid))req.user=sessions.get(sid);next()});
app.use(express.static(__dirname));
const sessions=new Map();
const requireUser=(req,res,next)=>req.user?next():res.status(401).json({error:'Please sign in'});
const requireRole=role=>(req,res,next)=>req.user?.role===role?next():res.status(403).json({error:'Not allowed'});

app.get('/api/books', async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT b.id::text, b.title, COALESCE(a.name,'Unknown') author,
      COALESCE(g.name,'Fiction') genre, COUNT(c.id)::int total,
      COUNT(c.id) FILTER (WHERE c.status='available')::int copies
      FROM books b LEFT JOIN genres g ON g.id=b.genre_id
      LEFT JOIN book_authors ba ON ba.book_id=b.id LEFT JOIN authors a ON a.id=ba.author_id
      LEFT JOIN book_copies c ON c.book_id=b.id GROUP BY b.id,a.name,g.name ORDER BY b.id`);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load catalog' }); }
});

app.post('/api/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !['Student','Librarian'].includes(role)) return res.status(400).json({error:'Email, password, and account type are required'});
  try {
    const { rows } = await pool.query('SELECT id,email,full_name,role FROM library_users WHERE lower(email)=lower($1) AND password_hash=crypt($2,password_hash)', [email,password]);
    if (!rows.length) return res.status(401).json({error:'Invalid email or password'});
    const user=rows[0]; if(user.role !== role.toLowerCase()) return res.status(403).json({error:'Selected account type does not match this account'});
    const token=crypto.randomBytes(32).toString('hex');sessions.set(token,user);res.json({user,token});
  } catch(e) { console.error(e); res.status(500).json({error:'Could not sign in'}); }
});

app.get('/api/me',requireUser,async(req,res)=>{try{const [active,history]=await Promise.all([
  pool.query(`SELECT b.id::text,b.title,a.name author,g.name genre,l.due_at due,l.checked_out_at borrowed FROM loans l JOIN book_copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id LEFT JOIN book_authors ba ON ba.book_id=b.id LEFT JOIN authors a ON a.id=ba.author_id LEFT JOIN genres g ON g.id=b.genre_id WHERE l.user_id=$1 AND l.returned_at IS NULL ORDER BY l.checked_out_at DESC`,[req.user.id]),
  pool.query(`SELECT b.id::text,b.title,a.name author,g.name genre,l.returned_at returned FROM loans l JOIN book_copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id LEFT JOIN book_authors ba ON ba.book_id=b.id LEFT JOIN authors a ON a.id=ba.author_id LEFT JOIN genres g ON g.id=b.genre_id WHERE l.user_id=$1 AND l.returned_at IS NOT NULL ORDER BY l.returned_at DESC`,[req.user.id])]);res.json({user:req.user,loans:active.rows,history:history.rows});}catch(e){console.error(e);res.status(500).json({error:'Could not load account'});}});
app.get('/api/staff/loans',requireUser,requireRole('librarian'),async(_req,res)=>{try{const {rows}=await pool.query(`SELECT b.id::text,b.title,u.email,l.due_at due FROM loans l JOIN book_copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id JOIN library_users u ON u.id=l.user_id WHERE l.returned_at IS NULL ORDER BY l.due_at LIMIT 50`);res.json(rows);}catch(e){console.error(e);res.status(500).json({error:'Could not load active loans'});}});
app.post('/api/logout',requireUser,(req,res)=>{sessions.delete(req.headers['x-session-id']);res.json({ok:true});});
app.post('/api/loans/:bookId',requireUser,requireRole('student'),async(req,res)=>{const c=await pool.connect();try{await c.query('BEGIN');const copy=await c.query("SELECT id FROM book_copies WHERE book_id=$1 AND status='available' LIMIT 1 FOR UPDATE SKIP LOCKED",[req.params.bookId]);if(!copy.rowCount){await c.query('ROLLBACK');return res.status(409).json({error:'No copies are available'});}await c.query("UPDATE book_copies SET status='loaned' WHERE id=$1",[copy.rows[0].id]);await c.query("INSERT INTO loans(copy_id,user_id,due_at) VALUES($1,$2,NOW()+INTERVAL '21 days')",[copy.rows[0].id,req.user.id]);await c.query('COMMIT');res.status(201).json({ok:true});}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'Could not borrow book'});}finally{c.release();}});
app.delete('/api/loans/:bookId',requireUser,async(req,res)=>{try{const result=await pool.query(`UPDATE book_copies c SET status='available' FROM loans l WHERE l.copy_id=c.id AND c.book_id=$1 AND l.user_id=$2 AND l.returned_at IS NULL RETURNING l.id`,[req.params.bookId,req.user.id]);if(!result.rowCount)return res.status(404).json({error:'Active loan not found'});await pool.query('UPDATE loans SET returned_at=NOW() WHERE id=$1',[result.rows[0].id]);res.json({ok:true});}catch(e){console.error(e);res.status(500).json({error:'Could not return book'});}});
app.post('/api/books',requireUser,requireRole('librarian'),async(req,res)=>{const {title,author,genre,copies}=req.body;if(!title||!author||!genre||!Number.isInteger(copies)||copies<1||copies>50)return res.status(400).json({error:'Invalid book details'});const c=await pool.connect();try{await c.query('BEGIN');const g=await c.query('INSERT INTO genres(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[genre]);const b=await c.query('INSERT INTO books(title,genre_id) VALUES($1,$2) RETURNING id',[title,g.rows[0].id]);const a=await c.query('INSERT INTO authors(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id',[author]);await c.query('INSERT INTO book_authors(book_id,author_id) VALUES($1,$2)',[b.rows[0].id,a.rows[0].id]);for(let i=0;i<copies;i++)await c.query('INSERT INTO book_copies(book_id,barcode) VALUES($1,$2)',[b.rows[0].id,`R-${b.rows[0].id}-${i+1}`]);await c.query('COMMIT');res.status(201).json({ok:true});}catch(e){await c.query('ROLLBACK');console.error(e);res.status(500).json({error:'Could not add book'});}finally{c.release();}});

app.post('/api/register', async (req,res)=>{
  const {email,password,fullName}=req.body;
  if(!email||!password||!fullName||password.length<8) return res.status(400).json({error:'Enter your name, email, and a password of at least 8 characters'});
  try { const {rows}=await pool.query(`INSERT INTO library_users(email,password_hash,full_name,role) VALUES($1,crypt($2,gen_salt('bf')), $3,'student') RETURNING id,email,full_name,role`,[email,password,fullName]); res.status(201).json({user:rows[0]}); }
  catch(e){ if(e.code==='23505')return res.status(409).json({error:'Email already registered'}); console.error(e);res.status(500).json({error:'Could not create account'}); }
});

app.get('/api/health', (_req,res)=>res.json({ok:true}));
const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Library server listening on http://localhost:${port}`));
