"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";

export default function ProblemSolution() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Na mobilnom smanjujemo opseg pokreta na ±30px umesto ±100px
  // da animacija bude glatka i bez seckanja
  const mobileRange = 30;
  const desktopRange = 80;
  const range = isMobile ? mobileRange : desktopRange;

  const y1 = useTransform(scrollYProgress, [0, 1], [range, -range]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-range, range]);

  return (
    <section ref={containerRef} className="py-24 md:py-32 bg-secondary text-primary overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        
        {/* Left Side: Storytelling Text */}
        <div className="space-y-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Većina ljudi odlaže zubara zbog straha...
            </h2>
            <p className="text-lg text-primary/70">
              ...što kasnije dovodi do većih problema. Loša prošla iskustva i estetska nesigurnost 
              često su najveća prepreka do savršenog osmeha.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="p-8 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-primary/5"
          >
            <h3 className="text-2xl font-bold mb-3 text-accent">Naše rešenje</h3>
            <p className="text-primary/80">
              SP DENT koristi modernu, potpuno bezbolnu tehnologiju u opuštajućem ambijentu. 
              Garantujemo transparentne cene, profesionalan pristup i vrhunske rezultate na koje ćete biti ponosni.
            </p>
          </motion.div>
        </div>

        {/* Right Side: Parallax Images */}
        <div className="relative h-[340px] sm:h-[420px] md:h-[560px] w-full mt-4 lg:mt-0">
          {/* Gornja slika — pomera se ka gore pri skrolovanju */}
          <motion.div
            style={{ y: y1, willChange: "transform" }}
            className="absolute top-0 right-0 w-[65%] h-[65%] rounded-3xl overflow-hidden shadow-2xl"
          >
            <img
              src="/ps-image1.jpg"
              alt="Pacijentkinja stavlja navlaku na zube"
              className="object-cover w-full h-full"
              loading="lazy"
            />
          </motion.div>

          {/* Donja slika — pomera se ka dole pri skrolovanju */}
          <motion.div
            style={{ y: y2, willChange: "transform" }}
            className="absolute bottom-0 left-0 w-[65%] h-[65%] rounded-3xl overflow-hidden shadow-2xl z-10 border-4 border-secondary"
          >
            <img
              src="/ps-image2.jpg"
              alt="Rezultat nošenja ortodontske navlake"
              className="object-cover w-full h-full"
              loading="lazy"
            />
          </motion.div>
        </div>

      </div>
    </section>
  );
}
