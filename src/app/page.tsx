import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProblemSolution from "@/components/ProblemSolution";
import Services from "@/components/Services";
import BeforeAfter from "@/components/BeforeAfter";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <div id="početna"><Hero /></div>
      {/* On mobile: BeforeAfter first, then ProblemSolution. On desktop: original order */}
      <div className="flex flex-col">
        <div className="order-2 lg:order-1"><ProblemSolution /></div>
        <div id="rezultati" className="order-1 lg:order-2"><BeforeAfter /></div>
      </div>
      <div id="usluge"><Services /></div>
      <div id="o nama"><Testimonials /></div>
      <FAQ />
      <Contact />
      <Footer />
    </main>
  );
}
