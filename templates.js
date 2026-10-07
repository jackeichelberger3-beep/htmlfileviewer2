// Each template: { name, category, icon, description, data: { html, css, js } }
export const templates = [
  {
    name: "HTML5 Boilerplate", category: "HTML", icon: "H", description: "A clean HTML5 starter document.",
    data: {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
</head>
<body>
  <h1>Hello, World!</h1>
  <p>Start building something great.</p>
</body>
</html>`,
      css: "", js: ""
    }
  },
  {
    name: "CSS Reset", category: "CSS", icon: "C", description: "Modern CSS reset for consistent styling.",
    data: {
      html: `<h1>Reset Applied</h1>
<p>Consistent margins and box-sizing across browsers.</p>`,
      css: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; line-height: 1.6; padding: 2rem; }
h1 { margin-bottom: 1rem; }`,
      js: ""
    }
  },
  {
    name: "JavaScript Starter", category: "JS", icon: "J", description: "DOM-ready JavaScript with a console log.",
    data: {
      html: `<button id="btn">Click me</button>
<p id="out">0 clicks</p>`,
      css: `body { font-family: sans-serif; padding: 2rem; }
button { padding: .5rem 1rem; }`,
      js: `let count = 0;
const btn = document.getElementById('btn');
const out = document.getElementById('out');
btn.addEventListener('click', () => {
  count++;
  out.textContent = count + ' clicks';
  console.log('Clicked', count);
});
console.log('Script loaded');`
    }
  },
  {
    name: "Landing Page", category: "Page", icon: "L", description: "A simple hero landing page.",
    data: {
      html: `<header class="hero">
  <h1>Build the future</h1>
  <p>A modern starting point for your product.</p>
  <button>Get Started</button>
</header>`,
      css: `body { margin: 0; font-family: system-ui, sans-serif; }
.hero { min-height: 90vh; display: grid; place-items: center; text-align: center;
  background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 2rem; }
.hero h1 { font-size: 3rem; margin-bottom: 1rem; }
.hero button { margin-top: 1rem; padding: .8rem 2rem; border: 0; border-radius: 999px;
  background: #fff; color: #333; font-weight: 600; cursor: pointer; }`,
      js: ""
    }
  },
  {
    name: "Responsive Navbar", category: "Page", icon: "N", description: "A navbar with a mobile toggle.",
    data: {
      html: `<nav class="nav">
  <div class="brand">Brand</div>
  <button id="toggle">☰</button>
  <ul id="menu">
    <li><a href="#">Home</a></li>
    <li><a href="#">About</a></li>
    <li><a href="#">Contact</a></li>
  </ul>
</nav>`,
      css: `.nav { display: flex; align-items: center; background: #1a73e8; color: #fff; padding: 1rem; gap: 1rem; }
.brand { font-weight: 700; }
#toggle { margin-left: auto; background: none; border: 0; color: #fff; font-size: 1.5rem; }
#menu { display: flex; gap: 1rem; list-style: none; margin-left: auto; }
#menu a { color: #fff; text-decoration: none; }
@media (max-width: 600px) { #menu { display: none; flex-direction: column; position: absolute; top: 56px; right: 0; background: #1a73e8; padding: 1rem; }
  #menu.open { display: flex; } }`,
      js: `document.getElementById('toggle').addEventListener('click', () => {
  document.getElementById('menu').classList.toggle('open');
});`
    }
  },
  {
    name: "Card Grid", category: "Page", icon: "G", description: "A responsive grid of cards.",
    data: {
      html: `<div class="grid">
  <div class="card"><h3>One</h3><p>First card.</p></div>
  <div class="card"><h3>Two</h3><p>Second card.</p></div>
  <div class="card"><h3>Three</h3><p>Third card.</p></div>
</div>`,
      css: `.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; padding: 2rem; font-family: system-ui, sans-serif; }
.card { background: #f8f9fa; border: 1px solid #dadce0; border-radius: 12px; padding: 1.5rem; }
.card h3 { margin-top: 0; color: #1a73e8; }`,
      js: ""
    }
  },
  {
    name: "Button Collection", category: "CSS", icon: "B", description: "A set of styled buttons.",
    data: {
      html: `<div class="row">
  <button class="btn primary">Primary</button>
  <button class="btn ghost">Ghost</button>
  <button class="btn danger">Danger</button>
</div>`,
      css: `.row { display: flex; gap: 1rem; padding: 2rem; flex-wrap: wrap; }
.btn { padding: .6rem 1.4rem; border-radius: 999px; border: 0; cursor: pointer; font-weight: 600; }
.btn.primary { background: #1a73e8; color: #fff; }
.btn.ghost { background: transparent; border: 2px solid #1a73e8; color: #1a73e8; }
.btn.danger { background: #ea4335; color: #fff; }
.btn:hover { opacity: .9; }`,
      js: ""
    }
  },
  {
    name: "Snake Game", category: "Game", icon: "S", description: "Classic snake with arrow keys.",
    data: {
      html: `<canvas id="c" width="320" height="320"></canvas>
<p id="score">Score: 0</p>`,
      css: `body { background: #111; color: #0f0; font-family: monospace; text-align: center; }
canvas { border: 2px solid #0f0; margin-top: 2rem; }`,
      js: `const cv=document.getElementById('c'),x=cv.getContext('2d'),G=16;
let s=[{x:8,y:8}],d={x:1,y:0},f={x:5,y:5},sc=0;
const score=document.getElementById('score');
function place(){f={x:Math.floor(Math.random()*G),y:Math.floor(Math.random()*G)};}
function draw(){x.fillStyle='#111';x.fillRect(0,0,cv.width,cv.height);
x.fillStyle='#0f0';x.fillRect(f.x*20,f.y*20,20,20);
x.fillStyle='#fff';s.forEach(p=>x.fillRect(p.x*20,p.y*20,20,20));}
function step(){let h={x:s[0].x+d.x,y:s[0].y+d.y};
if(h.x<0||h.y<0||h.x>=G||h.y>=G||s.some(p=>p.x===h.x&&p.y===h.y)){
alert('Game Over! Score '+sc);s=[{x:8,y:8}];d={x:1,y:0};sc=0;score.textContent='Score: 0';return;}
s.unshift(h);if(h.x===f.x&&h.y===f.y){sc++;score.textContent='Score: '+sc;place();}else s.pop();draw();}
document.addEventListener('keydown',e=>{
if(e.key==='ArrowUp'&&d.y===0)d={x:0,y:-1};
if(e.key==='ArrowDown'&&d.y===0)d={x:0,y:1};
if(e.key==='ArrowLeft'&&d.x===0)d={x:-1,y:0};
if(e.key==='ArrowRight'&&d.x===0)d={x:1,y:0};});
setInterval(step,120);draw();`
    }
  },
  {
    name: "Tic Tac Toe", category: "Game", icon: "T", description: "Two-player tic tac toe.",
    data: {
      html: `<h2 id="status">X's turn</h2>
<div id="board"></div>
<button id="reset">Reset</button>`,
      css: `#board { display: grid; grid-template-columns: repeat(3, 80px); gap: 6px; margin: 1rem auto; width: max-content; }
.cell { width: 80px; height: 80px; font-size: 2rem; background: #222; color: #fff; border: 0; cursor: pointer; }
.cell:hover { background: #333; }
body { font-family: sans-serif; text-align: center; color: #eee; background: #111; }
#reset { padding: .5rem 1rem; margin-top: 1rem; }`,
      js: `let board=Array(9).fill(''),turn='X',over=false;
const status=document.getElementById('status'),boardEl=document.getElementById('board');
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function render(){boardEl.innerHTML='';board.forEach((v,i)=>{const b=document.createElement('button');
b.className='cell';b.textContent=v;b.onclick=()=>play(i);boardEl.appendChild(b);});}
function play(i){if(over||board[i])return;board[i]=turn;render();
const w=wins.find(l=>l.every(j=>board[j]===turn));
if(w){status.textContent=turn+' wins!';over=true;return;}
if(board.every(c=>c)){status.textContent='Draw!';over=true;return;}
turn=turn==='X'?'O':'X';status.textContent=turn+"'s turn";}
document.getElementById('reset').onclick=()=>{board=Array(9).fill('');turn='X';over=false;status.textContent="X's turn";render();};
render();`
    }
  },
  {
    name: "Memory Game", category: "Game", icon: "M", description: "Flip-and-match memory cards.",
    data: {
      html: `<h3>Memory Match</h3>
<div id="board"></div>`,
      css: `#board { display: grid; grid-template-columns: repeat(4, 70px); gap: 8px; margin: 1rem auto; width: max-content; }
.card { width: 70px; height: 70px; font-size: 1.6rem; background: #444; color: transparent; border: 0; border-radius: 8px; cursor: pointer; }
.card.flip { background: #1a73e8; color: #fff; }
.card.done { background: #0f9d58; color: #fff; }
body { font-family: sans-serif; text-align: center; background: #111; color: #eee; }`,
      js: `const icons=['🍎','🍌','🍇','🍒','🍎','🍌','🍇','🍒'].sort(()=>Math.random()-.5);
let flipped=[],lock=false;
const board=document.getElementById('board');
icons.forEach((icon,i)=>{const b=document.createElement('button');b.className='card';
b.dataset.icon=icon;b.onclick=()=>flip(b);board.appendChild(b);});
function flip(card){if(lock||card.classList.contains('flip')||card.classList.contains('done'))return;
card.classList.add('flip');card.textContent=card.dataset.icon;flipped.push(card);
if(flipped.length===2){lock=true;const[a,b]=flipped;
if(a.dataset.icon===b.dataset.icon){a.classList.add('done');b.classList.add('done');flipped=[];lock=false;}
else setTimeout(()=>{a.classList.remove('flip');a.textContent='';b.classList.remove('flip');b.textContent='';flipped=[];lock=false;},700);}}`
    }
  },
  {
    name: "Calculator", category: "App", icon: "C", description: "A working calculator.",
    data: {
      html: `<div class="calc"><input id="disp" disabled>
<div class="keys">
<button onclick="press('7')">7</button><button onclick="press('8')">8</button><button onclick="press('9')">9</button><button onclick="press('/')">/</button>
<button onclick="press('4')">4</button><button onclick="press('5')">5</button><button onclick="press('6')">6</button><button onclick="press('*')">*</button>
<button onclick="press('1')">1</button><button onclick="press('2')">2</button><button onclick="press('3')">3</button><button onclick="press('-')">-</button>
<button onclick="press('0')">0</button><button onclick="press('.')">.</button><button onclick="calc('=')">=</button><button onclick="press('+')">+</button>
<button onclick="clearAll()" class="wide">C</button>
</div></div>`,
      css: `.calc { width: 240px; margin: 2rem auto; font-family: sans-serif; }
#disp { width: 100%; font-size: 1.5rem; text-align: right; padding: .6rem; box-sizing: border-box; }
.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.keys button { padding: .8rem; font-size: 1rem; cursor: pointer; }
.wide { grid-column: span 4; }`,
      js: `let expr='';const disp=document.getElementById('disp');
function press(v){expr+=v;disp.value=expr;}
function calc(){try{disp.value=eval(expr);expr=disp.value;}catch(e){disp.value='Error';expr='';}}
function clearAll(){expr='';disp.value='';}`
    }
  },
  {
    name: "Digital Clock", category: "App", icon: "C", description: "A live digital clock.",
    data: {
      html: `<div id="clock">00:00:00</div>`,
      css: `body { display: grid; place-items: center; height: 100vh; margin: 0; background: #111; font-family: monospace; }
#clock { font-size: 4rem; color: #0f0; letter-spacing: .2em; }`,
      js: `function tick(){const d=new Date();
document.getElementById('clock').textContent=
[d.getHours(),d.getMinutes(),d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');}
setInterval(tick,1000);tick();`
    }
  },
  {
    name: "Todo List", category: "App", icon: "T", description: "Add and complete tasks.",
    data: {
      html: `<div class="app">
<h3>Todos</h3>
<form id="form"><input id="inp" placeholder="New task"><button>Add</button></form>
<ul id="list"></ul>
</div>`,
      css: `.app { max-width: 360px; margin: 2rem auto; font-family: sans-serif; }
form { display: flex; gap: .5rem; margin-bottom: 1rem; }
input { flex: 1; padding: .5rem; }
button { padding: .5rem 1rem; }
li { padding: .5rem 0; cursor: pointer; }
li.done { text-decoration: line-through; color: #999; }`,
      js: `const form=document.getElementById('form'),inp=document.getElementById('inp'),list=document.getElementById('list');
form.addEventListener('submit',e=>{e.preventDefault();if(!inp.value)return;
const li=document.createElement('li');li.textContent=inp.value;
li.onclick=()=>li.classList.toggle('done');list.appendChild(li);inp.value='';});`
    }
  },
  {
    name: "Quiz Game", category: "Game", icon: "Q", description: "A multiple-choice quiz.",
    data: {
      html: `<div id="quiz"></div>`,
      css: `body { font-family: sans-serif; background: #111; color: #eee; display: grid; place-items: center; }
#quiz { max-width: 400px; text-align: center; }
.opt { display: block; width: 100%; margin: .4rem 0; padding: .7rem; background: #222; color: #eee; border: 1px solid #444; border-radius: 8px; cursor: pointer; }
.opt:hover { background: #333; }`,
      js: `const qs=[{q:'Capital of France?',a:['London','Paris','Rome'],c:1},
{q:'2 + 2?',a:['3','4','5'],c:1},{q:'Color of sky?',a:['Green','Blue','Red'],c:1}];
let i=0,score=0;const el=document.getElementById('quiz');
function show(){const q=qs[i];el.innerHTML='<h3>'+q.q+'</h3>';
q.a.forEach((o,j)=>{const b=document.createElement('button');b.className='opt';b.textContent=o;
b.onclick=()=>{if(j===q.c)score++;i++;if(i<qs.length)show();else el.innerHTML='<h3>Score: '+score+'/'+qs.length+'</h3>';};el.appendChild(b);});}
show();`
    }
  }
];
