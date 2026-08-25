"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldCheck, Award } from "lucide-react";

const team = [
  {
    name: "Dr Slaviša Petković",
    role: "Specijalista oralne hirurgije",
    badge: "Oralna hirurgija & Implantologija",
    bio: "Specijalista oralne hirurgije sa fokusom na implantologiju, hirurške intervencije i precizno planiranje tretmana.",
    image: "/slavisa-petkovic.webp",
    icon: Award,
  },
  {
    name: "Dr Nebojša Kostić",
    role: "Doktor stomatologije",
    badge: "Opšta & Estetska stomatologija",
    bio: "Doktor stomatologije posvećen opštoj i estetskoj stomatologiji, protetici i pažljivom pristupu svakom pacijentu.",
    image: "/nebojsa-kostic.webp",
    icon: ShieldCheck,
  },
];

export default function AboutUs() {
  return (
    <section className="py-28 md:py-36 bg-secondary text-primary relative overflow-hidden">
      {/* Background subtle decorative gradients */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold text-sm mb-4"
          >
            <span>O NAMA</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-heading font-bold mb-6 tracking-tight"
          >
            Upoznajte naš stručni tim
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-primary/70 text-lg md:text-xl leading-relaxed"
          >
            Iskustvo, posvećenost i najsavremenije metode lečenja za vaš siguran i blistav osmeh.
          </motion.p>
        </div>

        {/* Team Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 max-w-5xl mx-auto">
          {team.map((member, idx) => {
            const Icon = member.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2, duration: 0.6 }}
                className="group relative bg-white rounded-3xl overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.09)] transition-all duration-300 flex flex-col"
              >
                {/* Top Image Container */}
                <div className="relative aspect-[4/4] sm:aspect-[4/4.2] overflow-hidden bg-slate-100">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 500px"
                    priority={idx === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />
                  
                  {/* Floating role pill on image */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-xs font-semibold text-primary shadow-md">
                      <Icon className="w-3.5 h-3.5 text-accent" />
                      {member.badge}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-heading font-bold text-primary mb-1">
                      {member.name}
                    </h3>
                    <p className="text-accent font-semibold text-sm sm:text-base mb-4">
                      {member.role}
                    </p>
                    <p className="text-primary/75 leading-relaxed text-base">
                      {member.bio}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
