"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin, Phone, Mail } from "lucide-react";

export default function Contact() {
  return (
    <section className="py-32 bg-secondary text-primary relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          {/* Info Side */}
          <div>
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

            <div className="space-y-6">
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

          {/* Form Side */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-black/5"
          >
            <h3 className="text-2xl font-bold mb-8">Zakaži termin online</h3>
            <form className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary/80">Ime i prezime</label>
                <input type="text" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent transition-all" placeholder="Petar Petrović" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary/80">Telefon</label>
                <input type="tel" className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent transition-all" placeholder="+381 6..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary/80">Usluga</label>
                <select className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-black/10 focus:outline-none focus:ring-2 focus:ring-accent transition-all">
                  <option>Pregled i konsultacije</option>
                  <option>Estetska stomatologija</option>
                  <option>Implantologija</option>
                  <option>Bol / Hitno</option>
                </select>
              </div>
              <button className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 group">
                Pošalji zahtev <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-xs text-center text-primary/50 mt-4">
                Vaši podaci su sigurni. Kontaktiraćemo vas u roku od 15 minuta.
              </p>
            </form>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
