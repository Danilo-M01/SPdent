"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-primary text-secondary">
      {/* Background Image / Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=2574&auto=format&fit=crop"
          alt="Premium Dental Clinic"
          className="object-cover w-full h-full opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/50 to-primary"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 flex flex-col items-center text-center">

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold tracking-tight mb-4 leading-tight"
        >
          Zašto se naši pacijenti prvi put raduju odlasku kod zubara?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl md:text-2xl font-semibold max-w-2xl text-transparent bg-clip-text bg-gradient-to-r from-accent to-white mb-4"
        >
          Jer smo uklonili stres, bol i nesigurnost iz stomatologije.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl max-w-2xl text-secondary/80 mb-10"
        >
          Ostalo je samo vrhunsko iskustvo i osmeh kojim ćete biti ponosni.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <a href="#kontakt" className="px-8 py-4 bg-accent text-primary font-bold rounded-full text-lg hover:bg-white transition-colors flex items-center gap-2">
            Kontaktirajte nas <ArrowRight className="w-5 h-5" />
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-sm font-medium text-secondary/60 uppercase tracking-widest">Scroll</span>
        <div className="w-[1px] h-12 bg-secondary/20 overflow-hidden relative">
          <motion.div
            animate={{ y: [0, 48, 48] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-full h-1/2 bg-accent absolute top-0"
          />
        </div>
      </motion.div>
    </section>
  );
}
