let questions = [];
let currentQuestionIndex = 0;
let userEmail = "";
let usedHint = false;
let followUpAnswered = new Set();
let answeredQuestions = new Set();
let correctCount = 0;
let incorrectCount = 0;
let selectedSectionQuestions = [];
let currentSessionId = "";

const googleAppsScriptURL = "https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/AKfycbwLuBiKABEFy2SJM7dcymQ13jdwi-omYDd39P8F1YGK71a7jrUK0Z5t3_yRpvTeaVwtRg/exec";

document.addEventListener("DOMContentLoaded", () => {
  fetch("questions.json")
    .then(res => res.json())
    .then(data => {
      questions = data;
      showSectionList();
    })
    .catch(err => console.error("Failed to load questions.json:", err));

  document.getElementById("startButton").addEventListener("click", () => {
    userEmail = document.getElementById("emailInput").value.trim();
    if (userEmail && userEmail.includes("@")) {
      currentSessionId = Date.now().toString();
      questions = selectedSectionQuestions;
      if (questions.length > 0) {
        showQuestion(currentQuestionIndex);
      } else {
        alert("No questions found.");
      }
    } else {
      alert("Please enter a valid Gmail address.");
    }
  });

  document.getElementById("showHint").addEventListener("click", () => {
    if (!answeredQuestions.has(currentQuestionIndex)) {
      document.getElementById("hintBox").innerText = questions[currentQuestionIndex].hint || "";
      usedHint = true;
    }
  });

  document.getElementById("prevButton").addEventListener("click", () => {
    if (!answeredQuestions.has(currentQuestionIndex)) markQuestionAsSkipped(currentQuestionIndex);
    if (currentQuestionIndex > 0) showQuestion(--currentQuestionIndex);
  });

  document.getElementById("nextButton").addEventListener("click", () => {
    if (!answeredQuestions.has(currentQuestionIndex)) markQuestionAsSkipped(currentQuestionIndex);
    if (currentQuestionIndex < questions.length - 1) {
      showQuestion(++currentQuestionIndex);
    } else {
      showScore();
    }
  });
});

function showSectionList() {
  const sectionList = document.getElementById("sectionList");
  const uniqueSections = [...new Set(questions.map(q => q.section))];
  sectionList.innerHTML = "";
  uniqueSections.forEach(sec => {
    const btn = document.createElement("button");
    btn.innerText = `Section ${sec}`;
    btn.onclick = () => {
      selectedSectionQuestions = questions.filter(q => q.section === sec);
      currentQuestionIndex = 0;
      answeredQuestions.clear();
      correctCount = 0;
      incorrectCount = 0;
      followUpAnswered.clear();
      document.getElementById("home").style.display = "none";
      document.getElementById("emailScreen").style.display = "block";
    };
    sectionList.appendChild(btn);
  });
}

function showQuestion(index) {
  const q = questions[index];
  usedHint = false;
  q.startTime = new Date();

  document.getElementById("questionScreen").style.display = "block";
  document.getElementById("emailScreen").style.display = "none";
  document.getElementById("scoreScreen").style.display = "none";

  document.getElementById("questionNumber").innerText = `Question ${index + 1}`;
  document.getElementById("questionText").innerText = q.question;

  const optionsBox = document.getElementById("optionsBox");
  optionsBox.innerHTML = "";
  q.options.forEach((opt, i) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "option";
    input.value = String.fromCharCode(65 + i);
    input.addEventListener("click", () => handleSubmitAnswer(input.value));
    label.appendChild(input);
    label.append(` ${opt}`);
    optionsBox.appendChild(label);
  });

  document.getElementById("hintBox").innerText = "";
  document.getElementById("feedback").innerText = "";
  document.getElementById("followUpContainer").innerHTML = "";
}

function handleSubmitAnswer(selected) {
  const q = questions[currentQuestionIndex];
  if (answeredQuestions.has(currentQuestionIndex)) return;

  q.endTime = new Date();
  const timeSpent = (q.endTime - q.startTime) / 1000;
  const correct = selected === q.correctAnswer;

  answeredQuestions.add(currentQuestionIndex);
  if (correct) correctCount++;
  else incorrectCount++;

  const feedback = correct ? "✅ Correct" : "❌ Incorrect";
  document.getElementById("feedback").innerText = feedback;

  logAnswer({
    action: "logQuestion",
    email: userEmail,
    sessionId: currentSessionId,
    questionId: q.id,
    questionText: q.question,
    questionNumberDisplay: `${currentQuestionIndex + 1}/${questions.length}`,
    usedHint: usedHint ? "Yes" : "No",
    answerGiven: selected,
    correct: correct ? "Correct" : "Incorrect",
    timeSpent: timeSpent.toFixed(2),
    feedbackShown: feedback,
    section: q.section,
    timestamp: new Date().toISOString()
  });
}

function markQuestionAsSkipped(index) {
  const q = questions[index];
  if (!answeredQuestions.has(index)) {
    answeredQuestions.add(index);
    incorrectCount++;
    const timeSpent = 0;
    logAnswer({
      action: "logQuestion",
      email: userEmail,
      sessionId: currentSessionId,
      questionId: q.id,
      questionText: q.question,
      questionNumberDisplay: `${index + 1}/${questions.length}`,
      usedHint: usedHint ? "Yes" : "No",
      answerGiven: "N/A (Skipped)",
      correct: "Skipped",
      timeSpent: timeSpent.toFixed(2),
      feedbackShown: "❌ Question skipped.",
      section: q.section,
      timestamp: new Date().toISOString()
    });
  }
}

function showScore() {
  document.getElementById("questionScreen").style.display = "none";
  document.getElementById("scoreScreen").style.display = "block";

  const total = questions.length;
  const percent = ((correctCount / total) * 100).toFixed(2);

  document.getElementById("finalScore").innerHTML = `
    <h2>Quiz Completed</h2>
    <p>Correct: ${correctCount}</p>
    <p>Incorrect: ${incorrectCount}</p>
    <p>Score: ${percent}%</p>
  `;

  logFinalScore(correctCount, incorrectCount, total, percent);
}

function logAnswer(payload) {
  fetch(googleAppsScriptURL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  })
    .then(res => res.json())
    .then(data => {
      if (data.status !== "success") {
        console.error("Log failed:", data.message);
      }
    })
    .catch(err => console.error("Log error:", err));
}

function logFinalScore(correctCount, incorrectCount, total, percent) {
  const payload = {
    action: "logFinalScore",
    email: userEmail,
    sessionId: currentSessionId,
    correctCount,
    incorrectCount,
    totalQuestions: total,
    percentageScore: percent,
    timestamp: new Date().toISOString()
  };

  fetch(googleAppsScriptURL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  })
    .then(res => res.json())
    .then(data => {
      if (data.status !== "success") {
        console.error("Final score log failed:", data.message);
      }
    })
    .catch(err => console.error("Final score log error:", err));
}
