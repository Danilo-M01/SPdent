"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    question: "Da li je ugradnja implantata bolna?",
    answer: "Apsolutno ne. Koristimo lokalnu anesteziju vrhunskog kvaliteta. Sam proces ugradnje traje kraće od komplikovanog vađenja zuba, a postoperativni tok je obično bezbolan."
  },
  {
    question: "Koliko traju keramičke fasete (viniri)?",
    answer: "Uz pravilnu oralnu higijenu i redovne kontrole, premium E-max fasete koje koristimo mogu trajati između 10 i 15 godina, pa čak i doživotno."
  },
  {
    question: "Koje su cene pregleda i konsultacija?",
    answer: "Prvi pregled i plan terapije su transparentni i prilagođeni vašem budžetu. Detaljan cenovnik dobijate pre početka svake intervencije, bez skrivenih troškova."
  },
  {
    question: "Da li radite sa pacijentima koji imaju jak strah od zubara?",
    answer: "Da! To je naša specijalnost. Imamo poseban 'Anti-stres' protokol koji uključuje pre-medikaciju, opuštajući ambijent i postupno uvođenje u intervenciju."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-32 bg-white text-primary">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
            Česta pitanja
          </h2>
          <p className="text-primary/70">
            Sve što treba da znate pre vašeg prvog dolaska.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="border border-black/10 rounded-2xl overflow-hidden bg-secondary/30"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className="font-bold text-lg">{faq.question}</span>
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-accent shadow-sm shrink-0">
                    {isOpen ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-6 pb-6"
                    >
                      <p className="text-primary/70 leading-relaxed border-t border-black/5 pt-4">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
