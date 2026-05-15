// ═══════════════════════════════════════════════════════════
//  SUDOKU ULTIMATE — app.js
// ═══════════════════════════════════════════════════════════

// ── DIFFICULTY ───────────────────────────────────────────────
const DIFF = {
  easy:   { clues:46, label:'FACILE',    maxErr:5, blitz:600 },
  medium: { clues:32, label:'MOYEN',     maxErr:4, blitz:420 },
  hard:   { clues:24, label:'DIFFICILE', maxErr:3, blitz:300 },
};

// ── STATE ────────────────────────────────────────────────────
const G = {
  difficulty:'easy', gameMode:'normal',
  solution:[], puzzle:[], board:[], notes:[], given:[], selected:-1,
  notesMode:false, errors:0, maxErrors:3, hints:3,
  started:false, finished:false,
  timerSec:0, timerIv:null,
  blitzSec:600, blitzIv:null,
  history:[], techCells:[],
  soundOn:true, musicOn:false,
  cellTimes:[], // ms each cell took
  cellStartTime:null,
  stats: JSON.parse(localStorage.getItem('sudoku_v2_stats')||'{"played":0,"wins":0,"streak":0,"top5":{"easy":[],"medium":[],"hard":[]}}'),
};

// ── AUDIO ────────────────────────────────────────────────────
const AC = new (window.AudioContext||window.webkitAudioContext)();
let musicNode = null;

function beep(freq, dur, type='sine', vol=0.08) {
  if (!G.soundOn) return;
  try {
    AC.resume();
    const o=AC.createOscillator(), g=AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime+dur);
    o.start(); o.stop(AC.currentTime+dur);
  } catch(e){}
}
function playClick()   { beep(600,.05,'square',.05); }
function playError()   { beep(180,.18,'sawtooth',.08); }
function playHint()    { beep(880,.08,'sine',.06); setTimeout(()=>beep(1100,.12,'sine',.05),80); }
function playWin()     { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.2,'sine',.07),i*120)); }
function playComplete(){ beep(440,.06,'sine',.05); }

function startAmbience() {
  if (!G.musicOn || musicNode) return;
  try {
    AC.resume();
    const buf = AC.createBuffer(1, AC.sampleRate*4, AC.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<data.length; i++) data[i]=(Math.random()*2-1)*0.003;
    musicNode = AC.createBufferSource();
    musicNode.buffer = buf;
    musicNode.loop = true;
    const g = AC.createGain(); g.gain.value=0.15;
    musicNode.connect(g); g.connect(AC.destination);
    musicNode.start();
  } catch(e){}
}
function stopAmbience() { if(musicNode){ try{musicNode.stop();}catch(e){} musicNode=null; } }

function toggleSound() {
  G.soundOn=!G.soundOn;
  document.getElementById('sound-badge').textContent=G.soundOn?'ON':'OFF';
  document.getElementById('sound-badge').className=G.soundOn?'badge on':'badge';
}
function toggleMusic() {
  G.musicOn=!G.musicOn;
  document.getElementById('music-badge').textContent=G.musicOn?'ON':'OFF';
  document.getElementById('music-badge').className=G.musicOn?'badge on':'badge';
  G.musicOn ? startAmbience() : stopAmbience();
}

// ── GENERATOR ────────────────────────────────────────────────
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a; }
function isValid(grid,idx,num){
  const r=Math.floor(idx/9),c=idx%9,br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let i=0;i<9;i++){
    if(grid[r*9+i]===num)return false;
    if(grid[i*9+c]===num)return false;
    if(grid[(br+Math.floor(i/3))*9+bc+(i%3)]===num)return false;
  }
  return true;
}
function solve(grid,rand=false){
  const e=grid.indexOf(0); if(e===-1)return true;
  const nums=rand?shuffle([1,2,3,4,5,6,7,8,9]):[1,2,3,4,5,6,7,8,9];
  for(const n of nums){ if(isValid(grid,e,n)){ grid[e]=n; if(solve(grid,rand))return true; grid[e]=0; } }
  return false;
}
function countSolutions(grid,lim=2){ const e=grid.indexOf(0); if(e===-1)return 1; let c=0; for(let n=1;n<=9;n++){if(isValid(grid,e,n)){grid[e]=n;c+=countSolutions(grid,lim);grid[e]=0;if(c>=lim)return c;}} return c; }
function generatePuzzle(clues){
  const sol=new Array(81).fill(0); solve(sol,true);
  const puz=[...sol]; let removed=0; const target=81-clues;
  for(const idx of shuffle([...Array(81).keys()])){
    if(removed>=target)break;
    const bk=puz[idx]; puz[idx]=0;
    if(countSolutions([...puz])===1) removed++;
    else puz[idx]=bk;
  }
  return{solution:sol,puzzle:puz};
}

// ── CANDIDATES (learn mode) ───────────────────────────────────
function getCandidates(board,idx){
  if(board[idx]!==0)return new Set();
  const cands=new Set([1,2,3,4,5,6,7,8,9]);
  const r=Math.floor(idx/9),c=idx%9,br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let i=0;i<9;i++){
    cands.delete(board[r*9+i]);
    cands.delete(board[i*9+c]);
    cands.delete(board[(br+Math.floor(i/3))*9+bc+(i%3)]);
  }
  return cands;
}

// ── GAME INIT ────────────────────────────────────────────────
function newGame(){
  stopTimer(); stopBlitz(); clearTechHighlight();
  G.errors=0; G.hints=3; G.selected=-1; G.notesMode=false;
  G.started=false; G.finished=false; G.timerSec=0; G.history=[];
  G.cellTimes=[]; G.cellStartTime=null;
  document.getElementById('timer').textContent='00:00';
  document.getElementById('timer').classList.remove('blitz-warn');
  document.getElementById('analysis-wrap').style.display='none';

  const diff=DIFF[G.difficulty];
  G.maxErrors=diff.maxErr;
  G.blitzSec=diff.blitz;
  document.getElementById('diff-label').textContent=diff.label;

  // check for saved share code in URL
  const params=new URLSearchParams(location.search);
  const code=params.get('grid');
  if(code&&code.length===81&&/^[0-9]+$/.test(code)){
    loadFromCode(code); history.replaceState({},'',location.pathname); return;
  }

  const{solution,puzzle}=generatePuzzle(diff.clues);
  G.solution=solution; G.puzzle=puzzle;
  G.board=[...puzzle]; G.given=puzzle.map(v=>v!==0);
  G.notes=Array.from({length:81},()=>new Set());

  buildDots(); updateNotesBtn(); updateHints(); updateErrors();
  updateProgress(); renderGrid(); renderNumpad();
  updateStats(); renderTop5(); renderProgressChart();
  if(G.musicOn)startAmbience();
}

function loadFromCode(code){
  const puzzle=code.split('').map(Number);
  const sol=[...puzzle]; solve(sol);
  G.solution=sol; G.puzzle=puzzle;
  G.board=[...puzzle]; G.given=puzzle.map(v=>v!==0);
  G.notes=Array.from({length:81},()=>new Set());
  buildDots(); updateNotesBtn(); updateHints(); updateErrors();
  updateProgress(); renderGrid(); renderNumpad();
}

// ── TIMER ────────────────────────────────────────────────────
function startTimer(){
  if(G.timerIv)return;
  G.timerIv=setInterval(()=>{
    G.timerSec++;
    document.getElementById('timer').textContent=fmt(G.timerSec);
  },1000);
}
function stopTimer(){ clearInterval(G.timerIv); G.timerIv=null; }
function fmt(s){ return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

// ── BLITZ ────────────────────────────────────────────────────
function startBlitz(){
  if(G.gameMode!=='blitz'||G.blitzIv)return;
  const wrap=document.getElementById('blitz-bar-wrap');
  wrap.style.display='block';
  const total=DIFF[G.difficulty].blitz;
  G.blitzIv=setInterval(()=>{
    G.blitzSec--;
    const pct=G.blitzSec/total*100;
    const bar=document.getElementById('blitz-bar');
    bar.style.width=pct+'%';
    bar.style.background=pct>40?'var(--accent)':pct>20?'var(--gold)':'#e74c3c';
    document.getElementById('timer').classList.toggle('blitz-warn',pct<25);
    if(G.blitzSec<=0){ clearInterval(G.blitzIv); G.blitzIv=null; gameOver('Temps écoulé !'); }
  },1000);
}
function stopBlitz(){
  clearInterval(G.blitzIv); G.blitzIv=null;
  document.getElementById('blitz-bar-wrap').style.display='none';
}

// ── RENDER GRID ──────────────────────────────────────────────
function renderGrid(){
  const grid=document.getElementById('grid'); grid.innerHTML='';
  for(let i=0;i<81;i++){
    const r=Math.floor(i/9),c=i%9;
    const cell=document.createElement('div');
    cell.className='cell'; cell.dataset.i=i; cell.dataset.row=r; cell.dataset.col=c;
    cell.onclick=()=>selectCell(i);
    updateCellEl(cell,i);
    grid.appendChild(cell);
  }
  applySelection();
}

function updateCellEl(cell,i){
  cell.innerHTML='';
  const val=G.board[i];
  cell.classList.remove('given','user-input','user-error');

  if(val!==0){
    const span=document.createElement('span');
    span.className='cell-num'; span.textContent=val;
    cell.appendChild(span);
    if(G.given[i]) cell.classList.add('given');
    else if(val!==G.solution[i]) cell.classList.add('user-error');
    else cell.classList.add('user-input');
  } else {
    // Learn mode: show all candidates
    if(G.gameMode==='learn'){
      const cands=getCandidates(G.board,i);
      const ng=document.createElement('div'); ng.className='candidates-grid';
      for(let n=1;n<=9;n++){
        const nd=document.createElement('div'); nd.className='candidate';
        nd.textContent=cands.has(n)?n:''; ng.appendChild(nd);
      }
      cell.appendChild(ng);
    }
    // Notes
    const notes=G.notes[i];
    if(notes.size>0&&G.gameMode!=='learn'){
      const ng=document.createElement('div'); ng.className='notes-grid';
      for(let n=1;n<=9;n++){
        const nd=document.createElement('div'); nd.className='note';
        nd.textContent=notes.has(n)?n:''; ng.appendChild(nd);
      }
      cell.appendChild(ng);
    }
  }
}

function refreshCell(i){
  const cell=document.querySelector(`.cell[data-i="${i}"]`);
  if(cell){ updateCellEl(cell,i); applySelection(); }
}

function refreshAllCells(){ for(let i=0;i<81;i++) refreshCell(i); }

function applySelection(){
  const cells=document.querySelectorAll('.cell'); const sel=G.selected;
  cells.forEach(c=>c.classList.remove('selected','peer','same-num','error'));
  if(sel<0)return;
  const sr=Math.floor(sel/9),sc=sel%9,sb=Math.floor(sr/3)*3+Math.floor(sc/3);
  const sv=G.board[sel];
  cells.forEach(cell=>{
    const i=+cell.dataset.i,r=Math.floor(i/9),c=i%9,b=Math.floor(r/3)*3+Math.floor(c/3);
    if(i===sel) cell.classList.add('selected');
    else if(r===sr||c===sc||b===sb) cell.classList.add('peer');
    if(sv!==0&&G.board[i]===sv&&i!==sel) cell.classList.add('same-num');
  });
}

// ── NUMPAD ───────────────────────────────────────────────────
function renderNumpad(){
  const numpad=document.getElementById('numpad'); numpad.innerHTML='';
  for(let n=1;n<=9;n++){
    const btn=document.createElement('button'); btn.className='num-btn'; btn.dataset.n=n;
    btn.onclick=()=>inputNumber(n);
    const placed=G.board.filter(v=>v===n).length;
    btn.innerHTML=`<span>${n}</span><span class="num-count">${placed<9?9-placed:''}</span>`;
    if(placed>=9)btn.classList.add('exhausted');
    numpad.appendChild(btn);
  }
}

// ── INPUT ────────────────────────────────────────────────────
function selectCell(i){
  if(G.cellStartTime!==null) G.cellTimes.push(Date.now()-G.cellStartTime);
  G.selected=i; G.cellStartTime=Date.now();
  if(!G.started&&!G.finished){ G.started=true; startTimer(); startBlitz(); }
  applySelection(); playClick();
}

function inputNumber(num){
  const i=G.selected;
  if(i<0||G.given[i]||G.finished)return;
  if(!G.started){ G.started=true; startTimer(); startBlitz(); }

  if(G.notesMode){
    G.history.push({i,prevVal:G.board[i],prevNotes:new Set(G.notes[i])});
    G.notes[i].has(num)?G.notes[i].delete(num):G.notes[i].add(num);
    refreshCell(i); return;
  }

  const prev=G.board[i];
  G.history.push({i,prevVal:prev,prevNotes:new Set(G.notes[i])});
  G.board[i]=num; G.notes[i].clear();
  autoRemoveNotes(i,num);
  refreshCell(i); renderNumpad();

  if(num!==G.solution[i]){
    G.errors++; updateErrors(); shakeCell(i); playError();
    if(G.gameMode!=='zen'&&G.errors>=G.maxErrors){ gameOver('Trop d\'erreurs !'); return; }
  } else {
    flashComplete(i); playComplete();
  }
  updateProgress(); checkWin();
}

function autoRemoveNotes(idx,num){
  const r=Math.floor(idx/9),c=idx%9,br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let i=0;i<9;i++){
    G.notes[r*9+i].delete(num); G.notes[i*9+c].delete(num);
    G.notes[(br+Math.floor(i/3))*9+bc+(i%3)].delete(num);
  }
}

function autoNotes(){
  if(G.finished)return;
  G.history.push({mass:true,snapshot:G.notes.map(s=>new Set(s))});
  for(let i=0;i<81;i++){
    if(G.board[i]===0) G.notes[i]=getCandidates(G.board,i);
    else G.notes[i]=new Set();
  }
  refreshAllCells();
}

function clearCell(){
  const i=G.selected;
  if(i<0||G.given[i]||G.finished)return;
  G.history.push({i,prevVal:G.board[i],prevNotes:new Set(G.notes[i])});
  G.board[i]=0; G.notes[i].clear();
  refreshCell(i); renderNumpad(); updateProgress();
}

function undoMove(){
  if(!G.history.length)return;
  const h=G.history.pop();
  if(h.mass){ G.notes=h.snapshot.map(s=>new Set(s)); refreshAllCells(); return; }
  G.board[h.i]=h.prevVal; G.notes[h.i]=h.prevNotes;
  refreshCell(h.i); renderNumpad(); updateProgress(); applySelection();
}

// ── KEYBOARD ─────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(document.getElementById('modal').classList.contains('show')) return;
  if(document.getElementById('import-modal').classList.contains('show')) return;
  if(e.key>='1'&&e.key<='9'){inputNumber(+e.key);return;}
  switch(e.key){
    case 'Backspace':case 'Delete': clearCell();break;
    case 'z':case 'Z': undoMove();break;
    case 'n':case 'N': toggleNotes();break;
    case 'a':case 'A': autoNotes();break;
    case 'h':case 'H': useHint();break;
    case 't':case 'T': highlightTechnique();break;
    case 'ArrowUp':    navigate(-9);e.preventDefault();break;
    case 'ArrowDown':  navigate(+9);e.preventDefault();break;
    case 'ArrowLeft':  navigate(-1);e.preventDefault();break;
    case 'ArrowRight': navigate(+1);e.preventDefault();break;
  }
});
function navigate(d){ if(G.selected<0){selectCell(0);return;} const n=G.selected+d; if(n>=0&&n<81)selectCell(n); }

// ── NOTES MODE ───────────────────────────────────────────────
function toggleNotes(){
  G.notesMode=!G.notesMode; updateNotesBtn();
}
function updateNotesBtn(){
  const b=document.getElementById('notes-badge');
  b.textContent=G.notesMode?'ON':'OFF'; b.className=G.notesMode?'badge on':'badge';
  const mob=document.getElementById('mob-notes-btn');
  if(mob) mob.classList.toggle('active',G.notesMode);
}

// ── HINTS ────────────────────────────────────────────────────
function useHint(){
  if(G.hints<=0||G.finished)return;
  const cands=[];
  for(let i=0;i<81;i++) if(!G.given[i]&&G.board[i]!==G.solution[i]) cands.push(i);
  if(!cands.length)return;
  let t=cands[Math.floor(Math.random()*cands.length)];
  if(G.selected>=0&&cands.includes(G.selected)) t=G.selected;
  G.hints--; G.board[t]=G.solution[t]; G.notes[t].clear();
  autoRemoveNotes(t,G.solution[t]); G.given[t]=true;
  G.selected=t; refreshCell(t); applySelection(); renderNumpad();
  updateHints(); updateProgress(); flashHint(t); playHint(); checkWin();
}
function updateHints(){ document.getElementById('hints-left').textContent=G.hints; }

// ── TECHNIQUE HIGHLIGHTER ────────────────────────────────────
function highlightTechnique(){
  clearTechHighlight();
  // 1. Naked Single: a cell with only one candidate
  for(let i=0;i<81;i++){
    if(G.board[i]!==0||G.given[i])continue;
    const cands=getCandidates(G.board,i);
    if(cands.size===1){
      showTech([i],`Singleton nu — case (${Math.floor(i/9)+1},${i%9+1}) : seul candidat possible = ${[...cands][0]}`);
      return;
    }
  }
  // 2. Hidden Single: a number can go only in one cell in a unit
  const units=[];
  for(let r=0;r<9;r++) units.push([...Array(9).keys()].map(c=>r*9+c));
  for(let c=0;c<9;c++) units.push([...Array(9).keys()].map(r=>r*9+c));
  for(let br=0;br<3;br++) for(let bc=0;bc<3;bc++){
    const cells=[];
    for(let r=0;r<3;r++) for(let c=0;c<3;c++) cells.push((br*3+r)*9+bc*3+c);
    units.push(cells);
  }
  for(const unit of units){
    for(let n=1;n<=9;n++){
      const possible=unit.filter(i=>G.board[i]===0&&isValid(G.board,i,n));
      if(possible.length===1){
        showTech(possible,`Singleton caché — le ${n} ne peut aller qu'ici dans cette unité`);
        return;
      }
    }
  }
  // 3. Naked Pair hint
  showTech([],'Aucune technique simple détectée. Essaie les indices (💡) !');
}

function showTech(cells,msg){
  G.techCells=cells;
  cells.forEach(i=>{
    const cell=document.querySelector(`.cell[data-i="${i}"]`);
    if(cell)cell.classList.add('tech-hl');
  });
  const ban=document.getElementById('technique-banner');
  document.getElementById('technique-text').textContent=msg;
  ban.style.display='flex';
}

function clearTechHighlight(){
  G.techCells.forEach(i=>{
    const cell=document.querySelector(`.cell[data-i="${i}"]`);
    if(cell)cell.classList.remove('tech-hl');
  });
  G.techCells=[];
  document.getElementById('technique-banner').style.display='none';
}

// ── VALIDATE ─────────────────────────────────────────────────
function validatePuzzle(){
  let ok=true;
  document.querySelectorAll('.cell').forEach(cell=>{
    cell.classList.remove('error');
    const i=+cell.dataset.i;
    if(!G.given[i]&&G.board[i]!==0&&G.board[i]!==G.solution[i]){ cell.classList.add('error'); ok=false; }
  });
  if(ok) document.querySelectorAll('.cell.user-input').forEach(c=>{c.classList.add('hint-flash');setTimeout(()=>c.classList.remove('hint-flash'),600);});
}

// ── REVEAL ───────────────────────────────────────────────────
function revealSolution(){
  if(!confirm('Révéler la solution ? Cela terminera la partie sans victoire.'))return;
  stopTimer(); stopBlitz(); G.finished=true;
  for(let i=0;i<81;i++){G.board[i]=G.solution[i];G.given[i]=true;}
  renderGrid(); updateProgress();
}

// ── WIN / LOSE ───────────────────────────────────────────────
function checkWin(){
  for(let i=0;i<81;i++) if(G.board[i]!==G.solution[i])return;
  win();
}

function win(){
  stopTimer(); stopBlitz(); G.finished=true;
  playWin(); launchConfetti();
  G.stats.played++; G.stats.wins++; G.stats.streak++;
  const t=G.timerSec;
  const top=G.stats.top5[G.difficulty];
  top.push(t); top.sort((a,b)=>a-b); if(top.length>5)top.splice(5);
  const isRecord=top[0]===t&&top.filter(v=>v===t).length===1;
  saveStats(); updateStats(); renderTop5(); renderProgressChart();
  showAnalysis();
  const diff=DIFF[G.difficulty];
  document.getElementById('modal-emoji').textContent=isRecord?'🏆':'🎉';
  document.getElementById('modal-title').textContent=isRecord?'Record !':'Bravo !';
  document.getElementById('modal-subtitle').textContent=`${diff.label} — ${fmt(t)}`;
  document.getElementById('modal-stats').innerHTML=`
    <div class="modal-stat"><div class="modal-stat-val">${fmt(t)}</div><div class="modal-stat-label">Temps</div></div>
    <div class="modal-stat"><div class="modal-stat-val">${G.errors}</div><div class="modal-stat-label">Erreurs</div></div>
    <div class="modal-stat"><div class="modal-stat-val">${3-G.hints}</div><div class="modal-stat-label">Indices</div></div>
  `;
  document.getElementById('modal').classList.add('show');
}

function gameOver(reason){
  stopTimer(); stopBlitz(); G.finished=true;
  G.stats.played++; G.stats.streak=0; saveStats(); updateStats();
  document.getElementById('modal-emoji').textContent='💀';
  document.getElementById('modal-title').textContent='Perdu !';
  document.getElementById('modal-subtitle').textContent=reason||'Partie terminée';
  document.getElementById('modal-stats').innerHTML=`
    <div class="modal-stat"><div class="modal-stat-val">${fmt(G.timerSec)}</div><div class="modal-stat-label">Temps</div></div>
    <div class="modal-stat"><div class="modal-stat-val">${G.errors}</div><div class="modal-stat-label">Erreurs</div></div>
    <div class="modal-stat"><div class="modal-stat-val">—</div><div class="modal-stat-label">Victoire</div></div>
  `;
  document.getElementById('modal').classList.add('show');
}

function closeModal(){ document.getElementById('modal').classList.remove('show'); }

// ── POST-GAME ANALYSIS ───────────────────────────────────────
function showAnalysis(){
  const wrap=document.getElementById('analysis-wrap');
  const grid=document.getElementById('analysis-grid');
  const totalCells=81-G.given.filter(Boolean).length;
  const avgTime=G.cellTimes.length>0?Math.round(G.cellTimes.reduce((a,b)=>a+b,0)/G.cellTimes.length/1000):0;
  grid.innerHTML=`
    <div class="analysis-stat"><div class="analysis-stat-val">${fmt(G.timerSec)}</div><div class="analysis-stat-label">Durée totale</div></div>
    <div class="analysis-stat"><div class="analysis-stat-val">${G.errors}</div><div class="analysis-stat-label">Erreurs commises</div></div>
    <div class="analysis-stat"><div class="analysis-stat-val">${avgTime}s</div><div class="analysis-stat-label">Temps/case moy.</div></div>
    <div class="analysis-stat"><div class="analysis-stat-val">${totalCells}</div><div class="analysis-stat-label">Cases remplies</div></div>
    <div class="analysis-stat"><div class="analysis-stat-val">${3-G.hints}</div><div class="analysis-stat-label">Indices utilisés</div></div>
    <div class="analysis-stat"><div class="analysis-stat-val">${G.notesMode?'Oui':'Non'}</div><div class="analysis-stat-label">Notes utilisées</div></div>
  `;
  wrap.style.display='block';
}

// ── ANIMATIONS ───────────────────────────────────────────────
const shakeStyle=document.createElement('style');
shakeStyle.textContent=`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}`;
document.head.appendChild(shakeStyle);

function shakeCell(i){ const c=document.querySelector(`.cell[data-i="${i}"]`); if(!c)return; c.style.animation='none'; c.offsetHeight; c.style.animation='shake .3s ease'; setTimeout(()=>c.style.animation='',300); }
function flashHint(i){ const c=document.querySelector(`.cell[data-i="${i}"]`); if(!c)return; c.classList.add('hint-flash'); setTimeout(()=>c.classList.remove('hint-flash'),600); }
function flashComplete(i){ const c=document.querySelector(`.cell[data-i="${i}"]`); if(!c)return; c.classList.add('complete-flash'); setTimeout(()=>c.classList.remove('complete-flash'),350); }

// ── CONFETTI ─────────────────────────────────────────────────
function launchConfetti(){
  const canvas=document.getElementById('confetti-canvas');
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  const ctx=canvas.getContext('2d');
  const cols=['#c0392b','#c9a84c','#2c5f8a','#27ae60','#8e44ad','#e67e22'];
  const pieces=Array.from({length:100},()=>({x:Math.random()*canvas.width,y:-10,r:Math.random()*6+2,c:cols[Math.floor(Math.random()*cols.length)],vy:Math.random()*4+2,vx:(Math.random()-.5)*3,rot:Math.random()*360,vr:(Math.random()-.5)*5}));
  let fr=0;
  function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height); pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);ctx.fillStyle=p.c;ctx.fillRect(-p.r,-p.r,p.r*2,p.r*.6);ctx.restore();}); fr++; if(fr<130)requestAnimationFrame(draw); else ctx.clearRect(0,0,canvas.width,canvas.height); }
  draw();
}

// ── UI UPDATES ───────────────────────────────────────────────
function buildDots(){
  const el=document.getElementById('error-dots'); el.innerHTML='';
  for(let i=0;i<G.maxErrors;i++){ const d=document.createElement('span'); d.className='dot'; el.appendChild(d); }
}
function updateErrors(){
  document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i<G.errors));
  document.getElementById('error-count').textContent=`${G.errors} / ${G.maxErrors}`;
}
function updateProgress(){
  const corr=G.board.filter((v,i)=>v!==0&&v===G.solution[i]).length;
  const giv=G.given.filter(Boolean).length;
  const pct=Math.round(Math.max(0,corr-giv)/(81-giv)*100);
  document.getElementById('progress-pct').textContent=pct+'%';
  document.getElementById('pr-fill').style.strokeDashoffset=213.6-(pct/100*213.6);
}
function updateStats(){
  const{played,wins,streak}=G.stats;
  document.getElementById('st-played').textContent=played;
  document.getElementById('st-wins').textContent=wins;
  document.getElementById('st-streak').textContent=streak;
  document.getElementById('st-rate').textContent=played>0?Math.round(wins/played*100)+'%':'—';
}
function renderTop5(){
  ['easy','medium','hard'].forEach(d=>{
    const el=document.getElementById(`top5-${d}-list`);
    const times=G.stats.top5[d];
    el.innerHTML=times.length?times.map((t,i)=>`<div class="best-row"><span>#${i+1}</span><span>${fmt(t)}</span></div>`).join(''):'<div class="best-row"><span>—</span><span>—</span></div>';
  });
}
function renderProgressChart(){
  const canvas=document.getElementById('progress-chart');
  const ctx=canvas.getContext('2d');
  const allTimes=[...G.stats.top5.easy,...G.stats.top5.medium,...G.stats.top5.hard].sort((a,b)=>a-b).slice(0,10);
  canvas.width=canvas.offsetWidth||180; canvas.height=90;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(allTimes.length<2){ctx.fillStyle='var(--ink3)';ctx.font='10px DM Mono,monospace';ctx.fillText('Joue plus de parties !',8,45);return;}
  const max=Math.max(...allTimes),min=Math.min(...allTimes),w=canvas.width,h=canvas.height,pad=8;
  const pts=allTimes.map((t,i)=>({x:pad+i/(allTimes.length-1)*(w-pad*2),y:pad+(t-min)/(max-min||1)*(h-pad*2)}));
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'rgba(192,57,43,.3)'); grad.addColorStop(1,'rgba(192,57,43,.0)');
  ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
  ctx.strokeStyle='var(--accent)'; ctx.lineWidth=2; ctx.stroke();
  ctx.lineTo(w-pad,h); ctx.lineTo(pad,h); ctx.fillStyle=grad; ctx.fill();
  pts.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fillStyle='var(--accent)'; ctx.fill(); });
}
function saveStats(){ localStorage.setItem('sudoku_v2_stats',JSON.stringify(G.stats)); }

// ── THEME ────────────────────────────────────────────────────
function setTheme(t){
  document.documentElement.dataset.theme=t;
  document.querySelectorAll('.theme-pill').forEach(p=>p.classList.toggle('active',p.dataset.t===t));
  localStorage.setItem('sudoku_v2_theme',t);
  renderProgressChart();
}

// ── CONFIG ───────────────────────────────────────────────────
function setDiff(d){
  G.difficulty=d;
  document.querySelectorAll('.diff-btn[data-d]').forEach(b=>b.classList.toggle('active',b.dataset.d===d));
  newGame();
}
function setGameMode(m){
  G.gameMode=m;
  document.querySelectorAll('.diff-btn[data-m]').forEach(b=>b.classList.toggle('active',b.dataset.m===m));
  newGame();
}

// ── SAVE / LOAD ──────────────────────────────────────────────
function saveGame(){
  const save={board:G.board,notes:G.notes.map(s=>[...s]),given:G.given,solution:G.solution,puzzle:G.puzzle,errors:G.errors,hints:G.hints,timerSec:G.timerSec,difficulty:G.difficulty,gameMode:G.gameMode};
  localStorage.setItem('sudoku_v2_save',JSON.stringify(save));
  flashBanner('💾 Partie sauvegardée !');
}
function loadGame(){
  const raw=localStorage.getItem('sudoku_v2_save');
  if(!raw){flashBanner('Aucune sauvegarde trouvée.');return;}
  const s=JSON.parse(raw);
  stopTimer(); stopBlitz();
  Object.assign(G,{board:s.board,given:s.given,solution:s.solution,puzzle:s.puzzle,errors:s.errors,hints:s.hints,timerSec:s.timerSec,difficulty:s.difficulty,gameMode:s.gameMode,notes:s.notes.map(a=>new Set(a)),selected:-1,notesMode:false,started:false,finished:false,history:[]});
  document.getElementById('timer').textContent=fmt(G.timerSec);
  document.getElementById('diff-label').textContent=DIFF[G.difficulty].label;
  setDiff(G.difficulty); // updates buttons without newGame
  buildDots(); updateNotesBtn(); updateHints(); updateErrors(); updateProgress();
  renderGrid(); renderNumpad(); flashBanner('📂 Partie reprise !');
}

function flashBanner(msg){
  const ban=document.getElementById('technique-banner');
  document.getElementById('technique-text').textContent=msg;
  ban.style.display='flex'; setTimeout(()=>ban.style.display='none',2500);
}

// ── IMPORT / SHARE ───────────────────────────────────────────
function openImport(){ document.getElementById('import-modal').classList.add('show'); }
function closeImport(){ document.getElementById('import-modal').classList.remove('show'); }
function doImport(){
  const raw=document.getElementById('import-input').value.replace(/\D/g,'');
  if(raw.length!==81){alert('La grille doit contenir exactement 81 chiffres.');return;}
  closeImport(); loadFromCode(raw); G.started=false; G.finished=false; G.errors=0; G.hints=3;
  buildDots(); updateHints(); updateErrors(); updateProgress(); renderNumpad();
}

function shareGrid(){
  const code=G.puzzle.join('');
  document.getElementById('share-code').textContent=code;
  document.getElementById('share-modal').classList.add('show');
}
function closeShare(){ document.getElementById('share-modal').classList.remove('show'); }
function copyShareCode(){
  const code=G.puzzle.join('');
  navigator.clipboard.writeText(code).then(()=>{ document.getElementById('share-code').textContent='✓ Copié !'; setTimeout(()=>{ document.getElementById('share-code').textContent=code; },1500); });
}

// Close modals on overlay click
document.getElementById('import-modal').onclick=closeImport;
document.getElementById('share-modal').onclick=closeShare;
document.getElementById('modal').onclick=closeModal;

// ── INIT ─────────────────────────────────────────────────────
(()=>{
  const savedTheme=localStorage.getItem('sudoku_v2_theme')||'paper';
  setTheme(savedTheme);
  updateStats(); renderTop5();
  newGame();
})();
