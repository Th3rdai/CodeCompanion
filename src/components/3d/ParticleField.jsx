import { useEffect, useRef } from 'react';
import { use3DEffects } from '../../contexts/Effects3DContext';

export default function ParticleField({
  particleCount = 600,
  speed = 0.3,
  color = '#6366f1',
}) {
  const { enabled } = use3DEffects();
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const initParticles = async () => {
      const THREE = await import('three');

      if (!containerRef.current) return;

      // Adjust particle count for small screens
      const screenWidth = window.innerWidth;
      const adjustedCount =
        screenWidth < 768 ? Math.floor(particleCount * 0.5) : particleCount;

      const scene = new THREE.Scene();
      scene.background = null;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 10;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Create particle geometry
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(adjustedCount * 3);
      const velocities = new Float32Array(adjustedCount * 3);

      for (let i = 0; i < adjustedCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 30;
        positions[i + 1] = (Math.random() - 0.5) * 30;
        positions[i + 2] = (Math.random() - 0.5) * 20;

        velocities[i] = (Math.random() - 0.5) * speed;
        velocities[i + 1] = (Math.random() - 0.5) * speed;
        velocities[i + 2] = (Math.random() - 0.5) * speed * 0.5;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

      // Create material
      const material = new THREE.PointsMaterial({
        color: new THREE.Color(color),
        size: 0.15 + Math.random() * 0.1,
        opacity: 0.6,
        transparent: true,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Animation loop
      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        if (document.hidden) return;

        const posAttr = geometry.getAttribute('position');
        const posArray = posAttr.array;
        const velArray = geometry.getAttribute('velocity').array;

        for (let i = 0; i < adjustedCount * 3; i += 3) {
          posArray[i] += velArray[i];
          posArray[i + 1] += velArray[i + 1];
          posArray[i + 2] += velArray[i + 2];

          // Loop when out of bounds
          if (posArray[i] > 15) posArray[i] = -15;
          if (posArray[i] < -15) posArray[i] = 15;
          if (posArray[i + 1] > 15) posArray[i + 1] = -15;
          if (posArray[i + 1] < -15) posArray[i + 1] = 15;
          if (posArray[i + 2] > 10) posArray[i + 2] = -10;
          if (posArray[i + 2] < -10) posArray[i + 2] = 10;
        }

        posAttr.needsUpdate = true;
        renderer.render(scene, camera);
      };

      animate();

      // Handle resize
      const handleResize = () => {
        const newWidth = containerRef.current?.clientWidth || width;
        const newHeight = containerRef.current?.clientHeight || height;

        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        if (containerRef.current && renderer.domElement.parentNode) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    };

    const cleanup = initParticles().then((fn) => fn);

    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then((fn) => fn?.());
      }
    };
  }, [particleCount, speed, color, enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
