const categories = [
  {id:"science",icon:"◉",name:"Science",desc:"Space, physics, biology & the strange stuff between.",questions:[
    ["What is the closest star to Earth after the Sun?",["Sirius","Proxima Centauri","Betelgeuse","Vega"],1],
    ["What particle has a negative electric charge?",["Proton","Neutron","Electron","Photon"],2],
    ["Which planet has the most prominent ring system?",["Mars","Saturn","Venus","Mercury"],1],
    ["What gas do plants absorb during photosynthesis?",["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"],2]
  ]},
  {id:"history",icon:"⌘",name:"History",desc:"Empires, inventions, revolutions & turning points.",questions:[
    ["Which ancient civilization built Machu Picchu?",["Roman","Inca","Maya","Egyptian"],1],
    ["The printing press is strongly associated with whom?",["Newton","Gutenberg","Galileo","Da Vinci"],1],
    ["The Berlin Wall fell in which year?",["1979","1985","1989","1994"],2],
    ["Who was the first person to walk on the Moon?",["Buzz Aldrin","Yuri Gagarin","Neil Armstrong","John Glenn"],2]
  ]},
  {id:"tech",icon:"⌁",name:"Technology",desc:"Computing, internet, AI and the machines shaping tomorrow.",questions:[
    ["What does CPU stand for?",["Central Processing Unit","Computer Power Utility","Core Program User","Central Protocol Unit"],0],
    ["Which language runs natively in web browsers?",["Python","JavaScript","C","Rust"],1],
    ["What does HTTP stand for?",["HyperText Transfer Protocol","High Transfer Text Process","Hyperlink Terminal Transfer Path","Host Text Transport Protocol"],0],
    ["Which data structure follows FIFO?",["Stack","Tree","Queue","Graph"],2]
  ]},
  {id:"space",icon:"✦",name:"Space",desc:"Planets, stars, missions and the edge of the known.",questions:[
    ["Which planet is known as the Red Planet?",["Jupiter","Mars","Neptune","Uranus"],1],
    ["What is the name of our galaxy?",["Andromeda","Sombrero","Milky Way","Whirlpool"],2],
    ["What is a light-year a measure of?",["Time","Brightness","Distance","Mass"],2],
    ["Which object is at the center of our solar system?",["Earth","The Sun","Jupiter","Polaris"],1]
  ]},
  {id:"geography",icon:"◇",name:"Geography",desc:"Cities, countries, oceans, mountains and the planet below.",questions:[
    ["Which is the largest ocean?",["Atlantic","Indian","Pacific","Arctic"],2],
    ["What is the capital of Japan?",["Kyoto","Osaka","Tokyo","Sapporo"],2],
    ["Which country has the most natural lakes?",["Canada","Brazil","Russia","India"],0],
    ["The Sahara is primarily located on which continent?",["Asia","Africa","Australia","Europe"],1]
  ]},
  {id:"culture",icon:"✧",name:"Culture",desc:"Art, music, film, literature and ideas that travel.",questions:[
    ["Who painted the Mona Lisa?",["Michelangelo","Leonardo da Vinci","Raphael","Van Gogh"],1],
    ["Which instrument has 88 keys in its standard form?",["Violin","Piano","Flute","Harp"],1],
    ["Which genre is associated with Miles Davis?",["Jazz","Reggae","Opera","Punk"],0],
    ["Who wrote Romeo and Juliet?",["Shakespeare","Dante","Homer","Goethe"],0]
  ]},
  {id:"nature",icon:"❋",name:"Nature",desc:"Animals, ecosystems, oceans and the living world.",questions:[
    ["What is the largest land animal?",["Giraffe","Elephant","Rhino","Hippo"],1],
    ["How many legs does a spider have?",["6","8","10","12"],1],
    ["Which animal is known for changing its skin color?",["Penguin","Chameleon","Elephant","Otter"],1],
    ["What process turns liquid water into vapor?",["Condensation","Freezing","Evaporation","Melting"],2]
  ]},
  {id:"sports",icon:"△",name:"Sports",desc:"Records, rules, legendary players and big moments.",questions:[
    ["How many players are on a football/soccer team on the pitch?",["9","10","11","12"],2],
    ["Which sport uses a shuttlecock?",["Tennis","Badminton","Squash","Hockey"],1],
    ["How many rings are on the Olympic symbol?",["4","5","6","7"],1],
    ["In which sport is the term 'birdie' commonly used?",["Golf","Boxing","Swimming","Rugby"],0]
  ]},
  {id:"india",icon:"☼",name:"India",desc:"History, science, culture, geography and modern India.",questions:[
    ["What is the capital of Karnataka?",["Mysuru","Bengaluru","Mangaluru","Hubballi"],1],
    ["Which Indian mission achieved a soft landing near the Moon's south polar region in 2023?",["Chandrayaan-1","Mangalyaan","Chandrayaan-3","Aditya-L1"],2],
    ["What is India's national animal?",["Lion","Tiger","Elephant","Peacock"],1],
    ["Which city is known as the Pink City?",["Jaipur","Udaipur","Jodhpur","Bhopal"],0]
  ]},
  {id:"random",icon:"?",name:"Wildcard",desc:"A chaotic mix for pilots who refuse to choose.",questions:[]}
];

const allQuestions = categories.filter(c=>c.id!=="random").flatMap(c=>c.questions.map(q=>[...q,c.name]));
const state={category:null,questions:[],index:0,score:0,totalXP:0,answered:false};

const $=s=>document.querySelector(s);
const screens=[...document.querySelectorAll(".screen")];
function show(name){
  screens.forEach(s=>s.classList.toggle("active",s.id===name));
  if(window.SkyScene) SkyScene.setMode(name==="quiz"?"quiz":"hero");
}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.screen)));

function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1700)}

function renderCategories(){
  const grid=$("#categoryGrid");
  grid.innerHTML="";
  categories.forEach(c=>{
    const count=c.id==="random"?allQuestions.length:c.questions.length;
    const el=document.createElement("button");
    el.className="category";
    el.innerHTML=`<span class="icon">${c.icon}</span><div><h3>${c.name}</h3><p>${c.desc}</p></div><span class="count">${count} QUESTIONS · BOARD →</span>`;
    el.onclick=()=>startQuiz(c.id);
    grid.appendChild(el);
  });
}
function startQuiz(id){
  const c=categories.find(x=>x.id===id);
  state.category=c;
  state.questions=shuffle(c.id==="random"?allQuestions.map(q=>q):c.questions).slice(0,Math.min(10,c.id==="random"?allQuestions.length:c.questions.length));
  state.index=0;state.score=0;state.answered=false;
  show("quiz");renderQuestion();
}
function renderQuestion(){
  const q=state.questions[state.index];
  $("#questionNumber").textContent=String(state.index+1).padStart(2,"0");
  $("#progressText").textContent=`${String(state.index+1).padStart(2,"0")} / ${String(state.questions.length).padStart(2,"0")}`;
  $("#progressBar").style.width=`${state.index/state.questions.length*100}%`;
  $("#questionCategory").textContent=state.category.name.toUpperCase();
  $("#question").textContent=q[0];
  $("#feedback").textContent="";
  $("#quizXp").textContent=`${state.score} XP`;
  const answers=$("#answers");answers.innerHTML="";
  q[1].forEach((a,i)=>{
    const b=document.createElement("button");b.className="answer";b.textContent=`${String.fromCharCode(65+i)}  ${a}`;
    b.onclick=()=>answer(i,b);answers.appendChild(b);
  });
}
function answer(i,clicked){
  if(state.answered)return;
  state.answered=true;
  const q=state.questions[state.index];
  [...$("#answers").children].forEach((b,n)=>{b.disabled=true;if(n===q[2])b.classList.add("correct")});
  if(i===q[2]){state.score+=250;clicked.classList.add("correct");$("#feedback").textContent="CORRECT · +250 XP";$("#feedback").style.color="#8bd3a8"}
  else {clicked.classList.add("wrong");$("#feedback").textContent=`INCORRECT · CORRECT ANSWER: ${q[1][q[2]]}`;$("#feedback").style.color="#dc8d8d"}
  $("#quizXp").textContent=`${state.score} XP`;
  $("#progressBar").style.width=`${(state.index+1)/state.questions.length*100}%`;
  setTimeout(()=>{
    state.index++;
    if(state.index>=state.questions.length)finishQuiz();else{state.answered=false;renderQuestion()}
  },900);
}
function finishQuiz(){
  state.totalXP+=state.score;
  $("#finalScore").textContent=state.score;
  $("#leaderScore").textContent=`${state.totalXP} XP`;
  $("#scoreNav").textContent=`${state.totalXP} XP`;
  const pct=Math.round(state.score/(state.questions.length*250)*100);
  $("#resultTitle").textContent=pct>=80?"Pilot-grade knowledge.":pct>=50?"Solid cruising altitude.":"Time to refuel your curiosity.";
  $("#resultText").textContent=`You scored ${pct}% on the ${state.category.name} flight. Your route is now logged in the cabin.`;
  show("results");
}
$("#startBtn").onclick=()=>show("categories");
$("#retryBtn").onclick=()=>startQuiz(state.category.id);
$("#quitQuiz").onclick=()=>show("categories");
$("#soundBtn").onclick=()=>toast("Sound controls are ready for the next audio layer.");

renderCategories();

SkyScene.init(document.querySelector("#gl"),{
  reduced:false,
  onTelemetry(s){
    $("#speed").textContent=Math.round(s.kts);
    $("#alt").textContent=Math.round(s.altFt);
    const t=Math.floor(s.T);$("#clock").textContent=`${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
  }
});
SkyScene.start();
SkyScene.onIntroEnd(()=>toast("Takeoff complete · choose your trivia destination"));
