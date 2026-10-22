'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import { useTheme } from '@/lib/theme';
import { createGame, launch, tick, MAX_LIVES, type Game } from './breakout';
import styles from './Auth.module.css';

const LEVELS = ['var(--row2)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];
const PATTERN = [0, 1, 0, 2, 1, 0, 3, 1, 0, 2, 4, 1, 0, 1];

// 14×3 heatmap; each cell's level is also its brick strength in the game
const MOTIF = Array.from({ length: 42 }, (_, i) =>
    (PATTERN[i % 14] * (i % 3 === 0 ? 1 : 0)) || (i * 7 % 5 === 0 ? 2 : i % 4 === 0 ? 1 : 0)
);

type Hud = { lives: number; cleared: number; total: number; phase: Game['phase'] };

function isPhone() {
    return window.matchMedia('(max-width: 719px)').matches;
}

function hudMessage(h: Hud, phone: boolean): { text: string; tone: 'muted' | 'neg' | 'pos' } | null {
    const key = phone ? 'TAP' : 'SPACE';
    if (h.phase === 'ready') {
        return { text: phone ? 'TAP TO LAUNCH · DRAG TO MOVE' : 'SPACE / CLICK TO LAUNCH · MOUSE OR ← → TO MOVE', tone: 'muted' };
    }
    if (h.phase === 'over') return { text: `OUT OF LIVES · CLEARED ${h.cleared} ${h.cleared === 1 ? 'DAY' : 'DAYS'} · ${key} TO RETRY`, tone: 'neg' };
    if (h.phase === 'won') return { text: `BUDGET BALANCED · ALL ${h.total} DAYS CLEARED · ${key} TO REPLAY`, tone: 'pos' };
    return null;
}

export default function BrandPanel() {
    const { theme, toggle } = useTheme();
    const panelRef = useRef<HTMLElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLSpanElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<Game | null>(null);
    const rafRef = useRef(0);
    const touchActRef = useRef(false);
    const [playing, setPlaying] = useState(false);
    const [full, setFull] = useState(false); // phone: the panel takes over the screen while playing
    const [phone, setPhone] = useState(false);
    const [hud, setHud] = useState<Hud | null>(null);

    const syncHud = useCallback(() => {
        const g = gameRef.current;
        if (g) setHud({ lives: g.lives, cleared: g.cleared, total: g.total, phase: g.phase });
    }, []);

    /** Measures the board and runs the game loop until quit */
    const begin = useCallback((ph: boolean) => {
        const panel = panelRef.current, grid = gridRef.current, cursor = cursorRef.current, canvas = canvasRef.current;
        if (!panel || !grid || !cursor || !canvas) return;
        cancelAnimationFrame(rafRef.current);
        gameRef.current = createGame(panel, grid, cursor, canvas, ph);
        setPlaying(true);
        syncHud();
        const frame = (ts: number) => {
            const g = gameRef.current;
            if (!g) return;
            if (tick(g, ts)) syncHud();
            rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);
    }, [syncHud]);

    const quit = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        gameRef.current = null;
        const cv = canvasRef.current;
        if (cv) { cv.width = 0; cv.height = 0; }
        setPlaying(false);
        setFull(false);
        setHud(null);
    }, []);

    const start = useCallback(() => {
        // Drop focus from the clicked hint/cursor, otherwise Space would re-press that button
        // instead of launching (keys are ignored while a control has focus)
        (document.activeElement as HTMLElement | null)?.blur?.();
        const ph = isPhone();
        setPhone(ph);
        if (ph && !full) {
            // Go full screen first, then measure the bigger board once it has laid out
            setFull(true);
            setPlaying(true);
            setTimeout(() => begin(true), 60);
        } else {
            begin(ph);
        }
    }, [full, begin]);

    /** Space / click / tap: launch the ball, or restart after a win or loss */
    const action = useCallback(() => {
        const g = gameRef.current;
        if (!g) return;
        if (g.phase === 'ready') { launch(g); syncHud(); }
        else if (g.phase === 'over' || g.phase === 'won') begin(isPhone());
    }, [begin, syncHud]);

    useEffect(() => {
        const typing = (t: EventTarget | null) => /^(input|textarea|select|button)$/i.test((t as HTMLElement)?.tagName ?? '');
        function onKeyDown(e: KeyboardEvent) {
            if (typing(e.target)) return;
            const g = gameRef.current;
            if (!g) {
                if (e.key === ' ' && e.target === document.body) { e.preventDefault(); start(); }
                return;
            }
            if (e.key === 'Escape') return quit();
            if (e.key === 'ArrowLeft') { e.preventDefault(); g.keys.left = true; }
            if (e.key === 'ArrowRight') { e.preventDefault(); g.keys.right = true; }
            if (e.key === ' ') { e.preventDefault(); action(); }
        }
        function onKeyUp(e: KeyboardEvent) {
            const g = gameRef.current;
            if (!g) return;
            if (e.key === 'ArrowLeft') g.keys.left = false;
            if (e.key === 'ArrowRight') g.keys.right = false;
        }
        let lastWidth = window.innerWidth;
        function onResize() {
            // Brick positions are measured once, so a width change ends the game
            if (gameRef.current && window.innerWidth !== lastWidth) quit();
            lastWidth = window.innerWidth;
        }
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('resize', onResize);
        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('resize', onResize);
        };
    }, [action, quit, start]);

    function pointerX(clientX: number) {
        const g = gameRef.current;
        if (g) g.mx = clientX - g.left;
    }

    const msg = hud && hudMessage(hud, phone);

    return (
        <section
            ref={panelRef}
            className={cx(styles.brandPanel, playing && styles.brandPlaying, full && styles.brandFull)}
            onMouseMove={e => pointerX(e.clientX)}
            onClick={() => {
                if (touchActRef.current) { touchActRef.current = false; return; }
                action();
            }}
            onTouchStart={e => {
                if (!gameRef.current) return;
                pointerX(e.touches[0].clientX);
                touchActRef.current = true;
                action();
            }}
            onTouchMove={e => pointerX(e.touches[0].clientX)}
        >
            <div className={styles.brand}>
                <span className={styles.mark} />SPENDLY
                <button
                    type="button"
                    className={cx(styles.themeBtn, playing && styles.hidden)}
                    onClick={e => { e.stopPropagation(); toggle(); }}
                >
                    {theme === 'light' ? '◑ DARK' : '◐ LIGHT'}
                </button>
            </div>

            <div className={styles.hero}>
                <h1 className={styles.heroText}>
                    Track your expenses and plan your budget.
                    <span
                        ref={cursorRef}
                        className={cx(styles.cursor, playing && styles.hidden)}
                        onClick={e => { e.stopPropagation(); if (!gameRef.current) start(); }}
                        title="Play"
                    >
                        _
                    </span>
                </h1>
                <div className={cx(styles.motifBlock, playing && styles.faded)}>
                    <div ref={gridRef} className={styles.motif} aria-hidden="true">
                        {MOTIF.map((lv, i) => <span key={i} data-lv={lv} style={{ background: LEVELS[lv] }} />)}
                    </div>
                    <button type="button" className={styles.playHint} onClick={e => { e.stopPropagation(); start(); }}>
                        <span className={styles.desktopText}>▶ BORED? CLICK THE CURSOR TO BREAK SOME DAYS</span>
                        <span className={styles.phoneText}>▶ TAP THE CURSOR TO PLAY</span>
                    </button>
                </div>
            </div>

            <span className={cx(styles.tagline, playing && styles.faded)}>BUDGET · DAILY LOG · ANNUAL REVIEW</span>

            <canvas ref={canvasRef} className={styles.canvas} />

            {playing && hud && (
                <>
                    <div className={styles.hud}>
                        <span>LIVES <span className={styles.lives}>{'■'.repeat(hud.lives)}{'□'.repeat(MAX_LIVES - hud.lives)}</span></span>
                        <span>CLEARED <span className={styles.hudValue}>{hud.cleared}/{hud.total}</span></span>
                        {phone ? (
                            <button
                                type="button"
                                className={styles.quitBtn}
                                onClick={e => { e.stopPropagation(); quit(); }}
                                onTouchStart={e => e.stopPropagation()}
                            >
                                ✕ QUIT
                            </button>
                        ) : (
                            <span className={styles.hudDim}>ESC TO QUIT</span>
                        )}
                    </div>
                    {msg && (
                        <div className={styles.hudMsgWrap}>
                            <span className={cx(styles.hudMsg, msg.tone === 'neg' && styles.msgNeg, msg.tone === 'pos' && styles.msgPos)}>
                                {msg.text}
                            </span>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
