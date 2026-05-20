"use client";

import { motion } from "framer-motion";
import { Stethoscope, Sparkles, Syringe, Activity } from "lucide-react";

const services = [
  {
    icon: <Sparkles className="w-8 h-8" />,
    title: "Estetska Stomatologija",
    desc: "Savršen osmeh kroz premium fasete, beljenje i korekcije oblika."
  },
  {
    icon: <Activity className="w-8 h-8" />,
    title: "Implantologija",
    desc: "Trajna i pouzdana rešenja za nedostajuće zube uz 3D planiranje."
  },
  {
    icon: <Syringe className="w-8 h-8" />,
    title: "Bezbolno Vađenje",
    desc: "Hirurški i rutinski zahvati sa maksimalnim fokusom na komfor pacijenta."
  },
  {
    icon: <Stethoscope className="w-8 h-8" />,
    title: "Opšta Stomatologija",
    desc: "Precizna dijagnostika i lečenje karijesa modernim materijalima."
  }
];

export default function Services() {
  return (
    <section className="py-32 bg-primary text-secondary relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-heading font-bold mb-6"
          >
            Sve što je vašem <br/> osmehu potrebno
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-secondary/70 text-lg"
          >
            Koristimo isključivo najkvalitetnije materijale i svetski priznate protokole lečenja.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              whileHover={{ y: -10 }}
              className="group relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-accent/20 text-accent flex items-center justify-center mb-6">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                <p className="text-secondary/70 leading-relaxed">
                  {service.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
