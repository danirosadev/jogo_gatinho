const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ===== Tela cheia =====
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);
ctx.imageSmoothingEnabled = false; // pixel art nítida

// ===== Sprites (com fallback) =====
const idle = new Image();
idle.src = "assets/Black-Idle.png";     // 6 frames, 48x48
const run = new Image();
run.src = "assets/Black-Run.png";       // 6 frames, 48x48
const fishImg = new Image();
fishImg.src = "assets/fish.png"; // 16x16 do PixelGnome (pode faltar)

// === Sons ===
const somColeta = new Audio("assets/sounds/collect.wav");
const musicaFundo = new Audio("assets/sounds/music.wav");

// Música de fundo em loop
musicaFundo.loop = true;
musicaFundo.volume = 0.3; // volume mais suave
somColeta.volume = 0.6;

musicaFundo.addEventListener("timeupdate", () => {
  if (musicaFundo.currentTime > musicaFundo.duration - 0.7) {
    musicaFundo.currentTime = 0;
    musicaFundo.play();
  }
});

// Reproduz música quando o usuário interage (requisito dos navegadores)
document.addEventListener("click", () => {
  if (musicaFundo.paused && !musicaMuted) musicaFundo.play().catch(() => {});
});

// === Controle do botão de som ===
const btnMusica = document.getElementById("music-toggle");
let musicaMuted = false;

btnMusica.addEventListener("click", () => {
  musicaMuted = !musicaMuted;

  if (musicaMuted) {
    musicaFundo.pause();
    btnMusica.textContent = "🔇";
  } else {
    musicaFundo.play();
    btnMusica.textContent = "🔊";
  }
});

// ===== Jogador =====
const SPRITE = { frameW: 48, frameH: 48, totalFrames: 6 };
const player = {
  x: 100, y: 0,
  escala: 3,
  frameAtual: 0,
  vx: 0, vy: 0,
  velocidade: 5,
  direcao: "direita",
  pulos: 0, maxPulos: 2,
  noChao: false,
  spriteAtual: idle
};

// ===== Mundo / câmera =====
let cameraX = 0;
let mundoLargura = 1000;        // cresce com geração infinita
const chaoAltura = 100;

// plataformas iniciais (mais variedade vertical)
let plataformas = [
  { x: 300,  y: () => canvas.height - 220, largura: 200, altura: 16 },
  { x: 650,  y: () => canvas.height - 280, largura: 160, altura: 16 },
  { x: 960,  y: () => canvas.height - 200, largura: 140, altura: 16 },
  { x: 1250, y: () => canvas.height - 320, largura: 180, altura: 16 }
];
// concretiza y em números (evita depender de altura antes do resize)
plataformas = plataformas.map(p => ({ ...p, y: p.y() }));

// ===== Fundo (parallax) =====
const nuvens = [
  { x: 120, y: 90,  r: 30, v: 0.3 },
  { x: 420, y: 120, r: 26, v: 0.45 },
  { x: 800, y: 100, r: 34, v: 0.25 }
];

// ===== Peixes (flutuação + fade) =====
let peixes = [];
let efeitosTexto = [];

function gerarPeixesIniciais() {
  peixes = [];
  for (let i = 0; i < 10; i++) {
    const p = plataformas[Math.floor(Math.random() * plataformas.length)];
    const baseY = p.y - 40;
    peixes.push({
      x: p.x + 10 + Math.random() * Math.max(10, p.largura - 20),
      baseY,
      y: baseY,
      largura: 40, altura: 40,   // escala do peixe (fica visível)
      coletado: false,
      alpha: 1,
      amplitude: 5 + Math.random() * 6,
      fase: Math.random() * Math.PI * 2
    });
  }
}
gerarPeixesIniciais();

// ===== Física =====
const gravidade = 0.6;
const forcaPulo = -12;

// ===== Entrada =====
const teclas = {};
document.addEventListener("keydown", e => (teclas[e.key] = true));
document.addEventListener("keyup",   e => (teclas[e.key] = false));

// ===== Pontuação =====
let pontuacao = 0;

// ===== Atualização =====
function atualizar() {
 // === Movimento horizontal ===
if (teclas["ArrowRight"]) {
  player.vx = player.velocidade;
  player.direcao = "direita";
  player.spriteAtual = run;
} else if (teclas["ArrowLeft"]) {
  player.vx = -player.velocidade;
  player.direcao = "esquerda";
  player.spriteAtual = run;
} else {
  player.vx = 0;
  player.spriteAtual = idle;
}

// === Limite à esquerda (sem travar o retorno) ===
const posGlobal = player.x + cameraX;

// Se tentar ir mais pra esquerda que o início do chão, trava
if (posGlobal < 0 && player.vx < 0) {
  player.x = -cameraX; // encosta no início do mundo
  player.vx = 0;
}

  // Pulo / duplo pulo
  if (teclas["ArrowUp"] && player.pulos < player.maxPulos) {
    player.vy = forcaPulo;
    player.noChao = false;
    player.pulos++;
    teclas["ArrowUp"] = false; // evita segurar para pular infinitamente
  }

  // Gravidade e posições
  player.vy += gravidade;
  player.y += player.vy;
  cameraX += player.vx;

  // Chão
  const chaoY = canvas.height - chaoAltura;
  const pw = SPRITE.frameW * player.escala;
  const ph = SPRITE.frameH * player.escala;
  let playerBottom = player.y + ph;

  if (playerBottom >= chaoY) {
    player.y = chaoY - ph;
    player.vy = 0;
    player.noChao = true;
    player.pulos = 0;
    playerBottom = player.y + ph;
  } else {
    player.noChao = false;
  }

  // Plataformas (colisão por cima)
  for (const p of plataformas) {
    const px = p.x - cameraX;
    if (
      player.x + pw > px &&
      player.x < px + p.largura &&
      playerBottom >= p.y &&
      playerBottom <= p.y + p.altura &&
      player.vy >= 0
    ) {
      player.y = p.y - ph;
      player.vy = 0;
      player.noChao = true;
      player.pulos = 0;
      playerBottom = player.y + ph;
    }
  }

  // Animação do gato (sem “piscar”)
  const velAnim = player.spriteAtual === run ? 0.25 : 0.12;
  player.frameAtual += velAnim;
  if (player.frameAtual >= SPRITE.totalFrames) player.frameAtual = 0;

  // Nuvens (sempre animam)
  nuvens.forEach(n => {
    n.x -= n.v;
    if (n.x < -100) n.x = mundoLargura + 120;
  });

  // Peixes: flutuação + fade
  const tempo = Date.now() / 400;
  peixes.forEach(f => {
    if (f.coletado) {
      f.alpha -= 0.05;
      if (f.alpha < 0) f.alpha = 0;
    } else {
      f.y = f.baseY + Math.sin(tempo + f.fase) * f.amplitude;
    }
  });

  // Efeitos "+10"
  efeitosTexto.forEach(e => {
    e.y -= 1;
    e.alpha -= 0.025;
  });
  efeitosTexto = efeitosTexto.filter(e => e.alpha > 0);

  // Coleta de peixes (AABB simples)
  peixes.forEach(f => {
    if (f.coletado || f.alpha <= 0) return;
    const fx = f.x - cameraX, fy = f.y, fw = f.largura, fh = f.altura;
    const px = player.x,     py = player.y;
    if (px < fx + fw && px + pw > fx && py < fy + fh && py + ph > fy) {
      f.coletado = true;
      pontuacao += 10;
      efeitosTexto.push({ x: fx + fw / 2, y: fy, alpha: 1 });
      // toca o som de coleta
        somColeta.currentTime = 0;
        somColeta.play();
    }
  });

  // Mundo infinito: gera blocos de plataformas à frente
  const margemGeracao = 800;
  const fimMundo = mundoLargura - margemGeracao;
  if (player.x + cameraX > fimMundo) {
    const baseX = mundoLargura;
    const blocos = 4; // mais plataformas por “lote”
    for (let i = 0; i < blocos; i++) {
      const nx = baseX + i * (140 + Math.random() * 60);
      const ny = canvas.height - (150 + Math.random() * 320);
      const largura = 140 + Math.random() * 120;
      plataformas.push({ x: nx, y: ny, largura, altura: 16 });

      peixes.push({
        x: nx + 30 + Math.random() * Math.max(10, largura - 60),
        baseY: ny - 40,
        y: ny - 40,
        largura: 40, altura: 40,
        coletado: false,
        alpha: 1,
        amplitude: 5 + Math.random() * 6,
        fase: Math.random() * Math.PI * 2
      });
    }
    mundoLargura += 600;
  }
}

// ===== Fundo (parallax) =====
function desenharFundo() {
  // Céu
  ctx.fillStyle = "#87CEEB";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Montanhas distantes (mais lentas)
  ctx.fillStyle = "#8FB9DE";
  for (let i = -1; i < 6; i++) {
    const x = i * 420 - (cameraX * 0.18) % 420;
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + 210, canvas.height - 260);
    ctx.lineTo(x + 420, canvas.height);
    ctx.fill();
  }

  // Colinas médias
  ctx.fillStyle = "#3C9E5C";
  for (let i = -1; i < 7; i++) {
    const x = i * 320 - (cameraX * 0.35) % 320;
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.quadraticCurveTo(x + 160, canvas.height - 110, x + 320, canvas.height);
    ctx.fill();
  }

  // Nuvens (bem lentas)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  nuvens.forEach(n => {
    const x = n.x - cameraX * 0.1;
    ctx.beginPath();
    ctx.arc(x, n.y, n.r, 0, Math.PI * 2);
    ctx.arc(x + 40, n.y + 10, n.r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - 40, n.y + 10, n.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ===== Desenho do jogador =====
function desenharPlayer() {
  const sprite = player.spriteAtual;
  const dx = player.x, dy = player.y;
  const dw = SPRITE.frameW * player.escala;
  const dh = SPRITE.frameH * player.escala;

  // fallback se sprite não carregou
  const spritePronto = sprite.complete && sprite.naturalWidth > 0;
  const sx = Math.floor(player.frameAtual) * SPRITE.frameW;
  const sy = 0;

  if (player.direcao === "esquerda") {
    ctx.save();
    ctx.translate(dx + dw / 2, 0);
    ctx.scale(-1, 1);
    if (spritePronto) {
      ctx.drawImage(sprite, sx, sy, SPRITE.frameW, SPRITE.frameH, -dw / 2, dy, dw, dh);
    } else {
      // placeholder
      ctx.fillStyle = "#333";
      ctx.fillRect(-dw / 2, dy, dw, dh);
      ctx.fillStyle = "#fff";
      ctx.fillText("🐱", -dw / 2 + dw/2 - 8, dy + dh/2 + 6);
    }
    ctx.restore();
  } else {
    if (spritePronto) {
      ctx.drawImage(sprite, sx, sy, SPRITE.frameW, SPRITE.frameH, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#333";
      ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = "#fff";
      ctx.fillText("🐱", dx + dw/2 - 8, dy + dh/2 + 6);
    }
  }
}

// ===== Desenho de peixes e HUD =====
function desenharPeixes() {
  peixes.forEach(f => {
    if (f.alpha <= 0) return;
    const fx = f.x - cameraX;

    const pronto = fishImg.complete && fishImg.naturalWidth > 0;
    ctx.save();
    ctx.globalAlpha = f.alpha;
    if (pronto) {
      ctx.drawImage(fishImg, fx, f.y, f.largura, f.altura);
    } else {
      // placeholder do peixe
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(fx, f.y, f.largura, f.altura);
      ctx.fillStyle = "#000";
      ctx.fillRect(fx + f.largura*0.65, f.y + f.altura*0.35, 4, 4); // "olhinho"
    }
    ctx.restore();
  });

  // "+10"
  ctx.font = "20px Arial";
  ctx.fillStyle = "yellow";
  efeitosTexto.forEach(e => {
    ctx.globalAlpha = e.alpha;
    ctx.fillText("+10", e.x, e.y);
  });
  ctx.globalAlpha = 1;
}

function desenharPontuacao() {
  ctx.save();
  ctx.font = "bold 32px 'Press Start 2P', monospace";
  ctx.fillStyle = "#FFD700"; // dourado
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000"; // contorno preto para destacar
  ctx.strokeText(`Peixes: ${pontuacao}`, 20, 50);
  ctx.fillText(`Peixes: ${pontuacao}`, 20, 50);
  ctx.restore();
}

// ===== Loop =====
function loop() {
  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    desenharFundo();

    // chão contínuo
    ctx.fillStyle = "#228B22";
    ctx.fillRect(-cameraX - 200, canvas.height - chaoAltura, mundoLargura + 1000, chaoAltura);

    // plataformas
    ctx.fillStyle = "#8B4513";
    plataformas.forEach(p => {
      ctx.fillRect(p.x - cameraX, p.y, p.largura, p.altura);
    });

    // peixes + player + HUD
    desenharPeixes();
    desenharPlayer();
    desenharPontuacao();

    atualizar();
  } catch (err) {
    console.error(err);
    // mensagem discreta em caso de erro
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(10, canvas.height - 34, canvas.width - 20, 24);
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.fillText("Erro no loop: " + err.message, 16, canvas.height - 18);
  } finally {
    requestAnimationFrame(loop);
  }
}
loop();


