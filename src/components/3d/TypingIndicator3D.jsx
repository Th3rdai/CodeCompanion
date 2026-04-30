import { useEffect, useRef, useState } from "react";
import { use3DEffects } from "../../contexts/Effects3DContext";

// ── Humorous mode-aware messages ─────────────────────
const MODE_QUIPS = {
  diagram: [
    "Sharpening my crayons...",
    "Connecting the dots... literally",
    "Arguing with the flowchart gods",
    "Making boxes talk to each other",
    "Drawing lines with purpose",
    "Untangling the spaghetti",
    "Aligning nodes... almost there",
    "Consulting the diagram oracle",
  ],
  review: [
    "Putting on my reading glasses...",
    "Grading with a generous curve",
    "Looking for bugs with a magnifying glass",
    "Checking under the hood...",
    "Counting red flags... hopefully zero",
    "Being honest but gentle...",
  ],
  explain: [
    "Translating nerd to human...",
    "Finding the perfect analogy",
    "Simplifying the complicated bits",
    "Channeling my inner teacher",
    "Brewing an explanation...",
  ],
  bugs: [
    "Hunting bugs with a flashlight...",
    "Checking for monsters under the code",
    "Poking things to see what breaks",
    "Sniffing out trouble...",
    "Looking for the gotchas...",
  ],
  refactor: [
    "Tidying up the code closet...",
    "Marie Kondo-ing your functions",
    "Folding the code neatly...",
    "Sparking joy in your codebase",
  ],
  "translate-tech": [
    "Translating geek speak...",
    "Removing all the jargon...",
    "Making this make sense...",
  ],
  "translate-biz": [
    "Turning ideas into blueprints...",
    "Building your spec sheet...",
    "Drafting the game plan...",
  ],
  create: [
    "Scaffolding something awesome...",
    "Setting the stage...",
    "Preparing the canvas...",
  ],
  prompting: [
    "Prompt-ception in progress...",
    "Engineering the prompt engineer...",
    "Meta-thinking intensifies...",
  ],
  skillz: [
    "Teaching AI to teach AI...",
    "Skill-crafting in progress...",
    "Building brains for robots...",
  ],
  agentic: [
    "Designing an AI overlord... safely",
    "Adding guardrails and safety nets",
    "Training the agent apprentice...",
  ],
  experiment: [
    "Running a careful trial...",
    "Measuring twice, coding once",
    "Checking the lab goggles...",
    "Isolating variables...",
  ],
};

const DEFAULT_QUIPS = [
  "Thinking really hard...",
  "Consulting my neural networks...",
  "Summoning the right words...",
  "Processing at the speed of thought",
  "Rummaging through my brain...",
  "Almost there... probably",
  "Assembling a thoughtful response...",
  "Loading wisdom...",
  "Crunching the knowledge base...",
  "Brewing up something good...",
];

function getQuips(mode) {
  return MODE_QUIPS[mode] || DEFAULT_QUIPS;
}

export default function TypingIndicator3D({ mode }) {
  const { enabled, theme } = use3DEffects();
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);
  const [quipIndex, setQuipIndex] = useState(0);

  const quips = getQuips(mode);

  // Rotate quips every 3 seconds
  useEffect(() => {
    // Start with a random quip
    setQuipIndex(Math.floor(Math.random() * quips.length));

    const interval = setInterval(() => {
      setQuipIndex((prev) => (prev + 1) % quips.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [quips]);

  const colors = [theme.primary, theme.secondary, theme.tertiary];

  useEffect(() => {
    if (
      !enabled ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const initIndicator = async () => {
      const THREE = await import("three");

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
      if (cleanup && typeof cleanup.then === "function") {
        cleanup.then((fn) => fn?.());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, theme]);

  const quipText = (
    <span
      key={quipIndex}
      className="text-xs text-slate-400 italic fade-in ml-2"
      style={{ display: "inline-block", minWidth: "200px" }}
    >
      {quips[quipIndex % quips.length]}
    </span>
  );

  if (!enabled) {
    return (
      <div className="flex items-center gap-1.5 p-3">
        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
        <div className="w-2 h-2 bg-indigo-400 rounded-full typing-dot" />
        {quipText}
      </div>
    );
  }

  return (
    <div className="flex items-center p-3">
      <div
        ref={containerRef}
        style={{
          display: "inline-block",
        }}
      />
      {quipText}
    </div>
  );
}
