"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const reviews = [
  {
    name: "Marko R.",
    text: "Neverovatan pristup! Prvi put u životu sam otišao kod zubara bez straha. Estetika faseta je savršena, izgledaju potpuno prirodno.",
    role: "Pacijent"
  },
  {
    name: "Jelena M.",
    text: "Ambijent klinike je kao iz Apple radnje. Apsolutno bezbolno iskustvo i vrhunski tim stručnjaka. Sve preporuke za SP DENT.",
    role: "Pacijent"
  },
  {
    name: "Nikola S.",
    text: "Radio sam implantate i ceo proces je bio brz, jasan i bez ikakvih komplikacija. Oduševljen sam profesionalnošću.",
    role: "Pacijent"
  }
];

export default function Testimonials() {
  return (
    <section className="py-32 bg-primary text-secondary overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
            Najlepše o nama govore naši pacijenti.
          </h2>
          <p className="text-secondary/70">
            Više od 1000 zadovoljnih osmeha u Beogradu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((review, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2, duration: 0.6 }}
              className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <div className="flex gap-1 mb-6 text-accent">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>
              <p className="text-lg leading-relaxed mb-6">&ldquo;{review.text}&rdquo;</p>
              <div>
                <p className="font-bold">{review.name}</p>
                <p className="text-sm text-secondary/50">{review.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
