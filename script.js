let questions = [];
let currentQuestionIndex = 0;
let userEmail = "";
let usedHint = false;
let followUpAnswered = new Set();
let answeredQuestions = new Set(); // Stores indices of answered questions
let correctCount = 0;
let incorrectCount = 0;
let selectedSectionQuestions = []; // Holds questions for the currently selected section
let currentSessionId = ""; // To store a unique ID for the current quiz session

// Make sure this URL is correct and active for your Google Apps Script
// *** IMPORTANT: Replace this URL with the one you get from a new deployment.
const googleAppsScriptURL = 'https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/AKfycbwLuBiKABEFy2SJM7dcymQ13jdwi-omYDd39P8F1YGK71a7jrUK0Z5t3_yRpvTeaVwtRg/exec'; // REPLACE THIS PART

document.addEventListener("DOMContentLoaded", () => {
  fetch("questions.json")
    .then(res => res.json())
    .then(data => {
      questions = data; // Load all questions initially
      showSectionList();
    })
    .catch(err => console.error("Failed to load questions.json:", err));

  document.getElementById("startButton").addEventListener("click", () => {
    userEmail = document.getElementById("emailInput").value.trim();
    if (userEmail && userEmail.includes("@")) {
      currentSessionId = Date.now().toString(); // Generate a unique session ID (e.g., timestamp)
      
      questions = selectedSectionQuestions;
      if (questions.length > 0) {
        showQuestion(currentQuestionIndex);
      } else {
        alert("No questions found for this section.");
        document.getElementById("emailScreen").style.display = "none";
        document.getElementById("home").style.display = "block";
      }
    } else {
      alert("Please enter a valid Gmail address.");
    }
  });

  document.getElementById("showHint").addEventListener("click", () => {
    if (!answeredQuestions.has(currentQuestionIndex)) {
      const q = questions[currentQuestionIndex];
      document.getElementById("hintBox").innerText = q.hint || "";
      document.getElementById("hintBox").classList.add("hint-box");
      usedHint = true;
    }
  });

  document.getElementById("prevButton").addEventListener("click", () => {
    if (!answeredQuestions.has(currentQuestionIndex) && currentQuestionIndex > 0) {
        markQuestionAsSkipped(currentQuestionIndex);
    }
    if (currentQuestionIndex > 0) {
      showQuestion(--currentQuestionIndex);
    }
  });

  document.getElementById("nextButton").addEventListener("click", () => {
    if (!answeredQuestions.has(currentQuestionIndex)) {
        markQuestionAsSkipped(currentQuestionIndex);
    }

    if (currentQuestionIndex < questions.length - 1) {
      showQuestion(++currentQuestionIndex);
    } else {
      showScore();
    }
  });
});

function showSectionList() {
  const sectionContainer = document.getElementById("sectionList");
  const uniqueSections = [...new Set(questions.map(q => q.section))].sort((a, b) => a - b);

  const sectionNames = {
    1: "Subject-Verb Agreement",
    2: "Complete Sentences",
    3: "Sentence Fragments",
    4: "What is a Run-on Sentence",
    5: "How to fix Run-on Sentence",
    6: "Pronoun Agreement"
  };

  sectionContainer.innerHTML = "";
  uniqueSections.forEach(section => {
    const btn = document.createElement("button");
    btn.className = "section-button";
    btn.innerText = sectionNames[section] || `Section ${section}`;
    btn.onclick = () => {
      selectedSectionQuestions = questions.filter(q => q.section === section);
      currentQuestionIndex = 0;
      answeredQuestions.clear();
      correctCount = 0;
      incorrectCount = 0;
      followUpAnswered.clear();
      
      selectedSectionQuestions.forEach(q => {
        delete q.userSelectedAnswer;
        delete q.wasCorrectLastTime;
        delete q.lastFeedbackText;
        delete q.followUpNeeded;
        delete q.followUpAnsweredThisTime;
        delete q.lastFollowUpFeedbackText;
        delete q.lastFollowUpAnswerWasCorrect;
        delete q.userSelectedFollowUpAnswer;
        q.startTime = null; 
        q.endTime = null;
      });

      document.getElementById("home").style.display = "none";
      document.getElementById("emailScreen").style.display = "block";
    };
    sectionContainer.appendChild(btn);
  });
}

function showQuestion(index) {
  const q = questions[index];
  usedHint = false;
  q.startTime = new Date();

  document.getElementById("emailScreen").style.display = "none";
  document.getElementById("scoreScreen").style.display = "none";
  document.getElementById("questionScreen").style.display = "block";

  document.getElementById("questionNumber").innerText = `Question ${index + 1} of ${questions.length}`;
  document.getElementById("questionText").innerText = q.question;

  const hintBox = document.getElementById("hintBox");
  hintBox.innerText = "";
  hintBox.classList.remove("hint-box");

  const feedbackBox = document.getElementById("feedback");
  feedbackBox.innerText = "";
  feedbackBox.classList.remove("correct", "incorrect");

  const followUpContainer = document.getElementById("followUpContainer");
  followUpContainer.innerHTML = "";
  followUpContainer.style.display = "none";

  const optionsBox = document.getElementById("optionsBox");
  optionsBox.innerHTML = "";
  q.options.forEach((opt, i) => {
    const label = document.createElement("label");
    const radioInput = document.createElement("input");
    radioInput.type = "radio";
    radioInput.name = "option";
    radioInput.value = String.fromCharCode(65 + i);

    radioInput.addEventListener("click", () => handleSubmitAnswer(radioInput.value));

    label.appendChild(radioInput);
    label.append(` ${opt}`);
    optionsBox.appendChild(label);
  });

  const isQuestionAnswered = answeredQuestions.has(index);
  document.getElementById("showHint").disabled = isQuestionAnswered;
  document.getElementById("prevButton").disabled = index === 0;
  document.getElementById("nextButton").disabled = false;

  if (isQuestionAnswered) {
    document.querySelectorAll("input[name='option']").forEach(radio => {
      if (radio.value === q.userSelectedAnswer) {
        radio.checked = true;
      }
      radio.disabled = true;
    });

    feedbackBox.innerText = q.lastFeedbackText;
    feedbackBox.classList.add(q.wasCorrectLastTime ? "correct" : "incorrect");

    if (q.followUpNeeded) {
        showFollowUp(q, true);
    }
  }
}

function handleSubmitAnswer(selectedValue) {
  const q = questions[currentQuestionIndex];
  
  if (answeredQuestions.has(currentQuestionIndex)) {
    return;
  }

  q.endTime = new Date();
  const timeSpent = (q.endTime - q.startTime) / 1000;

  const wasCorrect = selectedValue === q.correctAnswer;
  const feedbackBox = document.getElementById("feedback");

  q.userSelectedAnswer = selectedValue;
  q.wasCorrectLastTime = wasCorrect;

  let feedbackText = '';
  if (q.feedback) { // Check for old format (q1-q55)
    feedbackText = usedHint ? (wasCorrect ? q.feedback.correct_hint : q.feedback.incorrect_hint) : (wasCorrect ? q.feedback.correct_no_hint : q.feedback.incorrect_no_hint);
  } else { // Handle new format (q56+)
    const selectedOption = selectedValue.toLowerCase();
    if (wasCorrect) {
      feedbackText = `✅ Correct! ${q.explanationCorrect || ''}`;
    } else {
      feedbackText = `❌ Incorrect. ${q[`explanationIncorrect${selectedValue}`] || ''}`;
    }
  }

  q.lastFeedbackText = feedbackText;
  answeredQuestions.add(currentQuestionIndex);

  feedbackBox.innerText = q.lastFeedbackText;
  if (wasCorrect) {
    feedbackBox.classList.add("correct");
    feedbackBox.classList.remove("incorrect");
    correctCount++;
    if (q.followUpQuestion || q.followUpCorrect) {
        q.followUpNeeded = true;
        if (!followUpAnswered.has(q.id)) {
            showFollowUp(q);
        }
    }
  } else {
    feedbackBox.classList.add("incorrect");
    feedbackBox.classList.remove("correct");
    incorrectCount++;
  }

  document.querySelectorAll("input[name='option']").forEach(radio => radio.disabled = true);
  document.getElementById("showHint").disabled = true;

  logAnswer(
    q.section,
    currentSessionId,
    `${currentQuestionIndex + 1}/${questions.length}`,
    usedHint ? "Yes" : "No",
    selectedValue,
    wasCorrect ? "Correct" : "Incorrect",
    timeSpent.toFixed(2),
    q.lastFeedbackText,
    "N/A",
    "N/A",
    q.id,
    q.question
  );
}

function markQuestionAsSkipped(index) {
    const q = questions[index];
    if (!answeredQuestions.has(index)) {
        q.endTime = new Date();
        const timeSpent = (q.endTime - (q.startTime || new Date())) / 1000;

        answeredQuestions.add(index);
        incorrectCount++;
        
        q.userSelectedAnswer = "N/A (Skipped)";
        q.wasCorrectLastTime = false;
        q.lastFeedbackText = "❌ Question skipped.";
        
        logAnswer(
            q.section,
            currentSessionId,
            `${index + 1}/${questions.length}`,
            usedHint ? "Yes" : "No",
            "N/A (Skipped)",
            "Skipped",
            timeSpent.toFixed(2),
            q.lastFeedbackText,
            "N/A",
            "N/A",
            q.id,
            q.question
        );
    }
}

function showFollowUp(q, isRevisit = false) {
  const followUp = document.getElementById("followUpContainer");
  const followUpQuestionText = q.followUpCorrect || q.followUpQuestion;
  followUp.innerHTML = `<p>${followUpQuestionText}</p>`;

  const followUpOptions = q.followUpCorrectOptions || q.followUpOptions;

  followUpOptions.forEach((opt, i) => {
    const label = document.createElement("label");
    const radioInput = document.createElement("input");
    radioInput.type = "radio";
    radioInput.name = "followUp";
    radioInput.value = String.fromCharCode(65 + i);

    radioInput.addEventListener("click", () => handleSubmitFollowUp(radioInput.value, q, followUp));

    label.appendChild(radioInput);
    label.append(` ${opt}`);
    followUp.appendChild(label);

    if (isRevisit && q.followUpAnsweredThisTime) {
        if (radioInput.value === q.userSelectedFollowUpAnswer) {
            radioInput.checked = true;
        }
        radioInput.disabled = true;
    }
  });

  followUp.style.display = "block";

  if (isRevisit && q.followUpAnsweredThisTime) {
        const feedbackParagraph = document.createElement("p");
        feedbackParagraph.innerText = q.lastFollowUpFeedbackText;
        feedbackParagraph.classList.add(q.lastFollowUpAnswerWasCorrect ? "correct" : "incorrect");
        followUp.appendChild(feedbackParagraph);
        followUp.querySelectorAll("input[name='followUp']").forEach(radio => radio.disabled = true);
  }
}

function handleSubmitFollowUp(selectedValue, q, followUpContainer) {
    if (q.followUpAnsweredThisTime) {
        return;
    }

    const correct = selectedValue === (q.followUpCorrectAnswer || q.followUpAnswer);
    const feedbackText = correct ? "✅ Correct!" : "❌ Incorrect." ;
    const feedbackParagraph = document.createElement("p");
    feedbackParagraph.innerText = feedbackText;
    feedbackParagraph.classList.add(correct ? "correct" : "incorrect");
    followUpContainer.appendChild(feedbackParagraph);

    followUpAnswered.add(q.id);

    q.followUpAnsweredThisTime = true;
    q.lastFollowUpFeedbackText = feedbackText;
    q.lastFollowUpAnswerWasCorrect = correct;
    q.userSelectedFollowUpAnswer = selectedValue;

    followUpContainer.querySelectorAll("input[name='followUp']").forEach(radio => radio.disabled = true);

    logAnswer(
        q.section,
        currentSessionId,
        `${currentQuestionIndex + 1}/${questions.length} (Follow-up)`,
        "N/A",
        selectedValue,
        correct ? "Correct" : "Incorrect",
        "N/A",
        feedbackText,
        selectedValue,
        "N/A",
        `${q.id}_followup`,
        q.followUpCorrect || q.followUpQuestion 
    );
}

function logAnswer(
    section,
    sessionId,
    questionNumberDisplay,
    usedHintStatus,
    answerGiven,
    correctStatus,
    timeSpent,
    feedbackText,
    followupAnswerValue,
    overallScore,
    questionIdInternal,
    questionTextContent
) {
  const payload = {
    action: "logQuestion",
    email: userEmail,
    sessionId: sessionId,
    questionNumberDisplay: questionNumberDisplay,
    questionId: questionIdInternal,
    questionText: questionTextContent,
    usedHint: usedHintStatus,
    answerGiven: answerGiven,
    correct: correctStatus,
    timeSpent: timeSpent,
    feedbackShown: feedbackText,
    followupAnswer: followupAnswerValue,
    overallScore: overallScore,
    timestamp: new Date().toISOString()
  };

  fetch(googleAppsScriptURL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  })
  .then(response => response.json())
  .then(data => {
      if (data.status === "success") {
          console.log("Log successful:", data.message);
      } else {
          console.error("Log failed:", data.message);
      }
  })
  .catch(err => console.error("Log failed (network error or script issue):", err));
}

function logFinalScore(finalCorrectCount, finalIncorrectCount, totalQuestions, percentage) {
    const payload = {
        action: "logFinalScore",
        email: userEmail,
        sessionId: currentSessionId,
        totalQuestions: totalQuestions,
        correctCount: finalCorrectCount,
        incorrectCount: finalIncorrectCount,
        percentageScore: percentage,
        timestamp: new Date().toISOString()
    };

    fetch(googleAppsScriptURL, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            console.log("Final score logged successfully:", data.message);
        } else {
            console.error("Final score log failed:", data.message);
        }
    })
    .catch(err => console.error("Final score log failed (network error or script issue):", err));
}

function showScore() {
  document.getElementById("questionScreen").style.display = "none";
  const scoreScreen = document.getElementById("scoreScreen");
  const finalScore = document.getElementById("finalScore");
  
  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : 0;

  finalScore.innerHTML = `
    <h2>Quiz Completed!</h2>
    <p>Correct Answers: ${correctCount}</p>
    <p>Incorrect Answers: ${incorrectCount}</p>
    <p>Score: ${percentage}%</p>
    <button id="restartQuizButton">Take Another Quiz</button>
  `;
  scoreScreen.style.display = "block";

  logFinalScore(correctCount, incorrectCount, totalQuestions, percentage);

  document.getElementById("restartQuizButton").addEventListener("click", () => {
    currentQuestionIndex = 0;
    answeredQuestions.clear();
    correctCount = 0;
    incorrectCount = 0;
    usedHint = false;
    followUpAnswered.clear();
    questions = [];
    selectedSectionQuestions = [];
    currentSessionId = "";

    document.getElementById("scoreScreen").style.display = "none";
    document.getElementById("emailInput").value = "";
    document.getElementById("emailScreen").style.display = "none";
    document.getElementById("home").style.display = "block";
    fetch("questions.json")
      .then(res => res.json())
      .then(data => {
        questions = data;
        showSectionList();
      })
      .catch(err => console.error("Failed to re-load questions.json:", err));
  });
}