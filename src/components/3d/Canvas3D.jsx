import { useEffect, useRef, useState } from 'react';

export default function Canvas3D({
  className = '',
  style = {},
  children,
  fps = 30,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animationIdRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // Check prefers-reduced-motion
  const prefersReducedMotion = () => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  useEffect(() => {
    // Return static fallback if reduced motion is preferred
    if (prefersReducedMotion()) {
      return;
    }

    const initCanvas = async () => {
      const THREE = await import('three');

      if (!containerRef.current) return;

      // Create scene, camera, renderer
      const scene = new THREE.Scene();
      scene.background = null;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      const camera = new THREE.PerspectiveCamera(
        75,
        width / height,
        0.1,
        1000
      );
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        precision: 'highp',
      });

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;

      // Animation loop with target FPS
      const frameDuration = 1000 / fps;
      let lastFrameTime = Date.now();

      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        // Skip frames if not enough time has passed
        const now = Date.now();
        if (now - lastFrameTime < frameDuration) {
          return;
        }
        lastFrameTime = now;

        // Check visibility
        if (document.hidden) {
          return;
        }

        renderer.render(scene, camera);
      };

      animate();

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        const newWidth = containerRef.current?.clientWidth || width;
        const newHeight = containerRef.current?.clientHeight || height;

        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      });

      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;

      setIsReady(true);
    };

    initCanvas();

    return () => {
      // Cleanup
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
    };
  }, [fps]);

  // Render fallback if reduced motion
  if (prefersReducedMotion()) {
    return (
      <div
        className={className}
        style={{
          background:
            'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', ...style }}
    >
      {isReady && children && typeof children === 'function'
        ? children({
            scene: sceneRef.current,
            camera: cameraRef.current,
            renderer: rendererRef.current,
          })
        : null}
    </div>
  );
}
