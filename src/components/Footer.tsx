import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-primary text-secondary pt-24 pb-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="text-2xl font-heading font-bold text-white tracking-tighter mb-6">
              SP<span className="text-accent">DENT</span>
            </div>
            <p className="text-secondary/70 max-w-sm">
              Moderna stomatološka ordinacija u srcu Beograda. Naša misija je da vratimo savršen osmeh na vaše lice, bez bola i bez stresa.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-white">Usluge</h4>
            <ul className="space-y-4 text-secondary/70">
              <li><Link href="/usluge/estetika" className="hover:text-accent transition-colors">Estetska stomatologija</Link></li>
              <li><Link href="/usluge/implantologija" className="hover:text-accent transition-colors">Implantologija</Link></li>
              <li><Link href="/usluge/hitno" className="hover:text-accent transition-colors">Hitne intervencije</Link></li>
              <li><a href="#usluge" className="hover:text-accent transition-colors">Opšta stomatologija</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-white">Radno Vreme</h4>
            <ul className="space-y-4 text-secondary/70">
              <li className="flex justify-between"><span>Pon - Pet:</span> <span>09:00 - 20:00</span></li>
              <li className="flex justify-between"><span>Subota:</span> <span>10:00 - 15:00</span></li>
              <li className="flex justify-between text-accent"><span>Nedelja:</span> <span>Zatvoreno</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-sm text-secondary/50">
          <p>&copy; {new Date().getFullYear()} SP DENT. Sva prava zadržana.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Politika privatnosti</a>
            <a href="#" className="hover:text-white transition-colors">Uslovi korišćenja</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
