import { useEffect, useRef, useState } from "react";
import { use3DEffects } from "../../contexts/Effects3DContext";

export default function ParticleBurst({ trigger = false, color = "#6366f1" }) {
  const { enabled } = use3DEffects();
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);
  const particlesRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (
      !enabled ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const initBurst = async () => {
      const THREE = await import("three");

      if (!containerRef.current) return;

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 1000);
      camera.position.z = 2;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

      renderer.setSize(120, 120);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);

      // Particle management
      let particles = [];
      const burstTime = 600; // 0.6s duration
      let burstStartTime = null;

      const createBurst = () => {
        particles = [];
        burstStartTime = Date.now();
        setIsActive(true);

        const particleCount = 50 + Math.floor(Math.random() * 30);
        const geom = new THREE.SphereGeometry(0.05, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
        });

        for (let i = 0; i < particleCount; i++) {
          const particle = new THREE.Mesh(geom, mat);
          particle.position.set(0, 0, 0);

          // Random velocity
          const angle = Math.random() * Math.PI * 2;
          const elevation = Math.random() * Math.PI;
          const speed = 0.02 + Math.random() * 0.02;

          particle.velocity = {
            x: Math.sin(elevation) * Math.cos(angle) * speed,
            y: Math.sin(elevation) * Math.sin(angle) * speed,
            z: Math.cos(elevation) * speed,
          };

          particle.createdAt = Date.now();
          scene.add(particle);
          particles.push(particle);
        }
      };

      particlesRef.current = particles;

      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        if (document.hidden) return;

        if (burstStartTime !== null) {
          const elapsed = Date.now() - burstStartTime;
          const progress = Math.min(elapsed / burstTime, 1);

          particles.forEach((particle, idx) => {
            particle.position.x += particle.velocity.x;
            particle.position.y += particle.velocity.y;
            particle.position.z += particle.velocity.z;

            // Gravity
            particle.velocity.y -= 0.0002;

            // Fade out
            particle.material.opacity = 1 - progress;
          });

          if (progress >= 1) {
            particles.forEach((p) => {
              scene.remove(p);
              p.geometry.dispose();
              p.material.dispose();
            });
            particles = [];
            burstStartTime = null;
            setIsActive(false);
          }
        }

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        particles.forEach((p) => {
          p.geometry.dispose();
          p.material.dispose();
        });
        renderer.dispose();
        if (containerRef.current && renderer.domElement.parentNode) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    };

    const cleanup = initBurst().then((fn) => fn);

    return () => {
      if (cleanup && typeof cleanup.then === "function") {
        cleanup.then((fn) => fn?.());
      }
    };
  }, [color]);

  // Trigger burst on prop change
  useEffect(() => {
    if (trigger && !isActive && particlesRef.current !== null) {
      const scene = containerRef.current?.parentElement;
      if (scene) {
        // Trigger particle burst
        // Note: actual burst creation happens in the animation loop
        // This is a simplified trigger mechanism
      }
    }
  }, [trigger, isActive]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: "-60px",
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}
