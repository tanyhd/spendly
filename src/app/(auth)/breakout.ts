// Breakout on the auth brand panel: the heatmap cells are the bricks (darker = more hits),
// the blinking cursor slides down and becomes the paddle.

export type Phase = 'intro' | 'ready' | 'play' | 'over' | 'won';

type Rect = { x: number; y: number; w: number; h: number };
type Brick = Rect & { lv: number };

export type Game = {
    W: number;
    H: number;
    ctx: CanvasRenderingContext2D;
    left: number;
    bricks: Brick[];
    total: number;
    cleared: number;
    lives: number;
    phase: Phase;
    t0: number;
    last: number;
    from: { x: number; y: number; w: number };
    to: { x: number; y: number; w: number };
    pad: Rect;
    ball: { x: number; y: number; vx: number; vy: number; s: number };
    speed: number;
    /** Pointer x within the panel (mouse/touch), or null when steering with the keyboard */
    mx: number | null;
    keys: { left: boolean; right: boolean };
    colors: { levels: string[]; line: string; primary: string; text: string };
};

export const MAX_LIVES = 3;
const START_SPEED = 380;
const MAX_SPEED = 640;
const KEY_SPEED = 640;
const INTRO_MS = 650;

function cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function createGame(panel: HTMLElement, grid: HTMLElement, cursor: HTMLElement, canvas: HTMLCanvasElement, phone: boolean): Game {
    const pr = panel.getBoundingClientRect();
    const W = pr.width, H = pr.height, dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bricks = [...grid.children].map(el => {
        const r = el.getBoundingClientRect();
        return { x: r.left - pr.left, y: r.top - pr.top, w: r.width, h: r.height, lv: Number((el as HTMLElement).dataset.lv) || 0 };
    });

    // Paddle starts as the cursor and eases down to its playing spot below the bricks
    const cr = cursor.getBoundingClientRect();
    const from = { x: cr.left - pr.left, y: cr.top - pr.top + cr.height * 0.8, w: cr.width };
    const bricksBottom = Math.max(0, ...bricks.map(k => k.y + k.h));
    const toW = phone ? 84 : 96;
    const to = {
        w: toW,
        y: Math.min(H - 40, Math.max(bricksBottom + 140, H - (phone ? 132 : 104))),
        x: Math.min(W - toW, Math.max(0, from.x + from.w / 2 - toW / 2)),
    };

    const now = performance.now();
    return {
        W, H, ctx, left: pr.left, bricks, total: bricks.length, cleared: 0, lives: MAX_LIVES, phase: 'intro',
        t0: now, last: now, from, to,
        pad: { x: from.x, y: from.y, w: from.w, h: 8 },
        ball: { x: 0, y: 0, vx: 0, vy: 0, s: 10 },
        speed: START_SPEED, mx: null, keys: { left: false, right: false },
        colors: {
            levels: ['--row2', '--heat-1', '--heat-2', '--heat-3', '--primary'].map(cssVar),
            line: cssVar('--line'),
            primary: cssVar('--primary'),
            text: cssVar('--text'),
        },
    };
}

export function launch(g: Game) {
    const a = (Math.random() * 60 - 30) * Math.PI / 180;
    g.ball.vx = g.speed * Math.sin(a);
    g.ball.vy = -g.speed * Math.cos(a);
    g.phase = 'play';
}

/** Advances one frame; returns true when the HUD (lives/cleared/phase) changed */
export function tick(g: Game, ts: number): boolean {
    const dt = Math.min(0.033, (ts - g.last) / 1000);
    g.last = ts;
    const p = g.pad, b = g.ball;
    let changed = false;

    if (g.phase === 'intro') {
        const k = Math.min(1, (ts - g.t0) / INTRO_MS), e = 1 - Math.pow(1 - k, 3);
        p.x = g.from.x + (g.to.x - g.from.x) * e;
        p.y = g.from.y + (g.to.y - g.from.y) * e;
        p.w = g.from.w + (g.to.w - g.from.w) * e;
        if (k >= 1) { g.phase = 'ready'; changed = true; }
    } else {
        const dir = (g.keys.right ? 1 : 0) - (g.keys.left ? 1 : 0);
        if (dir) { g.mx = null; p.x += dir * KEY_SPEED * dt; }
        else if (g.mx !== null) p.x += (g.mx - p.w / 2 - p.x) * Math.min(1, dt * 18);
        p.x = Math.max(0, Math.min(g.W - p.w, p.x));
    }

    if (g.phase === 'ready' || g.phase === 'intro') {
        b.x = p.x + p.w / 2 - b.s / 2;
        b.y = p.y - b.s - 2;
    }
    if (g.phase === 'play') {
        // Sub-steps keep the fast ball from tunnelling through bricks
        for (let i = 0; i < 3 && g.phase === 'play'; i++) changed = step(g, dt / 3) || changed;
    }
    draw(g, ts);
    return changed;
}

function step(g: Game, dt: number): boolean {
    const b = g.ball, p = g.pad;
    let changed = false;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
    if (b.x + b.s > g.W) { b.x = g.W - b.s; b.vx = -Math.abs(b.vx); }
    if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }

    // Paddle: the bounce angle depends on where the ball hits it
    if (b.vy > 0 && b.y + b.s >= p.y && b.y + b.s <= p.y + p.h + 10 && b.x + b.s > p.x && b.x < p.x + p.w) {
        const rel = Math.max(-1, Math.min(1, ((b.x + b.s / 2) - (p.x + p.w / 2)) / (p.w / 2)));
        const a = rel * 62 * Math.PI / 180;
        b.vx = g.speed * Math.sin(a);
        b.vy = -g.speed * Math.cos(a);
        b.y = p.y - b.s;
    }

    for (let i = 0; i < g.bricks.length; i++) {
        const k = g.bricks[i];
        if (b.x + b.s <= k.x || b.x >= k.x + k.w || b.y + b.s <= k.y || b.y >= k.y + k.h) continue;
        const ox = Math.min(b.x + b.s - k.x, k.x + k.w - b.x);
        const oy = Math.min(b.y + b.s - k.y, k.y + k.h - b.y);
        if (ox < oy) { b.vx = -b.vx; b.x += b.vx > 0 ? ox : -ox; }
        else { b.vy = -b.vy; b.y += b.vy > 0 ? oy : -oy; }
        k.lv--;
        if (k.lv < 0) {
            g.bricks.splice(i, 1);
            g.cleared++;
            g.speed = Math.min(MAX_SPEED, g.speed + 6);
            const sp = Math.hypot(b.vx, b.vy) || 1;
            b.vx *= g.speed / sp;
            b.vy *= g.speed / sp;
            if (!g.bricks.length) g.phase = 'won';
            changed = true;
        }
        break;
    }

    if (b.y > g.H) {
        g.lives--;
        g.phase = g.lives > 0 ? 'ready' : 'over';
        changed = true;
    }
    return changed;
}

function draw(g: Game, ts: number) {
    const c = g.ctx, p = g.pad, b = g.ball;
    c.clearRect(0, 0, g.W, g.H);
    for (const k of g.bricks) {
        c.fillStyle = g.colors.levels[Math.max(0, k.lv)];
        c.fillRect(k.x, k.y, k.w, k.h);
        if (k.lv === 0) {
            c.strokeStyle = g.colors.line;
            c.strokeRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1);
        }
    }
    const waiting = g.phase === 'ready' || g.phase === 'over' || g.phase === 'won';
    if (!waiting || Math.floor(ts / 500) % 2 === 0) {
        c.fillStyle = g.colors.primary;
        c.fillRect(p.x, p.y, p.w, p.h);
    }
    if (g.phase !== 'over' && g.phase !== 'won' && g.phase !== 'intro') {
        c.fillStyle = g.colors.text;
        c.fillRect(b.x, b.y, b.s, b.s);
    }
}
