const BOARD_SIZE = 8;
const GAME_DURATION_SECONDS = 60;
const BEST_SCORE_KEY = "apple-ten-best-score";

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const timerElement = document.querySelector("#timer");
const timerItemElement = document.querySelector(".timer-item");
const messageElement = document.querySelector("#game-message");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const resultDialog = document.querySelector("#result-dialog");
const finalScoreElement = document.querySelector("#final-score");
const resultBestScoreElement = document.querySelector("#result-best-score");
const resultRestartButton = document.querySelector("#result-restart-button");
const confettiElement = document.querySelector("#confetti");

let numbers = [];
let selectedCells = [];
let score = 0;
let bestScore = readBestScore();
let secondsLeft = GAME_DURATION_SECONDS;
let isDragging = false;
let activePointerId = null;
let isStarted = false;
let isGameOver = false;
let confettiTimeoutId = null;
let timerIntervalId = null;
let gameEndsAt = null;

function readBestScore() {
  try {
    const storedScore = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY), 10);
    return Number.isSafeInteger(storedScore) && storedScore > 0 ? storedScore : 0;
  } catch (error) {
    console.warn("최고 점수를 불러오지 못했습니다.", error);
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch (error) {
    console.warn("최고 점수를 저장하지 못했습니다.", error);
  }
}

function randomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function updateScoreboard() {
  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  timerElement.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerItemElement.classList.toggle("is-urgent", secondsLeft <= 10 && secondsLeft > 0);
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  numbers.forEach((number, index) => {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.type = "button";
    cell.dataset.index = String(index);
    cell.setAttribute("aria-label", `${Math.floor(index / BOARD_SIZE) + 1}행 ${index % BOARD_SIZE + 1}열, ${number}`);
    cell.disabled = !isStarted || isGameOver;
    const apple = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    apple.classList.add("apple-icon");
    apple.setAttribute("viewBox", "0 0 64 64");
    apple.setAttribute("aria-hidden", "true");

    const leaf = document.createElementNS("http://www.w3.org/2000/svg", "path");
    leaf.classList.add("apple-leaf");
    leaf.setAttribute("d", "M33 13C31 6 37 3 46 4c-1 7-5 11-13 12");
    const stem = document.createElementNS("http://www.w3.org/2000/svg", "path");
    stem.classList.add("apple-stem");
    stem.setAttribute("d", "M31 16c1-5 1-8 4-11");
    const fruit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    fruit.classList.add("apple-fruit");
    fruit.setAttribute("d", "M32 17c-5-5-15-5-21 1-9 9-5 25 1 34 5 8 12 10 20 6 8 4 15 2 20-6 6-9 10-25 1-34-6-6-16-6-21-1Z");
    const shine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shine.classList.add("apple-shine");
    shine.setAttribute("d", "M15 28c1-5 4-9 8-11");

    apple.append(leaf, stem, fruit, shine);
    const value = document.createElement("span");
    value.className = "cell-value";
    value.textContent = String(number);
    cell.append(apple, value);
    fragment.append(cell);
  });

  boardElement.replaceChildren(fragment);
}

function selectedTotal() {
  return selectedCells.reduce((total, index) => total + numbers[index], 0);
}

function updateSelection() {
  boardElement.querySelectorAll(".cell").forEach((cell, index) => {
    cell.classList.toggle("is-selected", selectedCells.includes(index));
  });
}

function clearSelection() {
  selectedCells = [];
  updateSelection();
}

function getCellFromTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const cell = target.closest(".cell");
  return cell && boardElement.contains(cell) ? cell : null;
}

function addCellToSelection(index) {
  if (!isStarted || isGameOver) {
    return;
  }

  const lastIndex = selectedCells.at(-1);
  if (lastIndex === index) {
    return;
  }

  if (selectedCells.length > 1 && selectedCells.at(-2) === index) {
    selectedCells.pop();
  } else if (lastIndex === undefined || isAdjacent(lastIndex, index)) {
    if (!selectedCells.includes(index)) {
      selectedCells.push(index);
    }
  } else {
    return;
  }

  updateSelection();
  const total = selectedTotal();
  messageElement.textContent = `${selectedCells.length}개 선택 · 합계 ${total}${total % 10 === 0 ? " — 놓으면 수확!" : ""}`;
}

function isAdjacent(firstIndex, secondIndex) {
  const firstRow = Math.floor(firstIndex / BOARD_SIZE);
  const firstColumn = firstIndex % BOARD_SIZE;
  const secondRow = Math.floor(secondIndex / BOARD_SIZE);
  const secondColumn = secondIndex % BOARD_SIZE;
  return Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1;
}

function finishSelection() {
  if (!isStarted || isGameOver || selectedCells.length === 0) {
    return;
  }

  const total = selectedTotal();
  if (total > 0 && total % 10 === 0) {
    const isNewBestScore = score + total > bestScore;
    score += total;
    if (isNewBestScore) {
      bestScore = score;
      saveBestScore();
    }
    showConfetti();

    const harvestedCells = new Set(selectedCells);
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const remainingNumbers = [];
      for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
        const index = row * BOARD_SIZE + column;
        if (!harvestedCells.has(index)) {
          remainingNumbers.push(numbers[index]);
        }
      }

      let row = BOARD_SIZE - 1;
      for (const number of remainingNumbers) {
        numbers[row * BOARD_SIZE + column] = number;
        row -= 1;
      }
      while (row >= 0) {
        numbers[row * BOARD_SIZE + column] = randomNumber();
        row -= 1;
      }
    }

    renderBoard();
    updateScoreboard();
    clearSelection();
    messageElement.textContent = `수확 성공! +${total}점 🎉`;
    return;
  }

  clearSelection();
  messageElement.textContent = `합계 ${total}은 10의 배수가 아니에요. 다시 이어서 모아보세요!`;
}

boardElement.addEventListener("pointerdown", (event) => {
  const cell = getCellFromTarget(event.target);
  if (!cell || !isStarted || isGameOver || event.button !== 0) {
    return;
  }

  event.preventDefault();
  isDragging = true;
  activePointerId = event.pointerId;
  selectedCells = [];
  addCellToSelection(Number(cell.dataset.index));
});

document.addEventListener("pointermove", (event) => {
  if (!isDragging || event.pointerId !== activePointerId) {
    return;
  }

  const cell = getCellFromTarget(document.elementFromPoint(event.clientX, event.clientY));
  if (cell) {
    addCellToSelection(Number(cell.dataset.index));
  }
});

function endPointerSelection(event) {
  if (!isDragging || event.pointerId !== activePointerId) {
    return;
  }

  isDragging = false;
  activePointerId = null;
  finishSelection();
}

document.addEventListener("pointerup", endPointerSelection);
document.addEventListener("pointercancel", endPointerSelection);

boardElement.addEventListener("click", (event) => {
  if (event.detail !== 0 || !isStarted || isGameOver) {
    return;
  }

  const cell = getCellFromTarget(event.target);
  if (!cell) {
    return;
  }

  const index = Number(cell.dataset.index);
  if (selectedCells.at(-1) === index) {
    finishSelection();
  } else {
    addCellToSelection(index);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && selectedCells.length > 0) {
    clearSelection();
    messageElement.textContent = "선택을 취소했어요.";
  }
});

function endGame() {
  if (isGameOver || !isStarted) {
    return;
  }

  isGameOver = true;
  isDragging = false;
  activePointerId = null;
  window.clearInterval(timerIntervalId);
  timerIntervalId = null;
  boardElement.querySelectorAll(".cell").forEach((cell) => {
    cell.disabled = true;
  });
  clearSelection();
  finalScoreElement.textContent = String(score);
  resultBestScoreElement.textContent = String(bestScore);
  resultDialog.showModal();
  resultRestartButton.focus();
}

function startNewGame() {
  window.clearInterval(timerIntervalId);
  numbers = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, randomNumber);
  selectedCells = [];
  score = 0;
  secondsLeft = GAME_DURATION_SECONDS;
  isStarted = true;
  isGameOver = false;
  isDragging = false;
  activePointerId = null;
  gameEndsAt = Date.now() + GAME_DURATION_SECONDS * 1000;
  clearConfetti();
  if (resultDialog.open) {
    resultDialog.close();
  }
  renderBoard();
  updateScoreboard();
  messageElement.textContent = "사과 밭이 열렸어요. 많이 수확해 보세요!";
  startButton.hidden = true;
  restartButton.hidden = false;
  timerIntervalId = window.setInterval(updateTimer, 200);
  boardElement.querySelector(".cell")?.focus();
}

function updateTimer() {
  const nextSecondsLeft = Math.max(0, Math.ceil((gameEndsAt - Date.now()) / 1000));
  if (nextSecondsLeft !== secondsLeft) {
    secondsLeft = nextSecondsLeft;
    updateScoreboard();
  }
  if (secondsLeft === 0) {
    endGame();
  }
}

function showConfetti() {
  clearConfetti();
  const colors = ["#ffcf24", "#fff06a", "#ff5c8a", "#ff9d1e", "#f7f74a", "#fb72d0", "#7ee04c"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 150; index += 1) {
    const piece = document.createElement("span");
    piece.className = "pollen-particle";
    piece.style.setProperty("--left", `${Math.random() * 100}%`);
    piece.style.setProperty("--drift", `${Math.random() * 360 - 180}px`);
    piece.style.setProperty("--spin", `${Math.random() * 1440 - 720}deg`);
    piece.style.setProperty("--duration", `${5 + Math.random() * 2}s`);
    piece.style.setProperty("--delay", `${Math.random() * 0.25}s`);
    piece.style.setProperty("--confetti-color", colors[index % colors.length]);
    piece.classList.add(index % 3 === 0 ? "is-petal" : "is-pollen");
    fragment.append(piece);
  }

  confettiElement.replaceChildren(fragment);
  confettiTimeoutId = window.setTimeout(clearConfetti, 7600);
}

function clearConfetti() {
  if (confettiTimeoutId !== null) {
    window.clearTimeout(confettiTimeoutId);
    confettiTimeoutId = null;
  }
  confettiElement.replaceChildren();
}

startButton.addEventListener("click", startNewGame);
restartButton.addEventListener("click", startNewGame);
resultRestartButton.addEventListener("click", startNewGame);
resultDialog.addEventListener("cancel", (event) => event.preventDefault());

numbers = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, randomNumber);
renderBoard();
updateScoreboard();
restartButton.hidden = true;
