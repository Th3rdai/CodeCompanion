import { useEffect, useRef } from 'react';
import { use3DEffects } from '../../contexts/Effects3DContext';

export default function OrbitingBadge({ status = 'online', size = 40 }) {
  const { enabled } = use3DEffects();
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);

  const getColor = () => {
    switch (status) {
      case 'online':
        return '#22c55e';
      case 'offline':
        return '#ef4444';
      case 'streaming':
        return '#6366f1';
      default:
        return '#6366f1';
    }
  };

  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const initBadge = async () => {
      const THREE = await import('three');

      if (!containerRef.current) return;

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      camera.position.z = 3;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);

      const color = getColor();

      // Central sphere
      const sphereGeom = new THREE.SphereGeometry(0.3, 32, 32);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      scene.add(sphere);

      // Add glow effect with a larger transparent sphere
      const glowGeom = new THREE.SphereGeometry(0.4, 32, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.3,
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      scene.add(glow);

      // Orbiting icosahedra
      const orbitGeom = new THREE.IcosahedronGeometry(0.1, 0);
      const orbitMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
      });

      const ico1 = new THREE.Mesh(orbitGeom, orbitMat);
      const ico2 = new THREE.Mesh(orbitGeom, orbitMat);
      scene.add(ico1);
      scene.add(ico2);

      // Pulsing effect for streaming
      const pulse = () => {
        if (status === 'streaming') {
          const scale = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
          glow.scale.set(scale, scale, scale);
        }
      };

      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        if (document.hidden) return;

        const time = Date.now() * 0.001;

        // Rotate central sphere
        sphere.rotation.x += 0.005;
        sphere.rotation.y += 0.007;

        // Orbit icosahedra
        ico1.position.x = Math.cos(time) * 0.8;
        ico1.position.y = Math.sin(time) * 0.8;
        ico1.rotation.x += 0.05;
        ico1.rotation.y += 0.05;

        ico2.position.x = Math.cos(time + Math.PI) * 0.8;
        ico2.position.y = Math.sin(time + Math.PI) * 0.8;
        ico2.rotation.x -= 0.05;
        ico2.rotation.y -= 0.05;

        pulse();

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        sphereGeom.dispose();
        glowGeom.dispose();
        orbitGeom.dispose();
        sphereMat.dispose();
        glowMat.dispose();
        orbitMat.dispose();
        renderer.dispose();
        if (containerRef.current && renderer.domElement.parentNode) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    };

    const cleanup = initBadge().then((fn) => fn);

    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then((fn) => fn?.());
      }
    };
  }, [status, size, enabled]);

  if (!enabled) {
    const dotColor = getColor();
    return (
      <span style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: dotColor,
        boxShadow: `0 0 6px ${dotColor}`,
      }} />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
      }}
    />
  );
}
