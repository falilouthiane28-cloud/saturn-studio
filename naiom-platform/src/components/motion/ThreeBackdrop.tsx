"use client";

import { useEffect, useRef, useState } from "react";

interface ThreeBackdropProps {
  /** Intensité visuelle : `soft` pour un en-tête, `normal` pour un hero. */
  intensity?: "soft" | "normal";
  className?: string;
}

/**
 * Fond animé WebGL — trois halos colorés qui dérivent lentement.
 *
 * Volontairement minimal : un seul plan plein écran et un fragment shader
 * sans texture ni passe de post-traitement. Pas de géométrie, pas de lumière,
 * pas de boucle physique — le coût GPU est celui d'un dégradé animé.
 *
 * Garde-fous (dans cet ordre) :
 *  1. `prefers-reduced-motion` → rien n'est monté, un dégradé CSS statique reste.
 *  2. Appareil peu puissant (< 4 cœurs) ou WebGL indisponible → idem.
 *  3. Hors écran (IntersectionObserver) ou onglet caché → boucle stoppée.
 *  4. Démontage → géométrie, matériau et contexte WebGL libérés.
 *
 * Le canvas est purement décoratif : aria-hidden, non focusable, sous le
 * contenu, et jamais porteur d'information.
 */
export function ThreeBackdrop({ intensity = "normal", className }: ThreeBackdropProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  // Décide une seule fois si l'on anime, avant toute tentative de montage.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if ((navigator.hardwareConcurrency ?? 8) < 4) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      if (disposed || !hostRef.current) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
      } catch {
        return; // WebGL indisponible : on laisse le dégradé CSS.
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geometry = new THREE.PlaneGeometry(2, 2);

      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(host.clientWidth, host.clientHeight) },
        // `soft` reste volontairement très bas : le fond passe derrière du
        // texte et un portrait, il ne doit jamais entrer en concurrence.
        uIntensity: { value: intensity === "soft" ? 0.16 : 0.45 },
      };

      const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision mediump float;
          varying vec2 vUv;
          uniform float uTime;
          uniform vec2  uRes;
          uniform float uIntensity;

          // Halo radial doux autour de p.
          float blob(vec2 uv, vec2 p, float r) {
            return smoothstep(r, 0.0, distance(uv, p));
          }

          void main() {
            // Corrige le ratio pour que les halos restent circulaires.
            vec2 uv = vUv;
            uv.x *= uRes.x / max(uRes.y, 1.0);

            float t = uTime * 0.06;
            vec2 c1 = vec2(0.30 + sin(t * 1.10) * 0.18, 0.35 + cos(t * 0.90) * 0.16);
            vec2 c2 = vec2(0.75 + cos(t * 0.80) * 0.20, 0.60 + sin(t * 1.30) * 0.14);
            vec2 c3 = vec2(0.52 + sin(t * 0.60) * 0.24, 0.20 + cos(t * 1.05) * 0.18);
            c1.x *= uRes.x / max(uRes.y, 1.0);
            c2.x *= uRes.x / max(uRes.y, 1.0);
            c3.x *= uRes.x / max(uRes.y, 1.0);

            vec3 col = vec3(0.0);
            col += vec3(0.961, 0.255, 0.110) * blob(uv, c1, 0.55); // accent bronx
            col += vec3(0.357, 0.302, 0.933) * blob(uv, c2, 0.60); // violet
            col += vec3(0.176, 0.478, 0.333) * blob(uv, c3, 0.50); // vert sapin

            float a = clamp(length(col), 0.0, 1.0) * uIntensity;
            gl_FragColor = vec4(col, a);
          }
        `,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      /* --- Mise en pause : hors écran ou onglet caché --- */
      let visible = true;
      let onScreen = true;
      const shouldRun = () => visible && onScreen;

      const io = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting;
          if (shouldRun()) start();
        },
        { threshold: 0 }
      );
      io.observe(host);

      const onVisibility = () => {
        visible = document.visibilityState === "visible";
        if (shouldRun()) start();
      };
      document.addEventListener("visibilitychange", onVisibility);

      const ro = new ResizeObserver(() => {
        if (!hostRef.current) return;
        const w = hostRef.current.clientWidth;
        const h = hostRef.current.clientHeight;
        renderer.setSize(w, h, false);
        uniforms.uRes.value.set(w, h);
      });
      ro.observe(host);

      /* --- Boucle : l'horloge n'avance que pendant les frames rendues,
             l'animation ne « saute » donc pas après une pause. --- */
      let last = performance.now();
      let elapsed = 0;

      function frame(now: number) {
        if (!shouldRun()) {
          raf = 0;
          return;
        }
        elapsed += (now - last) / 1000;
        last = now;
        uniforms.uTime.value = elapsed;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      }

      function start() {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }

      start();

      cleanup = () => {
        if (raf) cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [enabled, intensity]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        // Dégradé statique : c'est ce que voient les appareils sans WebGL,
        // en mouvement réduit, et pendant le chargement de three.
        background:
          "radial-gradient(60% 80% at 25% 30%, color-mix(in srgb, var(--brand) 7%, transparent), transparent 70%)," +
          "radial-gradient(55% 75% at 78% 62%, rgba(91, 77, 238, 0.06), transparent 70%)",
      }}
    />
  );
}
