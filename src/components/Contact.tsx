"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin, Phone, Mail } from "lucide-react";

export default function Contact() {
  return (
    <section id="kontakt" className="py-32 bg-secondary text-primary relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div>
          {/* Info Side */}
          <motion.h2 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-heading font-bold mb-6"
          >
            Vaš novi osmeh <br/> <span className="text-accent">počinje ovde.</span>
          </motion.h2>
          <p className="text-lg text-primary/70 mb-12">
            Zakažite konsultacije i saznajte kako možemo da transformišemo vaš osmeh. Bez obaveza, u prijatnom okruženju.
          </p>

          <div className="space-y-6 max-w-md">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-black/5">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-primary/60 font-medium">Lokacija</p>
                <p className="font-bold">Bulevar Oslobođenja 123, Beograd</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-black/5">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-primary/60 font-medium">Telefon (WhatsApp / Viber)</p>
                <p className="font-bold">+381 60 123 4567</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow-sm border border-black/5">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-primary/60 font-medium">Email</p>
                <p className="font-bold">info@spdent.rs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
