import { useEffect, useRef, useState } from 'react';
import { use3DEffects } from '../../contexts/Effects3DContext';

export default function TokenCounter({ tokens = 0, duration = 0 }) {
  const { enabled, theme } = use3DEffects();
  const containerRef = useRef(null);
  const [displayTokens, setDisplayTokens] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const animationIdRef = useRef(null);
  const canvasRef = useRef(null);

  // Animate token count-up
  useEffect(() => {
    const startTime = Date.now();
    const animationDuration = 800; // 0.8s

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      const current = Math.floor(tokens * progress);
      setDisplayTokens(current);

      if (progress < 1) {
        animationIdRef.current = requestAnimationFrame(animate);
      }
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [tokens]);

  // Fade in on mount, fade out after 4s
  useEffect(() => {
    setOpacity(1);

    const fadeTimer = setTimeout(() => {
      setOpacity(0);
    }, 4000);

    return () => clearTimeout(fadeTimer);
  }, []);

  // Draw holographic wireframe and text
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = 200;
    const height = 60;

    ctx.clearRect(0, 0, width, height);

    // Set opacity
    ctx.globalAlpha = opacity;

    // Draw wireframe box
    ctx.strokeStyle = theme.tertiary;
    ctx.lineWidth = 2;
    const padding = 10;
    ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);

    // Draw corner accents
    const cornerSize = 8;
    ctx.strokeStyle = theme.primary;
    ctx.lineWidth = 1.5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(padding, padding + cornerSize);
    ctx.lineTo(padding, padding);
    ctx.lineTo(padding + cornerSize, padding);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(width - padding - cornerSize, padding);
    ctx.lineTo(width - padding, padding);
    ctx.lineTo(width - padding, padding + cornerSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(padding, height - padding - cornerSize);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(padding + cornerSize, height - padding);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(width - padding - cornerSize, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(width - padding, height - padding - cornerSize);
    ctx.stroke();

    // Draw text
    ctx.globalAlpha = opacity;
    ctx.fillStyle = theme.tertiary;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = `${displayTokens} tokens`;
    ctx.fillText(text, width / 2, height / 2 - 8);

    const dur = Number(duration);
    if (dur && Number.isFinite(dur)) {
      ctx.font = '12px monospace';
      ctx.fillStyle = theme.secondary;
      ctx.globalAlpha = opacity * 0.6;
      ctx.fillText(`${dur.toFixed(2)}s`, width / 2, height / 2 + 12);
    }
  }, [displayTokens, opacity, duration, theme]);

  if (!enabled) {
    return (
      <span className="text-xs text-slate-400">
        {tokens} tokens{duration && Number.isFinite(Number(duration)) ? ` · ${Number(duration).toFixed(1)}s` : ''}
      </span>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        opacity: opacity,
        transition: 'opacity 0.3s ease-out',
      }}
    >
      <canvas
        ref={canvasRef}
        width={200}
        height={60}
        style={{
          display: 'block',
          filter: `drop-shadow(0 0 8px ${theme.tertiary}66)`,
        }}
      />
    </div>
  );
}
