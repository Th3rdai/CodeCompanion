import { useEffect, useRef } from "react";

/**
 * Splite — Animated beam/light line effect inspired by 21st.dev/serafimcloud
 * A futuristic animated divider that renders a glowing line with traveling light particles.
 */
export default function Splite({
  className = "",
  color = "#8b5cf6",
  width = "100%",
  height = 2,
  speed = 3,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = Math.max(rect.height, 20) * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    const particles = [];
    const particleCount = 3;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() * canvas.width) / dpr,
        speed: (0.5 + Math.random() * 0.5) * speed,
        size: 30 + Math.random() * 60,
        opacity: 0.4 + Math.random() * 0.6,
      });
    }

    function draw() {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Base line
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.strokeStyle = color + "30";
      ctx.lineWidth = height;
      ctx.stroke();

      // Traveling glow particles
      for (const p of particles) {
        const grad = ctx.createLinearGradient(
          p.x - p.size,
          cy,
          p.x + p.size,
          cy,
        );
        grad.addColorStop(0, "transparent");
        grad.addColorStop(
          0.5,
          color +
            Math.round(p.opacity * 255)
              .toString(16)
              .padStart(2, "0"),
        );
        grad.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.moveTo(p.x - p.size, cy);
        ctx.lineTo(p.x + p.size, cy);
        ctx.strokeStyle = grad;
        ctx.lineWidth = height + 2;
        ctx.stroke();

        // Core bright center
        const coreGrad = ctx.createRadialGradient(
          p.x,
          cy,
          0,
          p.x,
          cy,
          p.size * 0.3,
        );
        coreGrad.addColorStop(0, color + "cc");
        coreGrad.addColorStop(1, "transparent");
        ctx.fillStyle = coreGrad;
        ctx.fillRect(p.x - p.size * 0.3, cy - 6, p.size * 0.6, 12);

        p.x += p.speed;
        if (p.x - p.size > w) {
          p.x = -p.size;
          p.opacity = 0.4 + Math.random() * 0.6;
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
    };
  }, [color, height, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height: 20, display: "block" }}
      aria-hidden="true"
    />
  );
}
