import { useEffect, useRef } from 'react';
import { use3DEffects } from '../../contexts/Effects3DContext';

export default function TypingIndicator3D() {
  const { enabled, theme } = use3DEffects();
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);

  const colors = [theme.primary, theme.secondary, theme.tertiary];

  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const initIndicator = async () => {
      const THREE = await import('three');

      if (!containerRef.current) return;

      const scene = new THREE.Scene();
      scene.background = null;

      const width = 100;
      const height = 40;

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 3;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);

      // Create 3 rotating cubes
      const cubes = [];
      for (let i = 0; i < 3; i++) {
        const geom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(colors[i]),
        });
        const cube = new THREE.Mesh(geom, mat);
        cube.position.x = (i - 1) * 0.6;
        scene.add(cube);
        cubes.push(cube);
      }

      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        if (document.hidden) return;

        const time = Date.now() * 0.003;

        cubes.forEach((cube, i) => {
          // Rotation
          cube.rotation.x += 0.05;
          cube.rotation.y += 0.07;

          // Scale breathing effect with stagger
          const scale = 0.7 + Math.sin(time + i * (Math.PI / 1.5)) * 0.3;
          cube.scale.set(scale, scale, scale);
        });

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        cubes.forEach((cube) => {
          cube.geometry.dispose();
          cube.material.dispose();
        });
        renderer.dispose();
        if (containerRef.current && renderer.domElement.parentNode) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    };

    const cleanup = initIndicator().then((fn) => fn);

    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then((fn) => fn?.());
      }
    };
  }, [enabled, theme]);

  if (!enabled) {
    return (
      <div className="flex items-center gap-1.5 p-3">
        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'inline-block',
      }}
    />
  );
}
