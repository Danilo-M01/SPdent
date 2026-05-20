"use client";

import { useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { MoveHorizontal } from "lucide-react";

export default function BeforeAfter() {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  useEffect(() => {
    const setInitialPosition = () => {
      if (containerRef.current) {
        x.set(containerRef.current.offsetWidth / 2);
      }
    };

    setInitialPosition();
    window.addEventListener("resize", setInitialPosition);
    return () => window.removeEventListener("resize", setInitialPosition);
  }, [x]);

  // Dragging LEFT (x decreases) → "After/Posle" image is revealed more
  // Dragging RIGHT (x increases) → "Before/Pre" image is shown more
  // clipPath cuts the After layer: inset from the LEFT = x px
  const afterClipPath = useTransform(x, (value) => `inset(0 0 0 ${value}px)`);

  // "Pre" label is only visible in the Before region (right of handle)
  // Fade it out as the handle moves left (After takes over)
  const preOpacity = useTransform(x, [0, 200], [0, 1]);
  const posleOpacity = useTransform(x, [0, 200], [1, 0]);

  return (
    <section className="py-32 bg-white text-primary">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6">
            Rezultati koji govore više od reči
          </h2>
          <p className="text-primary/70 text-lg">
            Pogledajte neverovatne transformacije osmeha naših pacijenata.
          </p>
        </div>

        {/* Hint text */}
        <p className="text-center text-sm text-primary/40 mb-4 tracking-wide uppercase">
          ← Prevuci za poređenje →
        </p>

        <div
          ref={containerRef}
          className="relative w-full max-w-4xl mx-auto aspect-video rounded-3xl overflow-hidden shadow-2xl bg-secondary cursor-ew-resize group select-none"
        >
          {/* BEFORE Image — bottom layer (always visible) */}
          <img
            src="/before.jpg"
            alt="Pre tretmana"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />

          {/* AFTER Image — top layer, clipped from the left based on slider x */}
          <motion.div
            style={{ clipPath: afterClipPath }}
            className="absolute inset-0 z-10"
          >
            <img
              src="/after.png"
              alt="Posle tretmana"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          </motion.div>

          {/* Labels — fade based on slider position */}
          <motion.div
            style={{ opacity: posleOpacity }}
            className="absolute top-6 left-6 z-30 px-4 py-2 bg-accent text-primary rounded-full text-sm font-bold pointer-events-none"
          >
            Posle ✓
          </motion.div>
          <motion.div
            style={{ opacity: preOpacity }}
            className="absolute top-6 right-6 z-30 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white text-sm font-medium pointer-events-none"
          >
            Pre
          </motion.div>

          {/* Slider Handle */}
          <motion.div
            style={{ x }}
            drag="x"
            dragConstraints={containerRef}
            dragElastic={0}
            dragMomentum={false}
            className="absolute top-0 bottom-0 z-20 w-1 bg-white cursor-ew-resize flex items-center justify-center -ml-0.5"
          >
            <div className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <MoveHorizontal className="w-5 h-5" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
