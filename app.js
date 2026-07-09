const STORAGE_KEY = "miaomiaomiao.pet.v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  petSubtitle: $("#petSubtitle"),
  shells: $("#shells"),
  memoryCount: $("#memoryCount"),
  speech: $("#speech"),
  roomScene: $("#roomScene"),
  catSvg: $("#catSvg"),
  petButton: $("#petButton"),
  miniLog: $("#miniLog"),
  roomMood: $("#roomMood"),
  albumSubtitle: $("#albumSubtitle"),
  albumList: $("#albumList"),
  growthSubtitle: $("#growthSubtitle"),
  bondValue: $("#bondValue"),
  curiosityValue: $("#curiosityValue"),
  traitValue: $("#traitValue"),
  resetButton: $("#resetButton"),
  miniGame: $("#miniGame"),
  starCanvas: $("#starCanvas"),
  closeMini: $("#closeMini"),
  startMini: $("#startMini"),
  miniStatus: $("#miniStatus"),
  miniScore: $("#miniScore"),
  miniTime: $("#miniTime"),
};

const statEls = {
  hunger: { value: $("#hungerValue"), fill: $("#hungerFill") },
  clean: { value: $("#cleanValue"), fill: $("#cleanFill") },
  mood: { value: $("#moodValue"), fill: $("#moodFill") },
  energy: { value: $("#energyValue"), fill: $("#energyFill") },
};

const now = () => Date.now();
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const pick = (items) => items[Math.floor(Math.random() * items.length)];

function createFreshState() {
  const firstDate = now();

  return {
    hunger: 74,
    clean: 82,
    mood: 78,
    energy: 84,
    bond: 10,
    curiosity: 8,
    shells: 18,
    stage: "幼崽期",
    trait: "黏人",
    decor: ["music"],
    busy: null,
    message: "",
    messageUntil: 0,
    lastTick: firstDate,
    behaviors: {
      feed: 0,
      clean: 0,
      pat: 0,
      play: 0,
      explore: 0,
      sleep: 0,
    },
    album: [
      {
        id: firstDate,
        title: "初次见面",
        text: "浅灰色的小猫从星尘蛋里探出脑袋，第一声是很轻的一句喵。",
        date: firstDate,
      },
    ],
    log: ["小灰搬进了这个小窝。"],
  };
}

function mergeState(saved) {
  const fresh = createFreshState();

  return {
    ...fresh,
    ...saved,
    behaviors: { ...fresh.behaviors, ...(saved?.behaviors || {}) },
    decor: Array.isArray(saved?.decor) ? saved.decor : fresh.decor,
    album: Array.isArray(saved?.album) && saved.album.length ? saved.album : fresh.album,
    log: Array.isArray(saved?.log) ? saved.log : fresh.log,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFreshState();
    return mergeState(JSON.parse(raw));
  } catch {
    return createFreshState();
  }
}

let state = loadState();

function saveState() {
  state.lastTick = now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addLog(text) {
  state.log = [text, ...state.log].slice(0, 4);
}

function addMemory(title, text) {
  state.album = [
    {
      id: now() + Math.random(),
      title,
      text,
      date: now(),
    },
    ...state.album,
  ].slice(0, 24);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setMessage(text, duration = 3800) {
  state.message = text;
  state.messageUntil = now() + duration;
}

function changeStats(delta) {
  state.hunger = clamp(state.hunger + (delta.hunger || 0));
  state.clean = clamp(state.clean + (delta.clean || 0));
  state.mood = clamp(state.mood + (delta.mood || 0));
  state.energy = clamp(state.energy + (delta.energy || 0));
  state.bond = clamp(state.bond + (delta.bond || 0), 0, 999);
  state.curiosity = clamp(state.curiosity + (delta.curiosity || 0), 0, 999);
  state.shells = Math.max(0, state.shells + (delta.shells || 0));
}

function applyOfflineDecay() {
  const elapsed = now() - (state.lastTick || now());
  const steps = Math.min(16, Math.floor(elapsed / 600000));
  if (!steps) return;

  changeStats({
    hunger: -steps * 2,
    clean: -steps * 1.2,
    energy: -steps,
    mood: -steps * 0.8,
  });

  if (steps > 4) {
    addLog("小灰等了一会儿，看到你回来后精神了一点。");
  }
}

function computeTrait() {
  const map = [
    ["play", "活泼"],
    ["explore", "冒险"],
    ["sleep", "安稳"],
    ["pat", "黏人"],
    ["clean", "讲究"],
    ["feed", "贪吃"],
  ];
  const winner = map.reduce((best, item) => {
    const [key] = item;
    return state.behaviors[key] > state.behaviors[best[0]] ? item : best;
  }, map[3]);

  if (state.behaviors[winner[0]] === 0) return "黏人";
  return winner[1];
}

function updateGrowth() {
  const oldStage = state.stage;
  const growthScore =
    state.bond +
    state.curiosity +
    state.behaviors.play * 4 +
    state.behaviors.explore * 5 +
    state.behaviors.pat * 2 +
    state.behaviors.sleep * 2;

  if (growthScore >= 185) {
    state.stage = "星灵期";
  } else if (growthScore >= 76) {
    state.stage = "成长期";
  } else {
    state.stage = "幼崽期";
  }

  state.trait = computeTrait();

  if (oldStage && oldStage !== state.stage) {
    addMemory("新的成长", `小灰进入了${state.stage}，尾巴尖像藏着一点星光。`);
    addLog(`小灰长大到了${state.stage}。`);
    setMessage(`喵！小灰进入${state.stage}了。`, 5200);
  }
}

function ambientMessage() {
  if (state.busy?.type === "explore") {
    return `小灰正在探索，${Math.max(0, Math.ceil((state.busy.endsAt - now()) / 1000))} 秒后回来。`;
  }
  if (state.busy?.type === "sleep") {
    return `小灰窝成一团，${Math.max(0, Math.ceil((state.busy.endsAt - now()) / 1000))} 秒后醒来。`;
  }
  if (state.hunger < 25) return "小灰把空碗推到你面前，又轻轻喵了一声。";
  if (state.clean < 25) return "小灰抖了抖毛，假装自己一点也不乱。";
  if (state.energy < 25) return "小灰的眼皮开始打架，尾巴慢慢垂下来了。";
  if (state.mood < 30) return "小灰缩在垫子边上，等你靠近它。";
  if (state.mood > 82 && state.bond > 45) return "小灰绕着你转圈，爪子踩得很轻。";
  if (state.curiosity > state.bond + 20) return "小灰盯着窗外，像发现了新的星星路线。";
  return pick(["喵。", "小灰眨了眨眼。", "尾巴尖轻轻晃了一下。", "小灰把爪子搭在碗边。"]);
}

function roomMoodText() {
  const names = [];
  if (state.decor.includes("telescope")) names.push("适合看星星");
  if (state.decor.includes("music")) names.push("有轻轻的旋律");
  if (state.decor.includes("pillow")) names.push("软乎乎");
  return names.length ? names.join(" · ") : "安静又亮堂";
}

function renderStats() {
  Object.entries(statEls).forEach(([key, els]) => {
    const value = Math.round(state[key]);
    els.value.textContent = value;
    els.fill.style.width = `${value}%`;
  });
}

function renderDecor() {
  ["telescope", "music", "pillow"].forEach((item) => {
    elements.roomScene.classList.toggle(`has-${item}`, state.decor.includes(item));
    const button = $(`[data-decor="${item}"]`);
    if (button) button.classList.toggle("active", state.decor.includes(item));
  });
  elements.roomMood.textContent = roomMoodText();
}

function renderAlbum() {
  elements.memoryCount.textContent = state.album.length;
  elements.albumSubtitle.textContent = state.album.length > 1 ? `已经留下 ${state.album.length} 个瞬间` : "新的小事会留在这里";
  elements.albumList.innerHTML = state.album
    .map(
      (entry) => `
        <article class="album-item">
          <time datetime="${new Date(entry.date).toISOString()}">${formatDate(entry.date)}</time>
          <h3>${entry.title}</h3>
          <p>${entry.text}</p>
        </article>
      `,
    )
    .join("");
}

function renderLog() {
  elements.miniLog.innerHTML = state.log.map((line) => `<div class="log-line">${line}</div>`).join("");
}

function renderGrowth() {
  elements.petSubtitle.textContent = `浅灰小猫 · ${state.stage}`;
  elements.growthSubtitle.textContent = `${state.stage} · ${state.trait}型`;
  elements.bondValue.textContent = Math.round(state.bond);
  elements.curiosityValue.textContent = Math.round(state.curiosity);
  elements.traitValue.textContent = `${state.trait}型`;

  elements.catSvg.classList.toggle("stage-teen", state.stage === "成长期");
  elements.catSvg.classList.toggle("stage-star", state.stage === "星灵期");
}

function renderButtons() {
  const busy = Boolean(state.busy);
  $$("[data-action]").forEach((button) => {
    button.disabled = busy;
  });
}

function renderMoodClasses() {
  elements.catSvg.classList.toggle("sleepy", state.busy?.type === "sleep" || state.energy < 28);
  elements.catSvg.classList.toggle("low", state.mood < 32 || state.hunger < 18 || state.clean < 18);
}

function render() {
  updateGrowth();
  renderStats();
  renderDecor();
  renderAlbum();
  renderLog();
  renderGrowth();
  renderButtons();
  renderMoodClasses();

  elements.shells.textContent = state.shells;
  elements.speech.textContent = state.messageUntil > now() ? state.message : ambientMessage();
}

function completeBusyIfNeeded() {
  if (!state.busy || state.busy.endsAt > now()) return;

  const { type } = state.busy;
  state.busy = null;

  if (type === "explore") {
    const reward = pick([
      ["窗边小石头", "小灰从窗边带回一颗凉凉的小石头，像小小的月亮。"],
      ["蓝色羽片", "小灰叼回一片蓝色羽片，然后骄傲地坐直了。"],
      ["星屑纽扣", "小灰在角落里找到一枚发亮的纽扣，认真推给了你。"],
    ]);
    changeStats({ mood: 9, curiosity: 14, shells: 7, clean: -4, hunger: -4 });
    addMemory(reward[0], reward[1]);
    addLog(`探索完成，获得 7 个星贝。`);
    setMessage("小灰回来了，还带着一点外面的风。", 5200);
  }

  if (type === "sleep") {
    const pillowBonus = state.decor.includes("pillow") ? 10 : 0;
    changeStats({ energy: 32 + pillowBonus, mood: 7, hunger: -3 });
    addMemory("一场短梦", "小灰睡醒后伸了个懒腰，像刚从柔软的云里回来。");
    addLog("小灰睡醒了，精神恢复了。");
    setMessage("喵呜。小灰睡得很好。", 4600);
  }

  saveState();
}

function nudgePet() {
  elements.petButton.classList.remove("action-pop");
  window.requestAnimationFrame(() => {
    elements.petButton.classList.add("action-pop");
  });
}

const actions = {
  feed() {
    state.behaviors.feed += 1;
    changeStats({ hunger: 18, mood: 5, clean: -2, bond: 1 });
    addLog("小灰吃掉了一份星星鱼干。");
    if (state.behaviors.feed === 1) {
      addMemory("第一顿饭", "小灰把碗舔得很干净，胡须上还沾着一点亮晶晶的碎屑。");
    }
    setMessage(pick(["好吃。喵。", "小灰把碗推近了一点。", "小灰认真嚼完最后一口。"]));
    nudgePet();
    saveState();
    render();
  },

  clean() {
    state.behaviors.clean += 1;
    changeStats({ clean: 26, mood: 3, energy: -4, bond: 1 });
    addLog("小灰的毛变得蓬松又干净。");
    setMessage(pick(["小灰甩了甩耳朵。", "浅灰色的毛蓬起来了。", "小灰闻了闻自己的爪子。"]));
    nudgePet();
    saveState();
    render();
  },

  pat() {
    state.behaviors.pat += 1;
    changeStats({ mood: 12, bond: 8, energy: -2 });
    addLog("小灰靠过来，轻轻蹭了一下。");
    if (state.behaviors.pat === 3) {
      addMemory("固定的位置", "小灰发现你的手边很适合趴着，于是把那里认成了自己的位置。");
    }
    setMessage(pick(["呼噜呼噜。", "小灰闭上眼睛，把脑袋凑近了。", "再摸一下也可以。"]));
    nudgePet();
    saveState();
    render();
  },

  play() {
    openMiniGame();
  },

  explore() {
    if (state.energy < 24 || state.hunger < 18) {
      setMessage("小灰现在有点没力气，先照顾一下它吧。");
      render();
      return;
    }

    state.behaviors.explore += 1;
    state.busy = { type: "explore", endsAt: now() + 12000 };
    changeStats({ energy: -10, hunger: -5, mood: 2 });
    addLog("小灰背着小包出门探索。");
    setMessage("小灰跑向窗边的小路。", 2200);
    saveState();
    render();
  },

  sleep() {
    state.behaviors.sleep += 1;
    state.busy = { type: "sleep", endsAt: now() + 9000 };
    addLog("小灰团成一小团睡着了。");
    setMessage("小灰把尾巴盖在鼻尖上。", 2200);
    saveState();
    render();
  },
};

function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  actions[action]?.();
}

function toggleDecor(event) {
  const decor = event.currentTarget.dataset.decor;
  const hasDecor = state.decor.includes(decor);
  state.decor = hasDecor ? state.decor.filter((item) => item !== decor) : [...state.decor, decor];

  const names = {
    telescope: "望远镜",
    music: "音乐盒",
    pillow: "云朵垫",
  };

  if (!hasDecor) {
    changeStats({ mood: 2, curiosity: decor === "telescope" ? 3 : 0 });
    addLog(`小窝里摆上了${names[decor]}。`);
  } else {
    addLog(`${names[decor]}被收起来了。`);
  }

  setMessage(hasDecor ? "小灰看了看空出来的位置。" : "小灰绕着新摆设转了一圈。");
  saveState();
  render();
}

function switchTab(event) {
  const tab = event.currentTarget.dataset.tab;
  $$("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $$("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === tab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}

function softTick() {
  completeBusyIfNeeded();

  if (!state.busy) {
    const musicBonus = state.decor.includes("music") ? 0.2 : 0;
    changeStats({
      hunger: -0.35,
      clean: -0.22,
      energy: -0.18,
      mood: musicBonus - (state.hunger < 34 || state.clean < 30 ? 0.45 : 0.08),
    });
  }

  saveState();
  render();
}

const mini = {
  running: false,
  finished: false,
  score: 0,
  timeLeft: 20,
  lastFrame: 0,
  spawnTimer: 0,
  width: 720,
  height: 420,
  playerX: 360,
  stars: [],
};

const ctx = elements.starCanvas.getContext("2d");

function setMiniButtonText(text) {
  elements.startMini.querySelector("span").textContent = text;
}

function resizeMiniCanvas() {
  const rect = elements.starCanvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  mini.width = rect.width || 720;
  mini.height = rect.height || 420;
  elements.starCanvas.width = mini.width * ratio;
  elements.starCanvas.height = mini.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  mini.playerX = clamp(mini.playerX, 52, mini.width - 52);
}

function drawStar(x, y, size, rotation, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? size : size * 0.45;
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#6a5a28";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMiniBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, mini.height);
  gradient.addColorStop(0, "#dff7ff");
  gradient.addColorStop(0.7, "#fff5d8");
  gradient.addColorStop(1, "#e8f3df");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, mini.width, mini.height);

  ctx.strokeStyle = "rgba(46, 156, 154, 0.18)";
  ctx.lineWidth = 1;
  for (let x = 0; x < mini.width; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, mini.height * 0.72);
    ctx.lineTo(x - 28, mini.height);
    ctx.stroke();
  }

  ctx.fillStyle = "#6cad6b";
  ctx.beginPath();
  ctx.ellipse(mini.width * 0.16, mini.height - 18, 110, 38, 0, 0, Math.PI * 2);
  ctx.ellipse(mini.width * 0.82, mini.height - 14, 138, 42, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMiniCat() {
  const x = mini.playerX;
  const y = mini.height - 66;

  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#283842";
  ctx.fillStyle = "#cfd5d8";

  ctx.beginPath();
  ctx.moveTo(x - 48, y + 16);
  ctx.quadraticCurveTo(x, y + 42, x + 48, y + 16);
  ctx.lineTo(x + 34, y + 50);
  ctx.lineTo(x - 34, y + 50);
  ctx.closePath();
  ctx.fillStyle = "#dff5f3";
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#cfd5d8";
  ctx.beginPath();
  ctx.moveTo(x - 31, y - 6);
  ctx.lineTo(x - 19, y - 34);
  ctx.lineTo(x - 4, y - 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 31, y - 6);
  ctx.lineTo(x + 19, y - 34);
  ctx.lineTo(x + 4, y - 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x, y, 42, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 17, y - 3);
  ctx.quadraticCurveTo(x - 11, y - 8, x - 5, y - 3);
  ctx.moveTo(x + 5, y - 3);
  ctx.quadraticCurveTo(x + 11, y - 8, x + 17, y - 3);
  ctx.stroke();

  ctx.fillStyle = "#ef7465";
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 9);
  ctx.quadraticCurveTo(x, y + 13, x + 5, y + 9);
  ctx.quadraticCurveTo(x, y + 17, x - 5, y + 9);
  ctx.fill();
  ctx.restore();
}

function drawMini() {
  drawMiniBackground();
  mini.stars.forEach((star) => {
    drawStar(star.x, star.y, star.size, star.rotation, star.color);
  });
  drawMiniCat();
}

function spawnStar() {
  mini.stars.push({
    x: 24 + Math.random() * (mini.width - 48),
    y: -24,
    size: 10 + Math.random() * 8,
    speed: 110 + Math.random() * 92,
    rotation: Math.random() * Math.PI,
    spin: Math.random() > 0.5 ? 1 : -1,
    color: Math.random() > 0.28 ? "#f5bd49" : "#ef7465",
  });
}

function miniLoop(timestamp) {
  if (!mini.running) {
    drawMini();
    return;
  }

  const delta = Math.min(50, timestamp - (mini.lastFrame || timestamp));
  mini.lastFrame = timestamp;
  mini.timeLeft -= delta / 1000;
  mini.spawnTimer -= delta;

  if (mini.spawnTimer <= 0) {
    spawnStar();
    mini.spawnTimer = Math.max(320, 780 - mini.score * 12);
  }

  mini.stars.forEach((star) => {
    star.y += (star.speed * delta) / 1000;
    star.rotation += (star.spin * delta) / 600;
  });

  mini.stars = mini.stars.filter((star) => {
    const caught = star.y > mini.height - 112 && Math.abs(star.x - mini.playerX) < 54;
    if (caught) {
      mini.score += 1;
      elements.miniScore.textContent = mini.score;
      return false;
    }
    return star.y < mini.height + 30;
  });

  elements.miniTime.textContent = Math.max(0, Math.ceil(mini.timeLeft));
  drawMini();

  if (mini.timeLeft <= 0) {
    finishMini(true);
    return;
  }

  requestAnimationFrame(miniLoop);
}

function startMiniGame() {
  resizeMiniCanvas();
  mini.running = true;
  mini.finished = false;
  mini.score = 0;
  mini.timeLeft = 20;
  mini.lastFrame = 0;
  mini.spawnTimer = 0;
  mini.stars = [];
  mini.playerX = mini.width / 2;
  elements.miniScore.textContent = "0";
  elements.miniTime.textContent = "20";
  elements.miniStatus.textContent = "小灰抬头看着星星";
  setMiniButtonText("重开");
  requestAnimationFrame(miniLoop);
}

function finishMini(applyReward) {
  mini.running = false;
  mini.finished = true;
  setMiniButtonText("再来");

  if (!applyReward) {
    elements.miniStatus.textContent = "暂停";
    drawMini();
    return;
  }

  const reward = Math.max(3, Math.floor(mini.score / 2));
  state.behaviors.play += 1;
  changeStats({
    mood: Math.min(18, 6 + mini.score),
    bond: Math.min(12, 3 + Math.floor(mini.score / 3)),
    curiosity: 4,
    energy: -10,
    hunger: -3,
    shells: reward,
  });

  if (state.behaviors.play === 1) {
    addMemory("第一次接星星", "小灰追着落下的星星跑，最后坐在光点中间发呆。");
  } else if (mini.score >= 16) {
    addMemory("漂亮的一局", `小灰接住了 ${mini.score} 颗星星，尾巴摇得停不下来。`);
  }

  addLog(`接星星得分 ${mini.score}，获得 ${reward} 个星贝。`);
  setMessage(`小灰接住了 ${mini.score} 颗星星。`, 4400);
  elements.miniStatus.textContent = `完成，获得 ${reward} 个星贝`;
  saveState();
  render();
  drawMini();
}

function openMiniGame() {
  elements.miniGame.hidden = false;
  setMiniButtonText("开始");
  elements.miniStatus.textContent = "准备";
  elements.miniScore.textContent = "0";
  elements.miniTime.textContent = "20";
  window.requestAnimationFrame(() => {
    resizeMiniCanvas();
    mini.playerX = mini.width / 2;
    mini.stars = [];
    drawMini();
  });
}

function closeMiniGame() {
  if (mini.running) finishMini(false);
  elements.miniGame.hidden = true;
}

function moveMiniPlayer(event) {
  if (elements.miniGame.hidden) return;
  const rect = elements.starCanvas.getBoundingClientRect();
  const clientX = event.clientX ?? event.touches?.[0]?.clientX;
  mini.playerX = clamp(clientX - rect.left, 52, rect.width - 52);
}

applyOfflineDecay();
completeBusyIfNeeded();
render();
drawMini();

$$("[data-action]").forEach((button) => button.addEventListener("click", handleAction));
$$("[data-decor]").forEach((button) => button.addEventListener("click", toggleDecor));
$$("[data-tab]").forEach((button) => button.addEventListener("click", switchTab));
elements.petButton.addEventListener("click", actions.pat);
elements.resetButton.addEventListener("click", () => {
  if (!window.confirm("要重新开始小灰的生活吗？")) return;
  state = createFreshState();
  saveState();
  render();
});

elements.startMini.addEventListener("click", startMiniGame);
elements.closeMini.addEventListener("click", closeMiniGame);
elements.miniGame.addEventListener("click", (event) => {
  if (event.target === elements.miniGame) closeMiniGame();
});
elements.starCanvas.addEventListener("pointerdown", moveMiniPlayer);
elements.starCanvas.addEventListener("pointermove", moveMiniPlayer);
window.addEventListener("resize", () => {
  if (!elements.miniGame.hidden) {
    resizeMiniCanvas();
    drawMini();
  }
});

setInterval(softTick, 7000);
setInterval(() => {
  completeBusyIfNeeded();
  render();
}, 1000);
