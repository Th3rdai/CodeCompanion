import { useEffect, useRef } from "react";
import { use3DEffects } from "../../contexts/Effects3DContext";

export default function FloatingGeometry({ shapeCount = 6 }) {
  const { enabled, theme } = use3DEffects();
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);

  const colors = [theme.primary, theme.secondary, theme.tertiary];

  useEffect(() => {
    if (
      !enabled ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const initGeometry = async () => {
      const THREE = await import("three");

      if (!containerRef.current) return;

      const scene = new THREE.Scene();
      scene.background = null;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 15;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);

      // Create wireframe shapes
      const shapes = [];
      const geometries = [
        new THREE.TetrahedronGeometry(1),
        new THREE.OctahedronGeometry(1),
        new THREE.DodecahedronGeometry(0.8),
      ];

      for (let i = 0; i < shapeCount; i++) {
        const geom = geometries[i % geometries.length];
        const color = colors[i % colors.length];

        const wireframe = new THREE.WireframeGeometry(geom);
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.2,
          linewidth: 1,
        });
        const lines = new THREE.LineSegments(wireframe, mat);

        lines.position.x = (Math.random() - 0.5) * 20;
        lines.position.y = (Math.random() - 0.5) * 20;
        lines.position.z = (Math.random() - 0.5) * 10;

        lines.rotationSpeed = {
          x: (Math.random() - 0.5) * 0.003,
          y: (Math.random() - 0.5) * 0.003,
          z: (Math.random() - 0.5) * 0.003,
        };

        scene.add(lines);
        shapes.push(lines);
      }

      const animate = () => {
        animationIdRef.current = requestAnimationFrame(animate);

        if (document.hidden) return;

        shapes.forEach((shape) => {
          shape.rotation.x += shape.rotationSpeed.x;
          shape.rotation.y += shape.rotationSpeed.y;
          shape.rotation.z += shape.rotationSpeed.z;
        });

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

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
        shapes.forEach((shape) => {
          shape.geometry.dispose();
          shape.material.dispose();
        });
        geometries.forEach((g) => g.dispose());
        renderer.dispose();
        if (containerRef.current && renderer.domElement.parentNode) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    };

    const cleanup = initGeometry().then((fn) => fn);

    return () => {
      if (cleanup && typeof cleanup.then === "function") {
        cleanup.then((fn) => fn?.());
      }
    };
  }, [shapeCount, enabled, theme]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
