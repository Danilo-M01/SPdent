import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Contact from "@/components/Contact";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const serviceData: Record<string, { title: string, desc: string }> = {
  estetika: {
    title: "Estetska Stomatologija",
    desc: "Vrhunski materijali i najsavremenije tehnike za osmeh koji oduzima dah. Bilo da su u pitanju keramičke fasete, beljenje zuba ili kompletna transformacija osmeha (Smile Makeover), garantujemo vrhunske rezultate."
  },
  implantologija: {
    title: "Implantologija",
    desc: "Trajno i pouzdano rešenje za nedostajuće zube. Naši implantati su od premium švajcarskih i nemačkih proizvođača. Uz 3D planiranje, ugradnja je brza, precizna i potpuno bezbolna."
  },
  hitno: {
    title: "Hitne Intervencije",
    desc: "Imate jak bol, otok ili traumu zuba? Naš tim je spreman da reaguje odmah. Bez čekanja, sa efikasnim rešavanjem bola i prioritetnim prijemom."
  }
};

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const data = serviceData[resolvedParams.slug] || {
    title: "Usluga",
    desc: "Informacije o usluzi uskoro..."
  };

  return (
    <main className="min-h-screen bg-secondary text-primary">
      <Navbar />
      
      <section className="pt-48 pb-24 px-6 lg:px-8 max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-primary/60 hover:text-accent font-medium mb-8 transition-colors">
          <ArrowLeft className="w-5 h-5" /> Nazad na početnu
        </Link>
        <h1 className="text-4xl md:text-6xl font-heading font-bold mb-8">
          {data.title}
        </h1>
        <p className="text-xl text-primary/80 leading-relaxed mb-12">
          {data.desc}
        </p>
      </section>

      <Contact />
      <Footer />
    </main>
  );
}
