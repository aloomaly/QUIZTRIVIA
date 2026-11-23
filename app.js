/* ALTITUDE — Boeing & Aviation trivia: 5 questions per flight, 30 seconds each. */
/* Supabase global leaderboard + GitHub Pages compatible */

const QUESTION_COUNT = 5;
const TIME_LIMIT = 30;
const XP_PER_CORRECT = 250;
const TOPIC = "Boeing & Aviation";

/* ───────── Supabase ───────── */

const SUPABASE_URL = "https://jytbghbntcbjajyojygq.supabase.co";
/* Publishable key only (sb_publishable_...). Never a secret/service_role key. */
const SUPABASE_KEY = "sb_publishable_JPHqLD7T7uR3lzJWlR1CBQ_RmBxufZ_";

/* ───────── question pool ───────── */

/* [question, [options], index of the correct option] */
const POOL = [
  ["Which company built the famous 747 'Jumbo Jet'?", ["Airbus", "Boeing", "Embraer", "Bombardier"], 1],
  ["What is the Boeing 747's famous nickname?", ["Queen of the Skies", "Duke of the Clouds", "Prince of Planes", "Baron of the Boarding Gate"], 0],
  ["What colour are the flight recorders, the so-called 'black boxes'?", ["Black, obviously", "Bright orange", "Hot pink", "Neon green"], 1],
  ["What is the Boeing 787's nickname?", ["Nightmareliner", "Daydreamer", "Dreamliner", "Sleepliner"], 2],
  ["A pilot shouts 'Mayday!' on the radio. What does that mean?", ["Party at 30,000 ft", "Snacks requested", "Time to turn left", "Distress: I need help now"], 3],
  ["Planes usually take off and land facing which way?", ["Into the wind", "Toward the terminal", "Away from the sun", "Whichever way the pilot likes"], 0],
  ["How many engines does a Boeing 747 have?", ["2", "3", "4", "6"], 2],
  ["In which decade did the Boeing 747 first fly?", ["1950s", "1960s", "1980s", "1990s"], 1],
  ["Runway '09' points roughly in which compass direction?", ["North", "East", "South", "West"], 1],
  ["Which tail control swings the nose left and right?", ["Rudder", "Elevator", "Spoiler", "Cup holder"], 0],
  ["Roughly how high does a passenger jet cruise?", ["3,500 ft", "35,000 ft", "350,000 ft", "Wherever the pilot feels like"], 1],
  ["Who made the first powered, controlled aeroplane flight in 1903?", ["The Wright brothers", "The Boeing brothers", "The Lumière brothers", "The Mario brothers"], 0],
  ["What does ATC stand for in aviation?", ["Always Taking Coffee", "Air Traffic Control", "Aircraft Touch Centre", "Altitude Test Chamber"], 1],
  ["Which Boeing is the best-selling jet airliner family of all time?", ["737", "747", "777", "787"], 0],
  ["In the pilots' phonetic alphabet, which word stands for the letter Z?", ["Zebra", "Zero", "Zulu", "Zed"], 2],
  ["A pilot says 'Roger'. What does it mean?", ["Hello, I'm Roger", "Message received", "Turn right", "Out of coffee"], 1],
  ["In which city was Boeing founded in 1916?", ["Miami", "Dallas", "Denver", "Seattle"], 3]
];

/* ───────── state ───────── */

const state = {
  questions: [],
  index: 0,
  score: 0,
  totalXP: 0,
  answered: false,
  run: 0
};

const player = {
  name: localStorage.getItem("altitudePlayerName") || ""
};

let leaderboardEntries = [];
let timerId = null;

/* ───────── helpers ───────── */

const $ = s => document.querySelector(s);
const screens = [...document.querySelectorAll(".screen")];

/* ───────── screen navigation ───────── */

function show(name) {
  if (name !== "quiz") stopTimer();

  screens.forEach(s => {
    s.classList.toggle("active", s.id === name);
  });

  /* guarded: SkyScene.setMode only exists if WebGL/Three.js started */
  if (window.SkyScene && SkyScene.setMode) {
    SkyScene.setMode(name === "quiz" ? "quiz" : "hero");
  }
}

document.querySelectorAll("[data-screen]").forEach(b => {
  b.addEventListener("click", () => {
    const screen = b.dataset.screen;
    show(screen);
    if (screen === "leaderboard") loadLeaderboard();
  });
});

/* ───────── shuffle ───────── */

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/* ───────── toast ───────── */

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1700);
}

/* ───────── player name ───────── */

function getPlayerName() {
  const previousName =
    player.name || localStorage.getItem("altitudePlayerName") || "";

  const input = window.prompt(
    previousName
      ? `ENTER YOUR PILOT NAME:\n\nCurrent: ${previousName}`
      : "ENTER YOUR PILOT NAME:"
  );

  if (input === null) return null;

  const name = input.trim().replace(/\s+/g, " ");

  if (!name) {
    toast("Please enter a pilot name.");
    return getPlayerName();
  }

  if (name.length > 20) {
    toast("Name must be 20 characters or less.");
    return getPlayerName();
  }

  player.name = name;
  localStorage.setItem("altitudePlayerName", name);
  return name;
}

/* ───────── Supabase: submit score ───────── */

async function submitScore() {
  const name = player.name || "Anonymous Pilot";
  const correctAnswers = Math.round(state.score / XP_PER_CORRECT);

  const payload = {
    player_name: name,
    score: state.score,
    category: TOPIC,
    correct_answers: correctAnswers,
    total_questions: QUESTION_COUNT
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ALTITUDE] Supabase score submission failed:", errorText);
      toast("Score could not be submitted.");
      return false;
    }

    console.log("[ALTITUDE] Score submitted successfully.");
    return true;
  } catch (error) {
    console.error("[ALTITUDE] Supabase connection error:", error);
    toast("Leaderboard connection unavailable.");
    return false;
  }
}

/* ───────── Supabase: load leaderboard ───────── */

async function loadLeaderboard() {
  const list = $("#leaderboardList");

  if (!list) {
    console.warn("[ALTITUDE] #leaderboardList was not found.");
    return;
  }

  list.innerHTML = `<div class="leaderboard-loading">LOADING GLOBAL CABIN...</div>`;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/leaderboard` +
      `?select=player_name,score,category,correct_answers,total_questions,created_at` +
      `&order=score.desc,created_at.asc` +
      `&limit=50`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) throw new Error(await response.text());

    leaderboardEntries = await response.json();
    renderLeaderboard();
  } catch (error) {
    console.error("[ALTITUDE] Could not load leaderboard:", error);
    list.innerHTML = `<div class="leaderboard-loading">UNABLE TO LOAD GLOBAL CABIN</div>`;
  }
}

/* ───────── leaderboard rendering ───────── */

function renderLeaderboard() {
  const list = $("#leaderboardList");
  if (!list) return;

  list.innerHTML = "";

  if (!leaderboardEntries.length) {
    list.innerHTML = `<div class="leaderboard-loading">NO FLIGHTS RECORDED YET</div>`;
    return;
  }

  leaderboardEntries.forEach((entry, index) => {
    const row = document.createElement("div");

    const isYou =
      player.name &&
      entry.player_name.toLowerCase() === player.name.toLowerCase();

    row.className = isYou ? "you" : "";

    row.innerHTML = `
      <span>${String(index + 1).padStart(2, "0")}</span>
      <b>${escapeHTML(entry.player_name)}</b>
      <strong>${entry.score} XP</strong>
    `;

    list.appendChild(row);
  });
}

/* ───────── prevent HTML injection ───────── */

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

/* ───────── timer ───────── */

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer(run) {
  stopTimer();

  const deadline = Date.now() + TIME_LIMIT * 1000;
  const bar = $("#timerBar");
  const label = $("#timer");

  const paint = () => {
    const left = Math.max(0, deadline - Date.now());
    const secs = Math.ceil(left / 1000);
    const urgent = secs <= 10;

    if (label) {
      label.textContent = `⏱ ${secs}s`;
      label.style.color = urgent ? "#dc8d8d" : "";
    }

    if (bar) {
      bar.style.transform = `scaleX(${left / (TIME_LIMIT * 1000)})`;
      bar.style.background = urgent ? "#dc8d8d" : "#e2b26a";
    }

    if (left <= 0 && run === state.run) {
      stopTimer();
      timeUp();
    }
  };

  paint();
  timerId = setInterval(paint, 200);
}

/* ───────── quiz flow ───────── */

function startQuiz() {
  const name = getPlayerName();
  if (!name) return;

  state.run++;

  state.questions = shuffle(POOL)
    .slice(0, QUESTION_COUNT)
    .map(([q, opts, correct]) => {
      const answer = opts[correct];
      const options = shuffle(opts);
      return { q, options, correct: options.indexOf(answer) };
    });

  state.index = 0;
  state.score = 0;
  state.answered = false;

  show("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.index];
  const n = state.questions.length;

  $("#questionNumber").textContent = String(state.index + 1).padStart(2, "0");
  $("#progressText").textContent =
    `${String(state.index + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
  $("#progressBar").style.transform = `scaleX(${state.index / n})`;
  $("#questionCategory").textContent = TOPIC.toUpperCase();
  $("#question").textContent = q.q;
  $("#feedback").textContent = "";
  $("#quizXp").textContent = `${state.score} XP`;

  const answers = $("#answers");
  answers.innerHTML = "";

  q.options.forEach((a, i) => {
    const b = document.createElement("button");
    b.className = "answer";
    b.textContent = `${String.fromCharCode(65 + i)}  ${a}`;
    b.onclick = () => answer(i, b);
    answers.appendChild(b);
  });

  startTimer(state.run);
}

function next(run) {
  if (run !== state.run) return;

  state.index++;

  if (state.index >= state.questions.length) {
    finishQuiz();
  } else {
    state.answered = false;
    renderQuestion();
  }
}

function lockAnswers(q) {
  [...$("#answers").children].forEach((b, n) => {
    b.disabled = true;
    if (n === q.correct) b.classList.add("correct");
  });

  $("#progressBar").style.transform =
    `scaleX(${(state.index + 1) / state.questions.length})`;
}

/* ───────── answer ───────── */

function answer(i, clicked) {
  if (state.answered) return;

  state.answered = true;
  stopTimer();

  const q = state.questions[state.index];
  const run = state.run;

  lockAnswers(q);

  if (i === q.correct) {
    state.score += XP_PER_CORRECT;
    clicked.classList.add("correct");
    $("#feedback").textContent = `CORRECT · +${XP_PER_CORRECT} XP`;
    $("#feedback").style.color = "#8bd3a8";
  } else {
    clicked.classList.add("wrong");
    $("#feedback").textContent = `INCORRECT · CORRECT ANSWER: ${q.options[q.correct]}`;
    $("#feedback").style.color = "#dc8d8d";
  }

  $("#quizXp").textContent = `${state.score} XP`;

  setTimeout(() => next(run), 700);
}

/* ───────── time up ───────── */

function timeUp() {
  if (state.answered) return;

  state.answered = true;

  const q = state.questions[state.index];
  const run = state.run;

  lockAnswers(q);

  $("#feedback").textContent = `TIME'S UP · CORRECT ANSWER: ${q.options[q.correct]}`;
  $("#feedback").style.color = "#dc8d8d";

  setTimeout(() => next(run), 1100);
}

/* ───────── finish quiz ───────── */

async function finishQuiz() {
  stopTimer();

  state.totalXP += state.score;

  const n = state.questions.length;
  const correct = Math.round(state.score / XP_PER_CORRECT);
  const pct = Math.round(state.score / (n * XP_PER_CORRECT) * 100);

  /* Update results first: Supabase must never block them. */
  $("#finalScore").textContent = state.score;
  $("#scoreNav").textContent = `${state.totalXP} XP`;

  $("#resultTitle").textContent =
    pct >= 80
      ? "Captain-grade knowledge."
      : pct >= 40
        ? "Smooth cruising altitude."
        : "Turbulence ahead. Try again?";

  $("#resultText").textContent =
    `${player.name}, you got ${correct} of ${n} right on the ${TOPIC} flight.`;

  show("results");

  try {
    const submitted = await submitScore();
    if (!submitted) {
      console.warn("[ALTITUDE] Results displayed, but the score was not submitted.");
    }
  } catch (error) {
    console.error("[ALTITUDE] Score submission failed:", error);
    toast("Results saved · leaderboard unavailable");
  }
}

/* ───────── buttons ───────── */

$("#startBtn").onclick = startQuiz;
$("#retryBtn").onclick = startQuiz;

$("#quitQuiz").onclick = () => {
  state.run++;
  show("home");
};

/* ───────── Three.js scene (optional: the quiz works without it) ───────── */

const sceneOK = window.SkyScene && SkyScene.init(
  document.querySelector("#gl"),
  {
    reduced: false,

    onTelemetry(s) {
      $("#speed").textContent = Math.round(s.kts);
      $("#alt").textContent = Math.round(s.altFt);

      const t = Math.floor(s.T);
      $("#clock").textContent =
        `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    }
  }
);

if (sceneOK) {
  SkyScene.start();
  SkyScene.onIntroEnd(() => toast("Takeoff complete · ready when you are"));
}
