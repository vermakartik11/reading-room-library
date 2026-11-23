const books = [
  {id:'tomorrow',title:'Tomorrow, and Tomorrow, and Tomorrow',author:'Gabrielle Zevin',genre:'Fiction',rating:'4.8',copies:3,total:4,color:'#52705c',accent:'#e3bd8c',coverTitle:'TOMORROW, AND TOMORROW, AND TOMORROW'},
  {id:'educated',title:'Educated',author:'Tara Westover',genre:'Nonfiction',rating:'4.7',copies:2,total:3,color:'#a45b45',accent:'#e8c887',coverTitle:'EDUCATED'},
  {id:'nightcircus',title:'The Night Circus',author:'Erin Morgenstern',genre:'Fantasy',rating:'4.6',copies:0,total:2,color:'#24384d',accent:'#c89c63',coverTitle:'THE NIGHT CIRCUS'},
  {id:'silentpatient',title:'The Silent Patient',author:'Alex Michaelides',genre:'Mystery',rating:'4.5',copies:4,total:5,color:'#d4d0b8',accent:'#334c44',coverTitle:'THE SILENT PATIENT'},
  {id:'braiding',title:'Braiding Sweetgrass',author:'Robin Wall Kimmerer',genre:'Science',rating:'4.9',copies:1,total:2,color:'#6c8060',accent:'#e6ce9d',coverTitle:'BRAIDING SWEETGRASS'},
  {id:'midnight',title:'The Midnight Library',author:'Matt Haig',genre:'Fiction',rating:'4.6',copies:2,total:3,color:'#426075',accent:'#d2b37c',coverTitle:'THE MIDNIGHT LIBRARY'},
  {id:'sapiens',title:'Sapiens',author:'Yuval Noah Harari',genre:'History',rating:'4.7',copies:5,total:6,color:'#ae714d',accent:'#e8d2ad',coverTitle:'SAPIENS'},
  {id:'piranesi',title:'Piranesi',author:'Susanna Clarke',genre:'Fantasy',rating:'4.5',copies:2,total:2,color:'#729288',accent:'#e0c99b',coverTitle:'PIRANESI'}
];
const initialLoans = [
  {id:'braiding',due:'Nov 4',borrowed:'Oct 14'},
  {id:'midnight',due:'Nov 12',borrowed:'Oct 22'}
];
const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const addedBooks = read('readingRoomAddedBooks', []);
books.push(...addedBooks);
const initialHistory = [
  {id:'educated',returned:'2026-10-08'},
  {id:'sapiens',returned:'2026-09-21'},
  {id:'piranesi',returned:'2026-08-16'}
];
const defaultAccountKey = 'jamie.davis@campus.edu';
const savedAccounts = read('readingRoomAccounts', null);
const accounts = savedAccounts || {
  [defaultAccountKey]: {
    loans: read('readingRoomLoans', initialLoans),
    history: read('readingRoomHistory', initialHistory),
    returnedCount: Number(read('readingRoomReturned', 12))
  }
};
if (!savedAccounts) localStorage.setItem('readingRoomAccounts', JSON.stringify(accounts));
let currentAccount = null;
let currentRole = 'Student';
let loans = [];
let history = [];
let returnedCount = 0;
const inventory = read('readingRoomInventory', null);
if (inventory) books.forEach(book => { if (Number.isInteger(inventory[book.id])) book.copies = inventory[book.id]; });
let activeView = 'discover';
let availableOnly = false;
const grid = document.getElementById('book-grid');
const toast = document.getElementById('toast');
let toastTimer;
let apiToken=localStorage.getItem('readingRoomSession')||'';
async function api(path,options={}){const response=await fetch(`/api${path}`,{...options,headers:{'Content-Type':'application/json',...(apiToken?{'x-session-id':apiToken}:{}),...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Request failed');return data}
const paletteFor=(index)=>[['#52705c','#e3bd8c'],['#a45b45','#e8c887'],['#426075','#d2b37c'],['#729288','#e0c99b']][index%4];
async function loadServerData(){try{const rows=await api('/books');books.splice(0,books.length,...rows.map((b,i)=>{const [color,accent]=paletteFor(i);return{id:String(b.id),title:b.title,author:b.author,genre:b.genre,rating:'—',copies:b.copies,total:b.total,color,accent,coverTitle:b.title.toUpperCase()}}));if(apiToken){try{const me=await api('/me');currentAccount=me.user.email;currentRole=me.user.role==='librarian'?'Librarian':'Student';loans=me.loans.map(x=>({...x,id:String(x.id),due:new Date(x.due).toLocaleDateString(),borrowed:new Date(x.borrowed).toLocaleDateString()}));history=me.history.map(x=>({...x,id:String(x.id),returned:new Date(x.returned).toLocaleDateString()}));returnedCount=history.length;signedIn=true;document.querySelector('.profile-copy strong').textContent=me.user.full_name;document.querySelector('.avatar').textContent=me.user.full_name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();document.getElementById('role-label').textContent=currentRole==='Student'?'Student':'Librarian · Staff'}catch{apiToken='';localStorage.removeItem('readingRoomSession')}}}catch(error){notify(`Backend unavailable: ${error.message}`)}render()}

function save(){if(currentAccount){accounts[currentAccount]={loans,history,returnedCount};localStorage.setItem('readingRoomAccounts',JSON.stringify(accounts));}localStorage.setItem('readingRoomInventory',JSON.stringify(Object.fromEntries(books.map(book=>[book.id,book.copies]))));localStorage.setItem('readingRoomAddedBooks',JSON.stringify(books.filter(book=>book.addedByLibrarian)));}
function loadAccount(email){currentAccount=email.trim().toLowerCase();const data=accounts[currentAccount]||{loans:[],history:[],returnedCount:0};loans=data.loans;history=data.history;returnedCount=data.returnedCount;}
function notify(message){toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2600)}
function getBook(id){return books.find(book=>book.id===id)}
function loaned(id){return loans.some(item=>item.id===id)}
function coverMarkup(book){return `<div class="book-cover" style="background:linear-gradient(145deg,${book.accent}55,transparent 48%),${book.color}"><span class="cover-kicker">A NOVEL</span><span class="cover-title">${book.coverTitle}</span><span class="cover-author">${book.author.toUpperCase()}</span><span class="cover-ornament">✳</span></div>`}
function renderBooks(){
  const query=document.getElementById('search-input').value.trim().toLowerCase();
  const genre=document.getElementById('genre-filter').value;
  const found=books.filter(book=>{
    const matches=!query||`${book.title} ${book.author} ${book.genre}`.toLowerCase().includes(query);
    return matches&&(genre==='all'||book.genre===genre)&&(!availableOnly||book.copies>0);
  });
  document.getElementById('results-note').innerHTML=query||genre!=='all'||availableOnly?`${found.length} ${found.length===1?'book':'books'} to explore <span>✦</span>`:'A few good places to start <span>✦</span>';
  document.getElementById('empty-state').hidden=found.length>0;
  grid.innerHTML=found.map(book=>{
    const unavailable=book.copies===0;
    const isMine=loaned(book.id);
    const inHistory=history.some(entry=>entry.id===book.id);
    return `<article class="book-card"><div class="cover-wrap"><button class="cover-open-button" type="button" data-open-book="${book.id}" aria-label="Open ${book.title}">${coverMarkup(book)}<span class="cover-open-hint">OPEN BOOK ↗</span></button><span class="cover-badge ${unavailable?'unavailable':''}">${unavailable?'ON LOAN':'IN LIBRARY'}</span></div><div class="book-info"><span class="book-genre">${book.genre}</span><h3>${book.title}</h3><p class="book-author">${book.author}</p><div class="book-meta"><span class="rating"><b>★</b> ${book.rating}</span><span class="availability ${unavailable?'unavailable':''}">${unavailable?'Waitlist':`${book.copies} available`}</span></div><div class="book-actions">${isMine?`<button class="return-button" data-return="${book.id}">Return this book</button>`:`<button class="borrow-button" data-borrow="${book.id}" ${unavailable?'disabled':''}>${unavailable?'Currently borrowed':inHistory?'Borrow again':'Borrow book'}</button>`}</div></div></article>`;
  }).join('');
}
function renderLibraryShelves(){const shelf=document.getElementById('room-bookshelf');const rows=[books.slice(0,3),books.slice(3,6),books.slice(6,8)];shelf.innerHTML=rows.map((row,rowIndex)=>`<div class="shelf-row shelf-row-${rowIndex+1}"><div class="shelf-lip"></div><div class="shelf-planks"></div>${row.map((book,index)=>`<button class="shelf-book" type="button" data-open-book="${book.id}" aria-label="Take ${book.title} from shelf" style="--spine:${book.color};--spine-accent:${book.accent};--book-height:${88+(index*11+rowIndex*7)%30}px;--book-width:${29+(index*9)%17}px"><span class="spine-title">${book.title}</span><span class="spine-author">${book.author}</span><span class="spine-star">✳</span></button>`).join('')}<span class="shelf-plant-pot">✿</span></div>`).join('')}
function renderLoans(){
  const container=document.getElementById('loans-list');
  document.getElementById('loan-count').textContent=loans.length;
  document.getElementById('stat-borrowed').textContent=loans.length;
  document.getElementById('stat-returned').textContent=returnedCount;
  document.getElementById('stat-due').textContent=loans.length?Math.min(loans.length,1):0;
  if(!loans.length){container.innerHTML='<div class="empty-loans">Your bookshelf is clear. There’s room for a new story. ✦</div>'}
  else container.innerHTML=loans.slice(0,3).map(item=>{const book=getBook(item.id);if(!book)return'';return `<article class="loan-row"><div class="loan-mini-cover" style="background:linear-gradient(140deg,${book.accent}55,transparent 50%),${book.color}">${book.coverTitle.split(' ').slice(0,2).join(' ')}</div><div class="loan-copy"><strong>${book.title}</strong><span>${book.author}</span><div class="due-date">Due back ${item.due}</div></div><button class="return-button" data-return="${book.id}">Return</button></article>`}).join('');
  const historyList=document.getElementById('history-list');
  historyList.innerHTML=history.length?history.slice(0,4).map(item=>{const book=getBook(item.id);if(!book)return'';return `<article class="loan-row"><div class="loan-mini-cover" style="background:linear-gradient(140deg,${book.accent}55,transparent 50%),${book.color}">${book.coverTitle.split(' ').slice(0,2).join(' ')}</div><div class="loan-copy"><strong>${book.title}</strong><span>${book.author}</span><div class="due-date">Returned ${item.returned}</div></div><span class="history-check">✓ Read</span></article>`}).join(''):'<div class="empty-loans">Your completed reads will find a home here. ✦</div>';
}
async function borrow(id){const book=getBook(id);if(!signedIn){notify('Sign in to borrow a book.');return}if(currentRole!=='Student'){notify('Only students can borrow books.');return}if(!book||book.copies<1||loaned(id))return;try{await api(`/loans/${encodeURIComponent(id)}`,{method:'POST'});await loadServerData();notify(`“${book.title}” is on your bookshelf.`)}catch(error){notify(error.message)}}
async function returnBook(id){const book=getBook(id);if(!signedIn||!book||!loaned(id))return;try{await api(`/loans/${encodeURIComponent(id)}`,{method:'DELETE'});await loadServerData();notify(`“${book.title}” has been returned. Thanks!`)}catch(error){notify(error.message)}}
async function renderLibrarianTools(){const panel=document.getElementById('librarian-tools');panel.hidden=!(signedIn&&currentRole==='Librarian');if(panel.hidden)return;document.getElementById('staff-book-count').textContent=books.length;document.getElementById('staff-copy-count').textContent=books.reduce((sum,book)=>sum+book.total,0);document.getElementById('staff-available-count').textContent=books.reduce((sum,book)=>sum+book.copies,0);try{const allLoans=await api('/staff/loans');document.getElementById('staff-loan-count').textContent=allLoans.length;document.getElementById('staff-active-loans').innerHTML=allLoans.length?allLoans.slice(0,8).map(loan=>`<div class="staff-loan-row"><span><strong>${loan.title}</strong><small>${loan.email}</small></span><small>Due ${new Date(loan.due).toLocaleDateString()}</small></div>`).join(''):'<div class="empty-loans">No active loans across demo accounts.</div>'}catch(error){document.getElementById('staff-active-loans').textContent=error.message}}
function render(){renderBooks();renderLoans();renderLibraryShelves();renderLibrarianTools()}

document.getElementById('add-book-form').addEventListener('submit',async event=>{event.preventDefault();if(!(signedIn&&currentRole==='Librarian'))return;const title=document.getElementById('new-book-title').value.trim();const author=document.getElementById('new-book-author').value.trim();const genre=document.getElementById('new-book-genre').value;const copies=Number(document.getElementById('new-book-copies').value);try{await api('/books',{method:'POST',body:JSON.stringify({title,author,genre,copies})});event.currentTarget.reset();document.getElementById('new-book-copies').value='1';await loadServerData();notify(`“${title}” was added to the catalog.`)}catch(error){notify(error.message)}});

grid.addEventListener('click',event=>{const borrowButton=event.target.closest('[data-borrow]');const returnButton=event.target.closest('[data-return]');if(borrowButton)borrow(borrowButton.dataset.borrow);if(returnButton)returnBook(returnButton.dataset.return)});
grid.addEventListener('click',event=>{const opener=event.target.closest('[data-open-book]');if(opener)openBook(opener.dataset.openBook)});
document.getElementById('room-bookshelf').addEventListener('click',event=>{const spine=event.target.closest('[data-open-book]');if(spine){spine.classList.add('book-pulled');setTimeout(()=>openBook(spine.dataset.openBook),260)}});
document.getElementById('loans-list').addEventListener('click',event=>{const button=event.target.closest('[data-return]');if(button)returnBook(button.dataset.return)});
document.getElementById('search-input').addEventListener('input',renderBooks);
document.getElementById('genre-filter').addEventListener('change',renderBooks);
document.getElementById('availability-filter').addEventListener('click',event=>{availableOnly=!availableOnly;event.currentTarget.setAttribute('aria-pressed',String(availableOnly));renderBooks()});
document.getElementById('clear-search').addEventListener('click',()=>{document.getElementById('search-input').value='';document.getElementById('genre-filter').value='all';availableOnly=false;document.getElementById('availability-filter').setAttribute('aria-pressed','false');renderBooks()});
document.querySelector('[data-feature-borrow]').addEventListener('click',()=>{const featured=books.find(book=>book.title==='Tomorrow, and Tomorrow, and Tomorrow')||books[0];if(featured)borrow(featured.id)});
document.getElementById('browse-button').addEventListener('click',()=>{document.getElementById('catalog-section').scrollIntoView({behavior:'smooth'});document.getElementById('search-input').focus({preventScroll:true})});
const accountDialog=document.getElementById('account-dialog');
let signedIn=false;
document.getElementById('profile-button').addEventListener('click',()=>{
  const signedInName=document.querySelector('.profile-copy strong').textContent;
  document.getElementById('account-heading').innerHTML=signedIn?`Hello, ${signedInName.split(' ')[0]}.`:'Welcome to your<br />reading room.';
  document.getElementById('account-message').textContent=signedIn?'You are signed in to this demo library account.':'Sign in with your campus account to manage your books.';
  document.getElementById('login-form').hidden=signedIn;
  document.getElementById('account-mode-toggle').hidden=signedIn;
  document.getElementById('sign-out-button').hidden=!signedIn;
  accountDialog.showModal();
});
document.getElementById('sign-out-button').addEventListener('click',()=>{
  api('/logout',{method:'POST'}).catch(()=>{});apiToken='';localStorage.removeItem('readingRoomSession');
  signedIn=false;
  currentRole='Student';
  currentAccount=null;
  loans=[];history=[];returnedCount=0;
  document.querySelector('.profile-copy strong').textContent='Jamie Davis';
  document.querySelector('.avatar').textContent='JD';
  document.getElementById('role-label').textContent='Student · ID 20481';
  document.querySelector('.welcome-row h1').firstChild.textContent='Good morning, Jamie ';
  document.getElementById('login-form').reset();
  accountMode='login';syncAccountMode();
  accountDialog.close();
  render();
  notify('You have signed out.');
});
let openedBookId=null;let openedPage=0;let pageTurnTimer;
const storyPages={
  tomorrow:['A friendship, a game, and a lifetime of making things together. Step inside a story about creativity, connection, and the worlds we build.','Some stories are about the people who make things. This one asks what it means to make something with someone—and keep making it, across a lifetime.'],
  educated:['A young woman leaves a life in the mountains to find an education and a new way to understand her family and herself.','Memory becomes its own kind of classroom. With every new idea, the world she knew shifts—and so does the story she tells about herself.'],
  nightcircus:['A mysterious circus appears without warning. Behind its black-and-white tents, two young magicians are caught in a dazzling contest.','The circus is open only at night. Wander between its tents and you may find a garden made of ice, a cloud maze, or a story written just for you.'],
  silentpatient:['A celebrated painter stops speaking after a shocking act. One determined therapist sets out to understand the silence.','A diary surfaces. The truth shifts. Every quiet detail draws the reader a little deeper into the mystery.'],
  braiding:['Science, memory, and Indigenous knowledge meet in essays that invite us to look at the natural world with gratitude.','What does the earth ask of us? These pages offer a way to listen—to plants, to place, and to the histories rooted beneath our feet.'],
  midnight:['Between life and death sits a library of possible lives. One woman explores the paths she might have taken.','Every book opens onto a different possibility. Somewhere among them is a reason to return to the life already waiting.'],
  sapiens:['A sweeping journey through the history of humankind, from early ancestors to the forces shaping our present.','A grand lens on the habits, inventions, and shared stories that helped our species travel from the savannah to the stars.'],
  piranesi:['A solitary explorer maps an endless house of halls, statues, and tides—and begins to question what he knows.','The house is immense. The sea moves through its halls. Follow the journal entries and let its impossible architecture unfold.']
};
function showPreviewPage(){const book=getBook(openedBookId);if(!book)return;const pages=storyPages[book.id]||['A new world is waiting inside these pages.','Turn the page and stay a little longer.'];document.getElementById('opened-book-description').textContent=pages[openedPage];document.getElementById('page-number').textContent=`0${openedPage+1} / 0${pages.length}`;document.getElementById('turn-page-button').innerHTML=openedPage===0?'Turn the page <span>→</span>':'Back to the beginning <span>↶</span>';document.getElementById('book-dialog-caption').textContent=openedPage===0?'A good story is a doorway. Go on in.':'The deeper you go, the more the story opens.'}
function turnPreviewPage(){if(!openedBookId)return;const book=document.getElementById('open-book');book.classList.remove('page-flip');void book.offsetWidth;openedPage=openedPage===0?1:0;book.classList.add('page-flip');showPreviewPage();clearTimeout(pageTurnTimer);pageTurnTimer=setTimeout(()=>book.classList.remove('page-flip'),1200)}
function openBook(id){const book=getBook(id);if(!book)return;openedBookId=id;openedPage=0;const dialog=document.getElementById('book-dialog');document.getElementById('opened-book-title').textContent=book.title;document.getElementById('opened-book-author').textContent=`by ${book.author}`;document.getElementById('opened-cover-title').textContent=book.coverTitle;document.getElementById('opened-cover-author').textContent=book.author.toUpperCase();document.getElementById('opened-book-genre').textContent=book.genre.toUpperCase();document.getElementById('opened-book-rating').textContent=book.rating;document.getElementById('opened-book-copies').textContent=book.copies?`${book.copies} copies available`:'All copies are on loan';document.querySelector('.open-cover').style.background=`linear-gradient(145deg,${book.accent}55,transparent 48%),${book.color}`;showPreviewPage();const action=document.getElementById('opened-book-action');const mine=loaned(id);action.innerHTML=mine?'Return this book <span>↺</span>':'Borrow this book <span>→</span>';action.disabled=!mine&&book.copies===0;action.onclick=()=>{dialog.close();mine?returnBook(id):borrow(id)};const openBookElement=document.getElementById('open-book');openBookElement.classList.remove('is-open','page-flip');dialog.showModal();requestAnimationFrame(()=>requestAnimationFrame(()=>openBookElement.classList.add('is-open')))}
document.getElementById('turn-page-button').addEventListener('click',turnPreviewPage);
document.getElementById('help-button').addEventListener('click',()=>document.getElementById('info-dialog').showModal());
document.getElementById('notification-button').addEventListener('click',()=>notify(loans.length?`You have ${loans.length} books on your bookshelf.`:'You’re all caught up. Enjoy your day!'));
let accountMode='login';function syncAccountMode(){const creating=accountMode==='register';const registerRole=document.getElementById('register-role').value;const librarian=creating&&registerRole==='librarian';document.getElementById('full-name-field').hidden=!creating;document.getElementById('login-name').required=creating;document.getElementById('role-field').hidden=creating;document.getElementById('register-role-field').hidden=!creating;document.getElementById('librarian-code-field').hidden=!librarian;document.getElementById('librarian-code').required=librarian;document.getElementById('login-password').minLength=creating?8:0;document.getElementById('sign-in-button').innerHTML=creating?'Create account <span>→</span>':'Sign in <span>→</span>';document.getElementById('account-mode-toggle').textContent=creating?'Already have an account? Sign in':'Create an account';document.getElementById('account-note').textContent=librarian?'Enter the signup code provided by your library administrator.':'Librarian registration requires a code from the library administrator.'}
document.getElementById('register-role').addEventListener('change',syncAccountMode);
document.getElementById('account-mode-toggle').addEventListener('click',()=>{accountMode=accountMode==='login'?'register':'login';syncAccountMode()});
document.getElementById('login-form').addEventListener('submit',async event=>{event.preventDefault();const email=document.getElementById('login-email').value;const password=document.getElementById('login-password').value;try{let result;if(accountMode==='register'){const librarian=document.getElementById('register-role').value==='librarian';await api('/register',{method:'POST',body:JSON.stringify({email,password,fullName:document.getElementById('login-name').value.trim(),role:librarian?'librarian':'student',librarianCode:librarian?document.getElementById('librarian-code').value:undefined})});accountMode='login';document.getElementById('login-role').value=librarian?'Librarian':'Student';syncAccountMode();notify('Account created. Sign in with your new credentials.');return}else{result=await api('/login',{method:'POST',body:JSON.stringify({email,password,role:document.getElementById('login-role').value})})}apiToken=result.token;localStorage.setItem('readingRoomSession',apiToken);await loadServerData();const name=result.user.full_name;document.querySelector('.welcome-row h1').firstChild.textContent=`Good morning, ${name.split(' ')[0]} `;accountDialog.close();notify(`Welcome to the library, ${name.split(' ')[0]}.`)}catch(error){notify(error.message)}});
document.querySelectorAll('[data-view]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();const view=link.dataset.view;activeView=view;document.querySelectorAll('.nav-link').forEach(item=>item.classList.toggle('active',item.dataset.view===view));const section=view==='loans'?'loans-section':view==='history'?'history-section':view==='catalog'?'catalog-section':view==='library'?'library-section':'home';document.getElementById('breadcrumb-current').textContent=view==='discover'?'Discover':view==='catalog'?'Book catalog':view==='library'?'Visit the library':view==='history'?'Reading history':'My books';document.getElementById(section).scrollIntoView({behavior:'smooth'});document.getElementById('sidebar').classList.remove('open') }));
document.getElementById('menu-toggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.getElementById('search-input').focus()}});
loadServerData();
