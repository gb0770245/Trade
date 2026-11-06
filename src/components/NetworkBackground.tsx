import React, { useEffect, useRef } from 'react';
import { ThemeMode } from '../types';

interface Props {
  theme: ThemeMode;
}

export const NetworkBackground: React.FC<Props> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // On small mobile screens, the center mobile container is opaque, so canvas animation wastes CPU.
    // Disable heavy canvas loop on mobile devices for maximum touch responsiveness and battery efficiency.
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 640) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let isTabVisible = !document.hidden;

    const handleResize = () => {
      if (!canvas) return;
      if (window.innerWidth < 640) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleVisibility = () => {
      isTabVisible = !document.hidden;
    };

    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    // Optimized particle count for silky 60fps with low CPU load
    const particleCount = Math.min(22, Math.floor(width / 50));
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 2 + 1,
        baseAlpha: Math.random() * 0.4 + 0.2,
      });
    }

    const getColors = () => {
      switch (theme) {
        case 'obsidian-gold':
          return {
            node: 'rgba(234, 179, 8, ',
            line: 'rgba(234, 179, 8, ',
          };
        case 'cyber-hydrogen':
          return {
            node: 'rgba(56, 189, 248, ',
            line: 'rgba(56, 189, 248, ',
          };
        case 'teal-clean':
        default:
          return {
            node: 'rgba(20, 184, 166, ',
            line: 'rgba(14, 165, 233, ',
          };
      }
    };

    let lastFrameTime = 0;
    const targetInterval = 1000 / 30; // Throttle to 30 FPS for desktop to conserve CPU for fast UI responsiveness
    const maxDistSq = 130 * 130;

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);

      if (!isTabVisible) return;
      if (time - lastFrameTime < targetInterval) return;
      lastFrameTime = time;

      ctx.clearRect(0, 0, width, height);
      const colors = getColors();

      // Update and draw particles
      const count = particles.length;
      for (let i = 0; i < count; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Draw node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${colors.node}${p.baseAlpha})`;
        ctx.fill();

        // Connect nearby nodes using squared distance (avoids costly Math.sqrt)
        for (let j = i + 1; j < count; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const ratio = 1 - distSq / maxDistSq;
            const lineAlpha = ratio * 0.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `${colors.line}${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transform-gpu">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60 hidden sm:block" />
      {/* Lightweight CSS ambient glow orbs with hardware acceleration */}
      <div
        className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transform-gpu ${
          theme === 'obsidian-gold'
            ? 'bg-amber-500'
            : theme === 'cyber-hydrogen'
            ? 'bg-cyan-500'
            : 'bg-teal-400'
        }`}
      />
      <div
        className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transform-gpu ${
          theme === 'obsidian-gold'
            ? 'bg-yellow-600'
            : theme === 'cyber-hydrogen'
            ? 'bg-blue-600'
            : 'bg-emerald-400'
        }`}
      />
    </div>
  );
};
