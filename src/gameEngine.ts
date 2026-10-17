// Game Engine for "Лабиринт и Зомби: Пиксельный Охотник"

export interface HudCallbacks {
  onStatsChange: (stats: {
    hp: number;
    maxHp: number;
    arrows: number;
    armorLevel: number;
    swordLevel: number;
    swordDamage: number;
    bowLevel: number;
    bowDamage: number;
    score: number;
    nextUpgradeScore: number;
    zoneName: string;
    zoneTitle: string;
    zoneSub: string;
    bossActive: boolean;
    bossHp: number;
    bossMaxHp: number;
    bossStatusText: string;
  }) => void;
  onShowToast: (message: string) => void;
  onGameOver: (score: number, levelText: string) => void;
  onRequestUpgradeChoice: (levels: { armorLevel: number; swordLevel: number; bowLevel: number }) => void;
  onStairsPrompt: (text: string | null) => void;
}

export function initGameEngine(
  canvas: HTMLCanvasElement,
  miniCanvas: HTMLCanvasElement,
  callbacks: HudCallbacks
) {
  const ctx = canvas.getContext('2d')!;
  const miniCtx = miniCanvas.getContext('2d')!;

  /* ==========================================================================
     1. ЗВУКОВОЙ ДВИЖОК (Web Audio API)
     ========================================================================== */
  const Sound = {
    ctx: null as AudioContext | null,
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    tone(freqStart: number, freqEnd: number, duration: number, type: OscillatorType = 'square', vol = 0.25) {
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    },
    sword() { this.tone(360, 95, 0.13, 'triangle', 0.3); },
    bow()   { this.tone(520, 880, 0.09, 'sine', 0.25); },
    hit()   { this.tone(160, 45, 0.1, 'square', 0.28); },
    crate() { this.tone(210, 55, 0.14, 'sawtooth', 0.25); },
    bossSlam() { this.tone(110, 28, 0.38, 'sawtooth', 0.42); },
    pickup() {
      if (!this.ctx) return;
      this.tone(587, 880, 0.14, 'sine', 0.22);
    },
    upgrade() {
      if (!this.ctx) return;
      this.tone(440, 660, 0.12, 'triangle', 0.3);
      setTimeout(() => this.tone(660, 990, 0.2, 'sine', 0.32), 100);
    },
    hurt()  { this.tone(190, 65, 0.2, 'sawtooth', 0.35); }
  };

  /* ==========================================================================
     2. ГЕНЕРАТОР ПИКСЕЛЬ-АРТ СПРАЙТОВ
     ========================================================================== */
  const Sprites: { cache: Record<string, HTMLCanvasElement>; init: () => void } = {
    cache: {},
    init() {
      const createCanvas = (w: number, h: number) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cCtx = c.getContext('2d')!;
        cCtx.imageSmoothingEnabled = false;
        return { c, ctx: cCtx };
      };

      const drawMatrix = (cCtx: CanvasRenderingContext2D, matrix: string[], palette: Record<string, string>, ox = 0, oy = 0) => {
        for (let y = 0; y < matrix.length; y++) {
          const row = matrix[y];
          for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (ch !== '.' && palette[ch]) {
              cCtx.fillStyle = palette[ch];
              cCtx.fillRect(ox + x, oy + y, 1, 1);
            }
          }
        }
      };

      // 1. Земля
      for (let v = 0; v < 4; v++) {
        const { c, ctx: cCtx } = createCanvas(16, 16);
        cCtx.fillStyle = '#8c583a';
        cCtx.fillRect(0, 0, 16, 16);
        const noise2d: [number, number, string][] = [
          [2,2,'#75472d'],[11,4,'#9e6646'],[5,12,'#75472d'],[13,11,'#633a24'],
          [7,6,'#9e6646'],[3,9,'#633a24'],[10,14,'#75472d']
        ];
        for (const [x, y, col] of noise2d) {
          cCtx.fillStyle = col;
          cCtx.fillRect((x + v * 3) % 15, (y + v * 5) % 15, 2, 1);
        }
        if (v === 1) {
          cCtx.fillStyle = '#94a3b8'; cCtx.fillRect(4, 5, 2, 2);
          cCtx.fillStyle = '#cbd5e1'; cCtx.fillRect(4, 5, 1, 1);
        } else if (v === 2) {
          cCtx.fillStyle = '#4d7c2b'; cCtx.fillRect(12, 3, 2, 2);
        }
        this.cache['floor_' + v] = c;
      }

      for (let v = 0; v < 4; v++) {
        const { c, ctx: cCtx } = createCanvas(16, 16);
        cCtx.fillStyle = '#3b6e28';
        cCtx.fillRect(0, 0, 16, 16);
        cCtx.fillStyle = '#2d571e';
        cCtx.fillRect((3 + v * 3) % 14, (2 + v * 5) % 14, 3, 2);
        cCtx.fillStyle = '#558b3e';
        cCtx.fillRect((5 + v * 4) % 13, (6 + v * 2) % 13, 1, 3);
        this.cache['floor_grass_' + v] = c;
      }

      for (let v = 0; v < 4; v++) {
        const { c, ctx: cCtx } = createCanvas(16, 16);
        cCtx.fillStyle = '#2e353b';
        cCtx.fillRect(0, 0, 16, 16);
        cCtx.fillStyle = '#23292e';
        cCtx.fillRect((2 + v * 4) % 14, (4 + v * 3) % 14, 3, 2);
        this.cache['floor_grave_' + v] = c;

        const { c: dC, ctx: dCtx } = createCanvas(16, 16);
        dCtx.fillStyle = '#1e242b';
        dCtx.fillRect(0, 0, 16, 16);
        dCtx.strokeStyle = '#13171c';
        dCtx.strokeRect(0.5, 0.5, 15, 15);
        this.cache['floor_dungeon_' + v] = dC;
      }

      // Стены
      const { c: wallC, ctx: wCtx } = createCanvas(16, 16);
      wCtx.fillStyle = '#2d4c1e';
      wCtx.fillRect(0, 0, 16, 16);
      const treeMat = [
        ".....GGGGGG.....",
        "...GGLLLLLLGG...",
        "..GLLHHHHHHLLG..",
        ".GLLHHHHHHHHLLG.",
        ".GLHHHLLLLHHHLG.",
        "GLLHLLLLLLLLHLLG",
        "GLLLLDDDDDDLLLLG",
        "GLLDDDDDDDDDDLLG",
        ".GDDDDDDDDDDDDG.",
        "..GGDDTTTTDDGG..",
        ".....TTTTTT.....",
        ".....TTBBTT.....",
        ".....TTBBTT.....",
        "....TTTBBTTT....",
        "...SSSSSSSSSS...",
        "................"
      ];
      drawMatrix(wCtx, treeMat, {
        'G': '#142913', 'D': '#1e4620', 'L': '#2e6f2e', 'H': '#55a630',
        'T': '#5c3a21', 'B': '#3d2514', 'S': '#1b3014'
      });
      this.cache['wall_tree'] = wallC;

      const { c: stoneC, ctx: sCtx } = createCanvas(16, 16);
      sCtx.fillStyle = '#1e242b';
      sCtx.fillRect(0, 0, 16, 16);
      sCtx.fillStyle = '#38414e';
      sCtx.fillRect(1, 1, 6, 6);
      sCtx.fillRect(8, 1, 7, 6);
      sCtx.fillRect(1, 8, 9, 7);
      sCtx.fillRect(11, 8, 4, 7);
      this.cache['wall_stone'] = stoneC;

      // Пропсы
      const { c: crateC, ctx: crCtx } = createCanvas(16, 16);
      const crateMat = [
        "..KKKKKKKKKKKK..",
        ".KLLLLLLLLLLLLK.",
        ".KLBBBBBBBBBBBLK",
        ".KLBDDDDDDDDBLK.",
        ".KLBDLLLLLLDBLK.",
        ".KLBDLBBBBLLBLK.",
        ".KLBDLBKKBLLBLK.",
        ".KLBDLLKKBDLBLK.",
        ".KLBDLLLLDDBLK..",
        ".KLBDDDDDDDDBLK.",
        ".KLBBBBBBBBBBBLK",
        ".KDDDDDDDDDDDDK.",
        "..KKKKKKKKKKKK.."
      ];
      drawMatrix(crCtx, crateMat, { 'K': '#1c120c', 'L': '#b87d4b', 'B': '#8f5931', 'D': '#5e381d' });
      this.cache['prop_crate'] = crateC;

      const { c: barC, ctx: bCtx } = createCanvas(16, 16);
      bCtx.fillStyle = '#8c5230';
      bCtx.fillRect(2, 2, 12, 12);
      bCtx.fillStyle = '#64748b';
      bCtx.fillRect(2, 5, 12, 2);
      bCtx.fillRect(2, 9, 12, 2);
      this.cache['prop_barrel'] = barC;

      // Люк спуска
      const { c: stairC, ctx: stCtx } = createCanvas(16, 16);
      stCtx.fillStyle = '#0f172a'; stCtx.fillRect(1, 1, 14, 14);
      stCtx.strokeStyle = '#38bdf8'; stCtx.lineWidth = 2; stCtx.strokeRect(2, 2, 12, 12);
      stCtx.fillStyle = '#f59e0b';
      for (let y = 4; y <= 11; y += 3) stCtx.fillRect(4, y, 8, 2);
      this.cache['stairs'] = stairC;

      // Лестница наверх
      const { c: upC, ctx: upCtx } = createCanvas(16, 16);
      upCtx.fillStyle = '#1e293b'; upCtx.fillRect(1, 1, 14, 14);
      upCtx.strokeStyle = '#22c55e'; upCtx.lineWidth = 2; upCtx.strokeRect(2, 2, 12, 12);
      upCtx.fillStyle = '#86efac';
      for (let y = 4; y <= 11; y += 3) upCtx.fillRect(4, y, 8, 2);
      this.cache['stairs_up'] = upC;

      // Сердечко и патроны
      const { c: heartC, ctx: hCtx } = createCanvas(16, 16);
      hCtx.fillStyle = '#ef4444';
      hCtx.beginPath();
      hCtx.arc(5, 5, 4, 0, Math.PI * 2);
      hCtx.arc(11, 5, 4, 0, Math.PI * 2);
      hCtx.fill();
      hCtx.beginPath();
      hCtx.moveTo(1, 6);
      hCtx.lineTo(8, 14);
      hCtx.lineTo(15, 6);
      hCtx.fill();
      this.cache['pickup_heal'] = heartC;

      const { c: ammoC, ctx: amCtx } = createCanvas(16, 16);
      amCtx.fillStyle = '#f59e0b';
      amCtx.fillRect(4, 3, 8, 10);
      amCtx.fillStyle = '#ef4444';
      amCtx.fillRect(6, 1, 4, 3);
      this.cache['pickup_ammo'] = ammoC;

      // Костер
      for (let f = 0; f < 2; f++) {
        const { c, ctx: fCtx } = createCanvas(16, 16);
        fCtx.fillStyle = '#78350f';
        fCtx.fillRect(2, 12, 12, 3);
        fCtx.fillStyle = f === 0 ? '#ea580c' : '#dc2626';
        fCtx.fillRect(4, 6, 8, 6);
        fCtx.fillStyle = f === 0 ? '#f59e0b' : '#fbbf24';
        fCtx.fillRect(6, 4, 4, 5);
        this.cache['campfire_' + f] = c;
      }

      // Игрок (2 кадра)
      for (let frame = 0; frame < 2; frame++) {
        const { c, ctx: pCtx } = createCanvas(16, 16);
        const leg = frame === 0 ? "..BBBB....BBBB.." : "...BBBB..BBBB...";
        const pMat = [
          "....KKKKKKKK....",
          "...KWWWWWWWWK...",
          "..KGGGGGGGGGGK..",
          ".KWWWWWWWWWWWWK.",
          "..KSSSSSSSSSSK..",
          "..KSKSSSSSSKSK..",
          "...KSSSSSSSSK...",
          "..KOOOOOOOOOOK..",
          ".KOOOOOOOOOOOOK.",
          ".KOOKOOOOOOKOOK.",
          ".KSSKOOOOOOKSSK.",
          "..KKBBBBBBBBKK..",
          "...KBBBBBBBBK...",
          leg,
          "...KKKK..KKKK...",
          "................"
        ];
        drawMatrix(pCtx, pMat, {
          'K': '#14141f', 'W': '#e2e8f0', 'G': '#64748b', 'S': '#fdba74', 'O': '#ea580c', 'B': '#1e3a8a'
        });
        this.cache['player_' + frame] = c;
      }

      // Зомби
      for (let frame = 0; frame < 2; frame++) {
        const { c, ctx: zCtx } = createCanvas(16, 16);
        zCtx.fillStyle = '#84a98c';
        zCtx.fillRect(3, 3, 10, 8);
        zCtx.fillStyle = '#4d7c0f';
        zCtx.fillRect(3, 1, 10, 3);
        zCtx.fillStyle = '#ef4444';
        zCtx.fillRect(5, 5, 2, 2);
        zCtx.fillRect(9, 5, 2, 2);
        zCtx.fillStyle = '#334155';
        zCtx.fillRect(4, 11, 8, 4);
        this.cache['zombie_green_' + frame] = c;

        const { c: cRed, ctx: zrCtx } = createCanvas(16, 16);
        zrCtx.fillStyle = '#6b9080';
        zrCtx.fillRect(3, 3, 10, 8);
        zrCtx.fillStyle = '#dc2626';
        zrCtx.fillRect(3, 1, 10, 3);
        zrCtx.fillStyle = '#fde047';
        zrCtx.fillRect(5, 5, 2, 2);
        zrCtx.fillRect(9, 5, 2, 2);
        zrCtx.fillStyle = '#1e293b';
        zrCtx.fillRect(4, 11, 8, 4);
        this.cache['zombie_red_' + frame] = cRed;
      }

      // Босс (Кузнец)
      for (let frame = 0; frame < 2; frame++) {
        const { c, ctx: bCtx2 } = createCanvas(20, 20);
        bCtx2.fillStyle = '#d97757';
        bCtx2.fillRect(5, 2, 10, 8);
        bCtx2.fillStyle = '#ef4444';
        bCtx2.fillRect(7, 4, 2, 2);
        bCtx2.fillRect(11, 4, 2, 2);
        bCtx2.fillStyle = '#1c1917';
        bCtx2.fillRect(6, 7, 8, 4); // борода
        bCtx2.fillStyle = '#451a03';
        bCtx2.fillRect(4, 10, 12, 7); // фартук
        // Молот
        bCtx2.fillStyle = '#78350f';
        bCtx2.fillRect(16, frame === 0 ? 3 : 6, 2, 11);
        bCtx2.fillStyle = '#94a3b8';
        bCtx2.fillRect(14, frame === 0 ? 2 : 5, 6, 4);
        this.cache['boss_' + frame] = c;
      }
    }
  };

  /* ==========================================================================
     3. КАРТА ЗОН
     ========================================================================== */
  const TILE_SIZE = 44;
  const CORRIDOR_WIDTH = 3;
  const CELLS_X = 9;
  const CELLS_Y = 9;
  const MAZE_COLS = CELLS_X * CORRIDOR_WIDTH;
  const MAZE_ROWS = CELLS_Y * CORRIDOR_WIDTH;

  class WorldZoneMap {
    cols = MAZE_COLS;
    rows = MAZE_ROWS;
    grid: number[][];
    floorVariant: number[][];
    floorStyle: string[][];
    bossRoom = { cx: 0, cy: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    transitions: Array<{
      dir: string;
      targetZone: string;
      label: string;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      labelX: number;
      labelY: number;
    }> = [];

    constructor(public zoneType: string, public dungeonLevel = 1) {
      this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(1));
      this.floorVariant = Array.from({ length: this.rows }, () =>
        Array.from({ length: this.cols }, () => Math.floor(Math.random() * 4))
      );
      this.floorStyle = Array.from({ length: this.rows }, () => Array(this.cols).fill('dirt'));

      if (zoneType === 'village') this.buildVillage();
      else if (zoneType === 'graveyard') this.buildGraveyard();
      else if (zoneType === 'forest') this.buildForest();
      else if (zoneType === 'temple') this.buildTemple();
      else this.buildDungeon(dungeonLevel);
    }

    carveBorderExit(dir: string, targetZone: string, label: string) {
      const mid = Math.floor(this.cols / 2);
      if (dir === 'north') {
        for (let y = 0; y <= 3; y++) {
          for (let x = mid - 1; x <= mid + 1; x++) {
            this.grid[y][x] = 0;
            this.floorStyle[y][x] = 'dirt';
          }
        }
        this.transitions.push({
          dir: 'north', targetZone, label,
          minX: (mid - 1.2) * TILE_SIZE, maxX: (mid + 2.2) * TILE_SIZE,
          minY: 0, maxY: 1.4 * TILE_SIZE,
          labelX: (mid + 0.5) * TILE_SIZE, labelY: 1.2 * TILE_SIZE
        });
      } else if (dir === 'south') {
        for (let y = this.rows - 4; y < this.rows; y++) {
          for (let x = mid - 1; x <= mid + 1; x++) {
            this.grid[y][x] = 0;
            this.floorStyle[y][x] = 'dirt';
          }
        }
        this.transitions.push({
          dir: 'south', targetZone, label,
          minX: (mid - 1.2) * TILE_SIZE, maxX: (mid + 2.2) * TILE_SIZE,
          minY: (this.rows - 1.4) * TILE_SIZE, maxY: this.rows * TILE_SIZE,
          labelX: (mid + 0.5) * TILE_SIZE, labelY: (this.rows - 1.2) * TILE_SIZE
        });
      } else if (dir === 'west') {
        for (let x = 0; x <= 3; x++) {
          for (let y = mid - 1; y <= mid + 1; y++) {
            this.grid[y][x] = 0;
            this.floorStyle[y][x] = 'dirt';
          }
        }
        this.transitions.push({
          dir: 'west', targetZone, label,
          minX: 0, maxX: 1.4 * TILE_SIZE,
          minY: (mid - 1.2) * TILE_SIZE, maxY: (mid + 2.2) * TILE_SIZE,
          labelX: 2.2 * TILE_SIZE, labelY: (mid + 0.5) * TILE_SIZE
        });
      } else if (dir === 'east') {
        for (let x = this.cols - 4; x < this.cols; x++) {
          for (let y = mid - 1; y <= mid + 1; y++) {
            this.grid[y][x] = 0;
            this.floorStyle[y][x] = 'dirt';
          }
        }
        this.transitions.push({
          dir: 'east', targetZone, label,
          minX: (this.cols - 1.4) * TILE_SIZE, maxX: this.cols * TILE_SIZE,
          minY: (mid - 1.2) * TILE_SIZE, maxY: (mid + 2.2) * TILE_SIZE,
          labelX: (this.cols - 2.2) * TILE_SIZE, labelY: (mid + 0.5) * TILE_SIZE
        });
      }
    }

    buildVillage() {
      const mid = Math.floor(this.cols / 2);
      for (let r = 2; r < this.rows - 2; r++) {
        for (let c = 2; c < this.cols - 2; c++) {
          this.grid[r][c] = 0;
          this.floorStyle[r][c] = 'grass';
        }
      }
      for (let r = 2; r < this.rows - 2; r++) {
        for (let c = 2; c < this.cols - 2; c++) {
          const distCenter = Math.hypot(c - mid, r - mid);
          if (distCenter < 4.5 || (Math.abs(c - mid) <= 1 && r <= mid) || Math.abs(r - mid) <= 1) {
            this.floorStyle[r][c] = 'dirt';
          }
        }
      }
      this.carveBorderExit('north', 'temple', '⬆️ ХРАМ');
      this.carveBorderExit('west', 'graveyard', '⬅️ КЛАДБИЩЕ');
      this.carveBorderExit('east', 'forest', '➡️ ЛЕС');
    }

    buildGraveyard() {
      for (let r = 1; r < this.rows - 1; r++) {
        for (let c = 1; c < this.cols - 1; c++) {
          this.floorStyle[r][c] = 'grave';
        }
      }
      this.generateWideMazeLayout(2);
      this.carveBorderExit('east', 'village', '➡️ В ДЕРЕВНЮ');
    }

    buildForest() {
      for (let r = 1; r < this.rows - 1; r++) {
        for (let c = 1; c < this.cols - 1; c++) {
          this.floorStyle[r][c] = (r + c) % 3 === 0 ? 'dirt' : 'grass';
        }
      }
      this.generateWideMazeLayout(1);
      this.carveBorderExit('west', 'village', '⬅️ В ДЕРЕВНЮ');
    }

    buildTemple() {
      const mid = Math.floor(this.cols / 2);
      for (let r = 2; r < this.rows - 2; r++) {
        for (let c = 2; c < this.cols - 2; c++) {
          this.grid[r][c] = 0;
          this.floorStyle[r][c] = 'grass';
        }
      }
      for (let r = 5; r <= this.rows - 6; r++) {
        for (let c = 5; c <= this.cols - 6; c++) {
          this.floorStyle[r][c] = 'dungeon';
          const onBorder = (r === 5 || r === this.rows - 6 || c === 5 || c === this.cols - 6);
          const isDoorway = (Math.abs(c - mid) <= 1) || (Math.abs(r - mid) <= 1);
          if (onBorder && !isDoorway) this.grid[r][c] = 2;
        }
      }
      for (let r = this.rows - 6; r < this.rows; r++) {
        for (let c = mid - 1; c <= mid + 1; c++) {
          this.grid[r][c] = 0;
          this.floorStyle[r][c] = 'dirt';
        }
      }
      this.carveBorderExit('south', 'village', '⬇️ В ДЕРЕВНЮ');
    }

    buildDungeon(level: number) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          this.grid[r][c] = 2;
          this.floorStyle[r][c] = 'dungeon';
        }
      }
      this.generateWideMazeLayout(2);

      const bMinX = this.cols - 9;
      const bMinY = this.rows - 9;
      const bMaxX = this.cols - 2;
      const bMaxY = this.rows - 2;

      for (let y = bMinY - 1; y <= bMaxY + 1; y++) {
        for (let x = bMinX - 1; x <= bMaxX + 1; x++) {
          if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
            if (y >= bMinY && y <= bMaxY && x >= bMinX && x <= bMaxX) {
              this.grid[y][x] = 0;
            } else if (this.grid[y][x] !== 0) {
              this.grid[y][x] = 2;
            }
          }
        }
      }
      for (let y = bMinY; y < bMinY + 3; y++) {
        for (let x = bMinX - 3; x <= bMinX; x++) {
          if (x > 0 && y > 0) this.grid[y][x] = 0;
        }
      }

      this.bossRoom = {
        minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY,
        cx: ((bMinX + bMaxX + 1) / 2) * TILE_SIZE,
        cy: ((bMinY + bMaxY + 1) / 2) * TILE_SIZE
      };
    }

    carveBlock(cellX: number, cellY: number) {
      const startX = cellX * CORRIDOR_WIDTH;
      const startY = cellY * CORRIDOR_WIDTH;
      for (let dy = 0; dy < CORRIDOR_WIDTH; dy++) {
        for (let dx = 0; dx < CORRIDOR_WIDTH; dx++) {
          const tx = startX + dx;
          const ty = startY + dy;
          if (tx > 0 && tx < this.cols - 1 && ty > 0 && ty < this.rows - 1) {
            this.grid[ty][tx] = 0;
          }
        }
      }
    }

    generateWideMazeLayout(wallType = 1) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) this.grid[r][c] = wallType;
      }
      const visited = Array.from({ length: CELLS_Y }, () => Array(CELLS_X).fill(false));
      const stack: [number, number][] = [];
      visited[1][1] = true;
      this.carveBlock(1, 1);
      stack.push([1, 1]);

      while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1];
        const dirs: [number, number][] = [[0, -2], [2, 0], [0, 2], [-2, 0]];
        const neighbors: [number, number, number, number][] = [];

        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx > 0 && nx < CELLS_X - 1 && ny > 0 && ny < CELLS_Y - 1 && !visited[ny][nx]) {
            neighbors.push([nx, ny, cx + dx / 2, cy + dy / 2]);
          }
        }

        if (neighbors.length > 0) {
          const [nx, ny, mx, my] = neighbors[Math.floor(Math.random() * neighbors.length)];
          visited[ny][nx] = true;
          this.carveBlock(mx, my);
          this.carveBlock(nx, ny);
          stack.push([nx, ny]);
        } else {
          stack.pop();
        }
      }
    }

    isWall(tx: number, ty: number) {
      if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return true;
      return this.grid[ty][tx] !== 0;
    }

    isWallPixel(px: number, py: number) {
      return this.isWall(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE));
    }
  }

  /* ==========================================================================
     4. СУЩНОСТИ
     ========================================================================== */
  class Projectile {
    vx: number;
    vy: number;
    radius: number;
    alive = true;
    constructor(
      public x: number,
      public y: number,
      public angle: number,
      speed: number,
      public damage: number,
      public fromBoss = false
    ) {
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.radius = fromBoss ? 8 : 5;
    }

    update(dt: number, maze: WorldZoneMap) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (maze.isWallPixel(this.x, this.y)) this.alive = false;
    }

    draw(dCtx: CanvasRenderingContext2D) {
      dCtx.save();
      dCtx.translate(this.x, this.y);
      dCtx.rotate(this.angle);
      if (this.fromBoss) {
        dCtx.fillStyle = '#ea580c';
        dCtx.beginPath();
        dCtx.arc(0, 0, 8, 0, Math.PI * 2);
        dCtx.fill();
      } else {
        dCtx.fillStyle = '#d97706';
        dCtx.fillRect(-10, -1.5, 18, 3);
        dCtx.fillStyle = '#e2e8f0';
        dCtx.fillRect(6, -3, 5, 6);
      }
      dCtx.restore();
    }
  }

  class Zombie {
    radius: number;
    maxHp: number;
    hp: number;
    speed: number;
    damage: number;
    attackCooldown = 0;
    animTimer = Math.random() * 2;
    hitFlash = 0;
    wanderAngle = Math.random() * Math.PI * 2;
    wanderTimer = 1;

    constructor(public x: number, public y: number, public archetype = 'green') {
      this.radius = archetype === 'red' ? 14 : 16;
      this.maxHp = archetype === 'red' ? 36 : 52;
      this.hp = this.maxHp;
      this.speed = archetype === 'red' ? 120 : 85;
      this.damage = archetype === 'red' ? 12 : 16;
    }

    update(dt: number, player: Player, maze: WorldZoneMap) {
      this.animTimer += dt * 6;
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;

      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      let moveAngle = this.wanderAngle;
      let curSpeed = this.speed * 0.45;

      if (dist < 260) {
        moveAngle = Math.atan2(dy, dx);
        curSpeed = this.speed;
      } else {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderAngle = Math.random() * Math.PI * 2;
          this.wanderTimer = 1.5 + Math.random() * 2;
        }
      }

      const vx = Math.cos(moveAngle) * curSpeed * dt;
      const vy = Math.sin(moveAngle) * curSpeed * dt;

      if (!maze.isWallPixel(this.x + vx + Math.sign(vx) * this.radius, this.y)) this.x += vx;
      if (!maze.isWallPixel(this.x, this.y + vy + Math.sign(vy) * this.radius)) this.y += vy;

      if (dist < this.radius + player.radius + 4 && this.attackCooldown <= 0) {
        player.takeDamage(this.damage);
        this.attackCooldown = 0.85;
      }
    }

    takeDamage(amount: number, angle: number, knockback: number, maze: WorldZoneMap) {
      this.hp = Math.max(0, this.hp - amount);
      this.hitFlash = 0.14;
      Sound.hit();
      const kx = Math.cos(angle) * knockback;
      const ky = Math.sin(angle) * knockback;
      if (!maze.isWallPixel(this.x + kx, this.y)) this.x += kx;
      if (!maze.isWallPixel(this.x, this.y + ky)) this.y += ky;
    }

    draw(dCtx: CanvasRenderingContext2D) {
      const frame = Math.abs(Math.floor(this.animTimer || 0)) % 2;
      const key = this.archetype === 'red' ? 'zombie_red_' + frame : 'zombie_green_' + frame;
      const img = Sprites.cache[key] || Sprites.cache['zombie_green_0'];
      const size = 38;

      dCtx.save();
      dCtx.fillStyle = 'rgba(0,0,0,0.45)';
      dCtx.beginPath();
      dCtx.ellipse(this.x, this.y + size * 0.38, size * 0.3, 5, 0, 0, Math.PI * 2);
      dCtx.fill();

      if (this.hitFlash > 0) dCtx.filter = 'brightness(200%)';
      if (img) dCtx.drawImage(img, Math.round(this.x - size / 2), Math.round(this.y - size / 2), size, size);
      dCtx.restore();

      if (this.hp < this.maxHp && this.hp > 0) {
        const w = 32;
        dCtx.fillStyle = '#090d16';
        dCtx.fillRect(this.x - w / 2, this.y - size / 2 - 7, w, 4);
        dCtx.fillStyle = '#22c55e';
        dCtx.fillRect(this.x - w / 2, this.y - size / 2 - 7, w * (this.hp / this.maxHp), 4);
      }
    }
  }

  class BlacksmithBoss {
    radius = 26;
    maxHp: number;
    hp: number;
    speed: number;
    damage = 25;
    animTimer = 0;
    hitFlash = 0;
    skillTimer = 2.5;
    shockwaves: Array<{ x: number; y: number; r: number; maxR: number; hitPlayer: boolean }> = [];
    active = false;

    constructor(public x: number, public y: number, level: number) {
      this.maxHp = 350 + level * 150;
      this.hp = this.maxHp;
      this.speed = 92 + level * 6;
    }

    update(dt: number, game: GameInstance) {
      this.animTimer += dt * 5;
      if (this.hitFlash > 0) this.hitFlash -= dt;

      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.r += dt * 210;
        if (!sw.hitPlayer && game.player) {
          const d = Math.hypot(game.player.x - sw.x, game.player.y - sw.y);
          if (Math.abs(d - sw.r) < 16) {
            game.player.takeDamage(18);
            sw.hitPlayer = true;
          }
        }
        if (sw.r >= sw.maxR) this.shockwaves.splice(i, 1);
      }

      if (!game.player) return;
      const dx = game.player.x - this.x;
      const dy = game.player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 430) this.active = true;
      if (!this.active) return;

      const angle = Math.atan2(dy, dx);
      const vx = Math.cos(angle) * this.speed * dt;
      const vy = Math.sin(angle) * this.speed * dt;

      if (!game.maze.isWallPixel(this.x + vx + Math.sign(vx) * this.radius, this.y)) this.x += vx;
      if (!game.maze.isWallPixel(this.x, this.y + vy + Math.sign(vy) * this.radius)) this.y += vy;

      if (dist < this.radius + game.player.radius + 4) {
        game.player.takeDamage(this.damage);
      }

      this.skillTimer -= dt;
      if (this.skillTimer <= 0) {
        this.skillTimer = 3.2;
        Sound.bossSlam();
        this.shockwaves.push({ x: this.x, y: this.y, r: 15, maxR: 190, hitPlayer: false });
        for (let i = -2; i <= 2; i++) {
          const pAngle = angle + i * 0.28;
          game.projectiles.push(new Projectile(this.x, this.y, pAngle, 260, 16, true));
        }
      }
    }

    takeDamage(amount: number) {
      this.active = true;
      this.hp = Math.max(0, this.hp - amount);
      this.hitFlash = 0.12;
      Sound.hit();
    }

    draw(dCtx: CanvasRenderingContext2D) {
      for (const sw of this.shockwaves) {
        dCtx.save();
        dCtx.strokeStyle = `rgba(249, 115, 22, ${1 - sw.r / sw.maxR})`;
        dCtx.lineWidth = 6;
        dCtx.beginPath();
        dCtx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        dCtx.stroke();
        dCtx.restore();
      }
      const frame = Math.abs(Math.floor(this.animTimer || 0)) % 2;
      const img = Sprites.cache['boss_' + frame];
      const size = 64;

      dCtx.save();
      dCtx.fillStyle = 'rgba(0,0,0,0.55)';
      dCtx.beginPath();
      dCtx.ellipse(this.x, this.y + 24, 22, 9, 0, 0, Math.PI * 2);
      dCtx.fill();

      if (this.hitFlash > 0) dCtx.filter = 'brightness(220%)';
      if (img) dCtx.drawImage(img, Math.round(this.x - size / 2), Math.round(this.y - size / 2), size, size);
      dCtx.restore();
    }
  }

  class Player {
    radius = 14;
    speed = 205;
    maxHp = 100;
    hp = 100;
    arrows = 35;
    weapon: 'sword' | 'bow' = 'sword';
    aimAngle = 0;
    attackCooldown = 0;
    slashTimer = 0;
    slashAngle = 0;
    invulnTimer = 0;
    walkTimer = 0;
    isMoving = false;

    // Upgrades
    armorLevel = 1;
    swordLevel = 1;
    bowLevel = 1;
    damageReduction = 0;
    swordDamage = 35;
    swordReach = 64;
    bowDamage = 32;
    bowSpeed = 580;

    constructor(public x: number, public y: number) {}

    update(dt: number, game: GameInstance) {
      if (this.attackCooldown > 0) this.attackCooldown -= dt;
      if (this.slashTimer > 0) this.slashTimer -= dt;
      if (this.invulnTimer > 0) this.invulnTimer -= dt;

      let dx = 0;
      let dy = 0;
      const k = game.keys;
      if (k['w'] || k['W'] || k['ц'] || k['Ц'] || k['ArrowUp']) dy -= 1;
      if (k['s'] || k['S'] || k['ы'] || k['Ы'] || k['ArrowDown']) dy += 1;
      if (k['a'] || k['A'] || k['ф'] || k['Ф'] || k['ArrowLeft']) dx -= 1;
      if (k['d'] || k['D'] || k['в'] || k['В'] || k['ArrowRight']) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        this.isMoving = true;
        this.walkTimer += dt * 9;

        const vx = dx * this.speed * dt;
        const vy = dy * this.speed * dt;

        if (!game.maze.isWallPixel(this.x + vx + Math.sign(vx) * this.radius, this.y)) this.x += vx;
        if (!game.maze.isWallPixel(this.x, this.y + vy + Math.sign(vy) * this.radius)) this.y += vy;
      } else {
        this.isMoving = false;
      }

      const worldMouseX = game.mouse.x + game.camera.x;
      const worldMouseY = game.mouse.y + game.camera.y;
      this.aimAngle = Math.atan2(worldMouseY - this.y, worldMouseX - this.x);
    }

    attack(game: GameInstance) {
      if (this.attackCooldown > 0) return;

      if (this.weapon === 'sword') {
        this.attackCooldown = Math.max(0.16, 0.28 - (this.swordLevel - 1) * 0.02);
        this.slashTimer = 0.2;
        this.slashAngle = this.aimAngle;
        Sound.sword();

        const reach = this.swordReach;
        const arc = Math.PI * 0.88;
        const dmg = this.swordDamage;

        for (const z of game.zombies) {
          const d = Math.hypot(z.x - this.x, z.y - this.y);
          if (d <= reach + z.radius) {
            let diff = Math.abs(this.aimAngle - Math.atan2(z.y - this.y, z.x - this.x));
            while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
            if (diff <= arc / 2) {
              z.takeDamage(dmg, this.aimAngle, 22, game.maze);
              game.spawnParticles(z.x, z.y, '#ef4444', 7);
            }
          }
        }

        if (game.boss && game.boss.hp > 0) {
          const d = Math.hypot(game.boss.x - this.x, game.boss.y - this.y);
          if (d <= reach + game.boss.radius) {
            let diff = Math.abs(this.aimAngle - Math.atan2(game.boss.y - this.y, game.boss.x - this.x));
            while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
            if (diff <= arc / 2) {
              game.boss.takeDamage(dmg);
              game.spawnParticles(game.boss.x, game.boss.y, '#f59e0b', 9);
              game.checkBossDefeat();
            }
          }
        }
      } else {
        if (this.arrows <= 0) return;
        this.attackCooldown = Math.max(0.18, 0.3 - (this.bowLevel - 1) * 0.02);
        if (this.bowLevel <= 1 || Math.random() >= 0.35) this.arrows--;
        Sound.bow();
        const sx = this.x + Math.cos(this.aimAngle) * 18;
        const sy = this.y + Math.sin(this.aimAngle) * 18;
        game.projectiles.push(new Projectile(sx, sy, this.aimAngle, this.bowSpeed, this.bowDamage, false));
        game.syncHUD();
      }
    }

    takeDamage(dmg: number) {
      if (this.invulnTimer > 0) return;
      const reduced = Math.max(1, Math.round(dmg * (1 - (this.damageReduction || 0))));
      this.hp = Math.max(0, this.hp - reduced);
      this.invulnTimer = 0.55;
      Sound.hurt();
    }

    draw(dCtx: CanvasRenderingContext2D) {
      const frame = this.isMoving ? (Math.abs(Math.floor(this.walkTimer || 0)) % 2) : 0;
      const img = Sprites.cache['player_' + frame] || Sprites.cache['player_0'];
      const size = 40;

      dCtx.save();
      dCtx.fillStyle = 'rgba(0,0,0,0.45)';
      dCtx.beginPath();
      dCtx.ellipse(this.x, this.y + 16, 12, 5, 0, 0, Math.PI * 2);
      dCtx.fill();

      if (this.invulnTimer > 0 && Math.floor(Date.now() / 70) % 2 === 0) dCtx.globalAlpha = 0.5;
      if (img) dCtx.drawImage(img, Math.round(this.x - size / 2), Math.round(this.y - size / 2), size, size);

      dCtx.translate(this.x, this.y);
      dCtx.rotate(this.aimAngle);
      if (this.weapon === 'sword') {
        dCtx.fillStyle = this.swordLevel >= 3 ? '#ef4444' : (this.swordLevel >= 2 ? '#38bdf8' : '#f59e0b');
        dCtx.fillRect(10, 4, 4, 8);
        dCtx.fillStyle = '#e2e8f0';
        dCtx.fillRect(14, 6, 16 + (this.swordLevel - 1) * 3, 4);
      } else {
        dCtx.strokeStyle = this.bowLevel >= 3 ? '#a855f7' : (this.bowLevel >= 2 ? '#38bdf8' : '#d97706');
        dCtx.lineWidth = 3;
        dCtx.beginPath();
        dCtx.arc(14, 0, 11, -1.1, 1.1);
        dCtx.stroke();
      }
      dCtx.restore();

      if (this.slashTimer > 0) {
        dCtx.save();
        dCtx.translate(this.x, this.y);
        dCtx.rotate(this.slashAngle);
        dCtx.strokeStyle = `rgba(251, 191, 36, ${this.slashTimer / 0.2})`;
        dCtx.lineWidth = 8;
        dCtx.beginPath();
        dCtx.arc(0, 0, (this.swordReach || 64) * 0.85, -Math.PI * 0.4, Math.PI * 0.4);
        dCtx.stroke();
        dCtx.restore();
      }
    }
  }

  /* ==========================================================================
     5. ГЛАВНЫЙ ИГРОВОЙ ДВИЖОК
     ========================================================================== */
  interface GameInstance {
    keys: Record<string, boolean>;
    mouse: { x: number; y: number; down: boolean };
    camera: { x: number; y: number };
    maze: WorldZoneMap;
    player: Player | null;
    boss: BlacksmithBoss | null;
    zombies: Zombie[];
    projectiles: Projectile[];
    spawnParticles: (x: number, y: number, color: string, count?: number) => void;
    checkBossDefeat: () => void;
    syncHUD: () => void;
  }

  class Game implements GameInstance {
    width = canvas.width;
    height = canvas.height;
    camera = { x: 0, y: 0 };
    mouse = { x: this.width / 2, y: this.height / 2, down: false };
    keys: Record<string, boolean> = {};

    currentZone = 'village';
    level = 1;
    score = 0;
    nextUpgradeScore = 300;
    totalUpgrades = 0;
    isUpgradeModalOpen = false;
    gameOver = false;
    globalAnimTime = 0;
    transitionCooldown = 0;
    nearStairs = false;
    nearStairsUp = false;

    player: Player | null = null;
    boss: BlacksmithBoss | null = null;
    zombies: Zombie[] = [];
    projectiles: Projectile[] = [];
    pickups: Array<{ x: number; y: number; type: string; update: (dt: number) => void; draw: (c: CanvasRenderingContext2D) => void }> = [];
    decorations: Array<{ x: number; y: number; type: string }> = [];
    particles: Array<{ x: number; y: number; vx: number; vy: number; color: string; life: number }> = [];
    maze!: WorldZoneMap;
    stairs = { x: 0, y: 0, radius: 22, unlocked: false, active: false };
    stairsUp = { x: 0, y: 0, radius: 22, active: false };

    constructor() {
      Sprites.init();
      this.resize();
      this.enterZone('village');
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      canvas.width = this.width;
      canvas.height = this.height;
      ctx.imageSmoothingEnabled = false;
    }

    enterZone(zoneName: string, spawnSide = 'center', dungeonFloor = 1) {
      this.currentZone = zoneName;
      this.level = dungeonFloor;
      this.gameOver = false;
      this.transitionCooldown = 0.8;
      this.nearStairs = false;
      this.nearStairsUp = false;
      callbacks.onStairsPrompt(null);

      this.zombies = [];
      this.projectiles = [];
      this.pickups = [];
      this.decorations = [];
      this.particles = [];
      this.boss = null;
      this.stairs = { x: 0, y: 0, radius: 22, unlocked: false, active: false };
      this.stairsUp = { x: 0, y: 0, radius: 22, active: false };

      this.maze = new WorldZoneMap(zoneName, dungeonFloor);

      const mid = (this.maze.cols / 2) * TILE_SIZE;
      let spawnX = mid;
      let spawnY = mid;

      if (spawnSide === 'north') spawnY = 2.6 * TILE_SIZE;
      else if (spawnSide === 'south') spawnY = (this.maze.rows - 2.6) * TILE_SIZE;
      else if (spawnSide === 'west') spawnX = 2.6 * TILE_SIZE;
      else if (spawnSide === 'east') spawnX = (this.maze.cols - 2.6) * TILE_SIZE;
      else if (zoneName === 'dungeon') {
        spawnX = 4.5 * TILE_SIZE;
        spawnY = 4.5 * TILE_SIZE;
      }

      if (!this.player) {
        this.player = new Player(spawnX, spawnY);
      } else {
        this.player.x = spawnX;
        this.player.y = spawnY;
      }

      if (zoneName === 'village') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
        if (this.player.arrows < 20) this.player.arrows = 20;
        this.decorations.push({ x: mid, y: mid - 1.5 * TILE_SIZE, type: 'campfire' });
        callbacks.onShowToast('🏡 Вы в Деревне! Идите к краям карты для похода в другие зоны.');
      } else if (zoneName === 'graveyard') {
        this.populateEnemies('graveyard', spawnX, spawnY);
        callbacks.onShowToast('🪦 Проклятое Кладбище! Остерегайтесь восставших мертвецов.');
      } else if (zoneName === 'forest') {
        this.populateEnemies('forest', spawnX, spawnY);
        callbacks.onShowToast('🌲 Чаща Леса! Здесь бродят быстрые монстры.');
      } else if (zoneName === 'temple') {
        this.stairs = { x: mid, y: mid, radius: 24, unlocked: true, active: true };
        this.populateEnemies('temple', spawnX, spawnY);
        callbacks.onShowToast('🏛️ Разрушенный Храм! Подойдите к люку и нажмите [E] для спуска в Подземелье.');
      } else if (zoneName === 'dungeon') {
        this.stairsUp = { x: 3.5 * TILE_SIZE, y: 4.5 * TILE_SIZE, radius: 20, active: true };
        const br = this.maze.bossRoom;
        this.boss = new BlacksmithBoss(br.cx, br.cy, dungeonFloor);
        this.stairs = { x: br.cx, y: br.cy, radius: 22, unlocked: false, active: true };
        this.populateEnemies('dungeon', spawnX, spawnY);
        callbacks.onShowToast(`⚔️ Подземелье Храма — Этаж ${dungeonFloor}! Победите Босса для открытия люка.`);
      }

      this.syncHUD();
    }

    populateEnemies(zoneType: string, spawnX: number, spawnY: number) {
      const freeTiles: Array<{ px: number; py: number }> = [];
      for (let r = 2; r < this.maze.rows - 2; r++) {
        for (let c = 2; c < this.maze.cols - 2; c++) {
          if (this.maze.grid[r][c] === 0) {
            const px = (c + 0.5) * TILE_SIZE;
            const py = (r + 0.5) * TILE_SIZE;
            if (Math.hypot(px - spawnX, py - spawnY) > TILE_SIZE * 4) {
              freeTiles.push({ px, py });
            }
          }
        }
      }
      freeTiles.sort(() => Math.random() - 0.5);

      const count = zoneType === 'dungeon' ? 14 + this.level * 4 : 16;
      for (let i = 0; i < count && freeTiles.length > 0; i++) {
        const t = freeTiles.pop()!;
        this.zombies.push(new Zombie(t.px, t.py, Math.random() < 0.4 ? 'red' : 'green'));
      }
    }

    spawnParticles(x: number, y: number, color: string, count = 8) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 35 + Math.random() * 110;
        this.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          color,
          life: 0.3 + Math.random() * 0.25
        });
      }
    }

    checkBossDefeat() {
      if (!this.boss || this.boss.hp > 0) return;
      this.boss.hp = 0;
      this.spawnParticles(this.boss.x, this.boss.y, '#f59e0b', 32);
      this.stairs.unlocked = true;
      this.boss = null;
      this.addScore(1000);
      callbacks.onShowToast('🔥 БОСС ПОВЕРЖЕН! Подойдите к люку и нажмите [E] для спуска на следующий этаж!');
      this.syncHUD();
    }

    addScore(pts: number) {
      this.score += pts;
      this.syncHUD();
      if (this.score >= this.nextUpgradeScore && !this.isUpgradeModalOpen && this.player) {
        this.isUpgradeModalOpen = true;
        callbacks.onRequestUpgradeChoice({
          armorLevel: this.player.armorLevel,
          swordLevel: this.player.swordLevel,
          bowLevel: this.player.bowLevel,
        });
      }
    }

    selectUpgrade(type: 'armor' | 'sword' | 'bow') {
      if (!this.player) return;
      this.totalUpgrades++;
      if (type === 'armor') {
        this.player.armorLevel++;
        this.player.maxHp += 30;
        this.player.hp = this.player.maxHp;
        this.player.damageReduction = Math.min(0.5, (this.player.damageReduction || 0) + 0.12);
        callbacks.onShowToast(`🛡️ Броня улучшена до Ур. ${this.player.armorLevel}! (+30 HP, лечение, защита)`);
        this.spawnParticles(this.player.x, this.player.y, '#22c55e', 24);
      } else if (type === 'sword') {
        this.player.swordLevel++;
        this.player.swordDamage += 18;
        this.player.swordReach = Math.min(96, (this.player.swordReach || 64) + 8);
        callbacks.onShowToast(`⚔️ Меч улучшен до Ур. ${this.player.swordLevel}! (Урон ${this.player.swordDamage}, размах +15%)`);
        this.spawnParticles(this.player.x, this.player.y, '#f59e0b', 24);
      } else if (type === 'bow') {
        this.player.bowLevel++;
        this.player.bowDamage += 16;
        this.player.bowSpeed = (this.player.bowSpeed || 580) + 80;
        this.player.arrows += 20;
        callbacks.onShowToast(`🏹 Лук улучшен до Ур. ${this.player.bowLevel}! (Урон ${this.player.bowDamage}, +20 стрел)`);
        this.spawnParticles(this.player.x, this.player.y, '#38bdf8', 24);
      }
      Sound.upgrade();
      this.isUpgradeModalOpen = false;
      this.nextUpgradeScore += 500 + this.totalUpgrades * 250;
      this.syncHUD();

      if (this.score >= this.nextUpgradeScore) {
        setTimeout(() => {
          if (!this.isUpgradeModalOpen && this.player) {
            this.isUpgradeModalOpen = true;
            callbacks.onRequestUpgradeChoice({
              armorLevel: this.player.armorLevel,
              swordLevel: this.player.swordLevel,
              bowLevel: this.player.bowLevel,
            });
          }
        }, 500);
      }
    }

    triggerStairs() {
      if (this.transitionCooldown > 0) return;
      if (this.currentZone === 'temple' && this.nearStairs) {
        this.enterZone('dungeon', 'center', 1);
      } else if (this.currentZone === 'dungeon') {
        if (this.nearStairs && this.stairs.unlocked) {
          this.enterZone('dungeon', 'center', this.level + 1);
        } else if (this.nearStairsUp) {
          this.enterZone('temple', 'center', 1);
        }
      }
    }

    syncHUD() {
      if (!this.player) return;
      const zoneNames: Record<string, string> = {
        village: 'Деревня',
        graveyard: 'Кладбище',
        forest: 'Чаща Леса',
        temple: 'Разр. Храм',
        dungeon: `Подземелье ${this.level}`
      };

      let zTitle = '🏡 ТИХАЯ ДЕРЕВНЯ';
      let zSub = 'Сев: Храм • Зап: Кладбище • Вост: Лес';
      if (this.currentZone === 'graveyard') {
        zTitle = '🪦 ПРОКЛЯТОЕ КЛАДБИЩЕ';
        zSub = 'Восток: Вернуться в Деревню';
      } else if (this.currentZone === 'forest') {
        zTitle = '🌲 ЧАЩА ЛЕСА';
        zSub = 'Запад: Вернуться в Деревню';
      } else if (this.currentZone === 'temple') {
        zTitle = '🏛️ РАЗРУШЕННЫЙ ХРАМ';
        zSub = 'Люк в Подземелье: клавиша [E] • Юг: В Деревню';
      } else if (this.currentZone === 'dungeon') {
        zTitle = `⚔️ ПОДЗЕМЕЛЬЕ — ЭТАЖ ${this.level}`;
        zSub = 'Люк на след. этаж: [E] • Люк в Храм: [E]';
      }

      callbacks.onStatsChange({
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        arrows: this.player.arrows,
        armorLevel: this.player.armorLevel,
        swordLevel: this.player.swordLevel,
        swordDamage: this.player.swordDamage,
        bowLevel: this.player.bowLevel,
        bowDamage: this.player.bowDamage,
        score: this.score,
        nextUpgradeScore: this.nextUpgradeScore,
        zoneName: zoneNames[this.currentZone] || 'Зона',
        zoneTitle: zTitle,
        zoneSub: zSub,
        bossActive: !!(this.boss && this.boss.active && this.boss.hp > 0),
        bossHp: this.boss ? this.boss.hp : 0,
        bossMaxHp: this.boss ? this.boss.maxHp : 1,
        bossStatusText: this.currentZone === 'dungeon'
          ? (this.boss && this.boss.hp > 0 ? '⚒️ Босс на этаже' : '✅ Люк открыт!')
          : `Врагов: ${this.zombies.length}`
      });
    }

    update(dt: number) {
      if (this.gameOver || this.isUpgradeModalOpen || !this.player) return;
      this.globalAnimTime += dt;
      if (this.transitionCooldown > 0) this.transitionCooldown -= dt;

      this.player.update(dt, this);
      if (this.mouse.down && !this.isUpgradeModalOpen) this.player.attack(this);

      this.camera.x = this.player.x - this.width / 2;
      this.camera.y = this.player.y - this.height / 2;

      // Зонные переходы по границам
      if (this.transitionCooldown <= 0 && this.maze.transitions.length > 0) {
        for (const tr of this.maze.transitions) {
          if (this.player.x >= tr.minX && this.player.x <= tr.maxX &&
              this.player.y >= tr.minY && this.player.y <= tr.maxY) {
            const opp: Record<string, string> = { north: 'south', south: 'north', west: 'east', east: 'west' };
            this.enterZone(tr.targetZone, opp[tr.dir] || 'center', this.level);
            return;
          }
        }
      }

      // Снаряды
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.update(dt, this.maze);
        if (!p.alive) {
          this.projectiles.splice(i, 1);
          continue;
        }

        if (p.fromBoss) {
          if (Math.hypot(p.x - this.player.x, p.y - this.player.y) <= p.radius + this.player.radius) {
            this.player.takeDamage(p.damage);
            this.projectiles.splice(i, 1);
          }
        } else {
          let hit = false;
          for (const z of this.zombies) {
            if (Math.hypot(p.x - z.x, p.y - z.y) <= p.radius + z.radius) {
              z.takeDamage(p.damage, p.angle, 14, this.maze);
              this.spawnParticles(z.x, z.y, '#ef4444', 6);
              hit = true;
              break;
            }
          }
          if (!hit && this.boss && this.boss.hp > 0) {
            if (Math.hypot(p.x - this.boss.x, p.y - this.boss.y) <= p.radius + this.boss.radius) {
              this.boss.takeDamage(p.damage);
              this.spawnParticles(p.x, p.y, '#f59e0b', 7);
              this.checkBossDefeat();
              hit = true;
            }
          }
          if (hit) this.projectiles.splice(i, 1);
        }
      }

      // Враги
      for (let i = this.zombies.length - 1; i >= 0; i--) {
        const z = this.zombies[i];
        z.update(dt, this.player, this.maze);
        if (z.hp <= 0) {
          this.spawnParticles(z.x, z.y, '#22c55e', 12);
          this.zombies.splice(i, 1);
          this.addScore(z.archetype === 'red' ? 140 : 100);
        }
      }

      // Босс
      if (this.boss && this.boss.hp > 0) {
        this.boss.update(dt, this);
        this.checkBossDefeat();
      }

      // Частицы
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }

      // Проверка люков и лестниц
      let promptText: string | null = null;
      this.nearStairs = false;
      this.nearStairsUp = false;

      if (this.transitionCooldown <= 0) {
        if (this.stairs.active && this.stairs.unlocked) {
          const dStairs = Math.hypot(this.player.x - this.stairs.x, this.player.y - this.stairs.y);
          if (dStairs < this.player.radius + this.stairs.radius + 24) {
            this.nearStairs = true;
            promptText = this.currentZone === 'temple'
              ? 'Нажмите [E] для спуска в Подземелье'
              : `Нажмите [E] для спуска на Этаж ${this.level + 1}`;
          }
        }

        if (this.stairsUp.active && !promptText) {
          const dUp = Math.hypot(this.player.x - this.stairsUp.x, this.player.y - this.stairsUp.y);
          if (dUp < this.player.radius + this.stairsUp.radius + 24) {
            this.nearStairsUp = true;
            promptText = 'Нажмите [E] для подъема в Храм';
          }
        }
      }

      callbacks.onStairsPrompt(promptText);

      const isEPressed = this.keys['e'] || this.keys['E'] || this.keys['у'] || this.keys['У'];
      if (isEPressed && promptText) {
        this.keys['e'] = false;
        this.keys['E'] = false;
        this.keys['у'] = false;
        this.keys['У'] = false;
        this.triggerStairs();
        return;
      }

      if (this.player.hp <= 0) {
        this.gameOver = true;
        callbacks.onGameOver(this.score, this.currentZone === 'dungeon' ? `Этаж ${this.level}` : this.currentZone);
      }
    }

    draw() {
      ctx.fillStyle = '#090d14';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.save();
      ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

      const startCol = Math.max(0, Math.floor(this.camera.x / TILE_SIZE));
      const endCol = Math.min(this.maze.cols, Math.ceil((this.camera.x + this.width) / TILE_SIZE));
      const startRow = Math.max(0, Math.floor(this.camera.y / TILE_SIZE));
      const endRow = Math.min(this.maze.rows, Math.ceil((this.camera.y + this.height) / TILE_SIZE));

      // Тайлы
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const px = c * TILE_SIZE;
          const py = r * TILE_SIZE;
          const cell = this.maze.grid[r][c];

          if (cell === 0) {
            const v = this.maze.floorVariant[r][c];
            const style = this.maze.floorStyle[r][c];
            let floorKey = 'floor_' + v;
            if (style === 'grass') floorKey = 'floor_grass_' + v;
            else if (style === 'grave') floorKey = 'floor_grave_' + v;
            else if (style === 'dungeon') floorKey = 'floor_dungeon_' + v;
            const tileImg = Sprites.cache[floorKey] || Sprites.cache['floor_0'];
            if (tileImg) ctx.drawImage(tileImg, px, py, TILE_SIZE, TILE_SIZE);
          } else if (cell === 2) {
            if (Sprites.cache['wall_stone']) ctx.drawImage(Sprites.cache['wall_stone'], px, py, TILE_SIZE, TILE_SIZE);
          } else {
            if (Sprites.cache['wall_tree']) ctx.drawImage(Sprites.cache['wall_tree'], px, py, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      // Переходы по границам
      for (const tr of this.maze.transitions) {
        ctx.save();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.fillRect(tr.minX, tr.minY, tr.maxX - tr.minX, tr.maxY - tr.minY);
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(tr.label, tr.labelX, tr.labelY + 3);
        ctx.restore();
      }

      // Декорации
      const animFrame = Math.abs(Math.floor((this.globalAnimTime || 0) * 5)) % 2;
      for (const d of this.decorations) {
        if (d.type === 'campfire' && Sprites.cache['campfire_' + animFrame]) {
          ctx.drawImage(Sprites.cache['campfire_' + animFrame], d.x - 19, d.y - 19, 38, 38);
        }
      }

      // Люк спуска
      if (this.stairs.active && this.stairs.unlocked && Sprites.cache['stairs']) {
        ctx.drawImage(Sprites.cache['stairs'], Math.round(this.stairs.x - 21), Math.round(this.stairs.y - 21), 42, 42);
        if (this.nearStairs) {
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.fillRect(this.stairs.x - 110, this.stairs.y - 42, 220, 24);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(this.stairs.x - 110, this.stairs.y - 42, 220, 24);
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(this.currentZone === 'temple' ? 'Нажмите [E]: В Подземелье' : `Нажмите [E]: На Этаж ${this.level + 1}`, this.stairs.x, this.stairs.y - 26);
          ctx.restore();
        } else {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(this.currentZone === 'temple' ? '⬇️ В ПОДЗЕМЕЛЬЕ [E]' : `⬇️ НА ЭТАЖ ${this.level + 1} [E]`, this.stairs.x, this.stairs.y - 26);
        }
      }

      // Лестница наверх
      if (this.stairsUp.active && Sprites.cache['stairs_up']) {
        ctx.drawImage(Sprites.cache['stairs_up'], Math.round(this.stairsUp.x - 20), Math.round(this.stairsUp.y - 20), 40, 40);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⬆️ В ХРАМ [E]', this.stairsUp.x, this.stairsUp.y - 24);
      }

      // Враги, Босс, Игрок
      for (const z of this.zombies) z.draw(ctx);
      if (this.boss && this.boss.hp > 0) this.boss.draw(ctx);
      if (this.player) this.player.draw(ctx);
      for (const p of this.projectiles) p.draw(ctx);

      for (const pt of this.particles) {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 2, pt.y - 2, 5, 5);
      }

      // Атмосферное освещение
      if (this.player) {
        const darkAlpha = this.currentZone === 'village' ? 0.45 : (this.currentZone === 'dungeon' ? 0.92 : 0.78);
        const grad = ctx.createRadialGradient(
          this.player.x, this.player.y, 140,
          this.player.x, this.player.y, 580
        );
        grad.addColorStop(0, 'rgba(9, 13, 20, 0)');
        grad.addColorStop(1, `rgba(9, 13, 20, ${darkAlpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(this.camera.x, this.camera.y, this.width, this.height);
      }

      ctx.restore();
      this.drawMiniMap();
    }

    drawMiniMap() {
      const mw = miniCanvas.width;
      const mh = miniCanvas.height;
      miniCtx.clearRect(0, 0, mw, mh);
      const tw = mw / this.maze.cols;
      const th = mh / this.maze.rows;

      for (let r = 0; r < this.maze.rows; r++) {
        for (let c = 0; c < this.maze.cols; c++) {
          const v = this.maze.grid[r][c];
          miniCtx.fillStyle = v === 0 ? '#334155' : '#142913';
          miniCtx.fillRect(c * tw, r * th, Math.ceil(tw), Math.ceil(th));
        }
      }

      if (this.boss && this.boss.hp > 0) {
        miniCtx.fillStyle = '#f97316';
        miniCtx.beginPath();
        miniCtx.arc((this.boss.x / TILE_SIZE) * tw, (this.boss.y / TILE_SIZE) * th, 4.5, 0, Math.PI * 2);
        miniCtx.fill();
      }

      if (this.player) {
        miniCtx.fillStyle = '#22c55e';
        miniCtx.beginPath();
        miniCtx.arc((this.player.x / TILE_SIZE) * tw, (this.player.y / TILE_SIZE) * th, 3.5, 0, Math.PI * 2);
        miniCtx.fill();
      }
    }
  }

  const game = new Game();

  // Слушатели событий
  const handleResize = () => game.resize();
  window.addEventListener('resize', handleResize);

  const handleKeyDown = (e: KeyboardEvent) => {
    Sound.init();
    game.keys[e.key] = true;

    if (game.isUpgradeModalOpen) {
      if (e.key === '1') { game.selectUpgrade('armor'); return; }
      if (e.key === '2') { game.selectUpgrade('sword'); return; }
      if (e.key === '3') { game.selectUpgrade('bow'); return; }
      return;
    }

    if (e.key === '1') {
      if (game.player) game.player.weapon = 'sword';
      game.syncHUD();
    }
    if (e.key === '2') {
      if (game.player) game.player.weapon = 'bow';
      game.syncHUD();
    }
    if (e.key === ' ') {
      if (!game.gameOver && game.player) game.player.attack(game);
    }
    if (e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') {
      game.triggerStairs();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    game.keys[e.key] = false;
  };

  const handleMouseMove = (e: MouseEvent) => {
    game.mouse.x = e.clientX;
    game.mouse.y = e.clientY;
  };

  const handleMouseDown = (e: MouseEvent) => {
    Sound.init();
    if (e.button === 0) {
      game.mouse.down = true;
      if (!game.gameOver && !game.isUpgradeModalOpen && game.player) game.player.attack(game);
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) game.mouse.down = false;
  };

  const handleWheel = (e: WheelEvent) => {
    if (!game.isUpgradeModalOpen && game.player) {
      game.player.weapon = e.deltaY > 0 ? 'bow' : 'sword';
      game.syncHUD();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('wheel', handleWheel);

  let animationId: number;
  let lastTime = performance.now();

  function loop(now: number) {
    const dt = Math.max(0, Math.min((now - lastTime) / 1000, 0.1));
    lastTime = now;
    game.update(dt);
    game.draw();
    animationId = requestAnimationFrame(loop);
  }
  animationId = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
    },
    setWeapon(w: 'sword' | 'bow') {
      if (game.player) {
        game.player.weapon = w;
        game.syncHUD();
      }
    },
    selectUpgrade(type: 'armor' | 'sword' | 'bow') {
      game.selectUpgrade(type);
    },
    triggerStairs() {
      game.triggerStairs();
    },
    restart() {
      game.score = 0;
      game.level = 1;
      game.nextUpgradeScore = 300;
      game.totalUpgrades = 0;
      game.isUpgradeModalOpen = false;
      game.player = null;
      game.enterZone('village');
    }
  };
}
