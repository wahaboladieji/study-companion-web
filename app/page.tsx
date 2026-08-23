"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { BookOpen, GraduationCap, LayoutDashboard, Menu, X } from "lucide-react";

type PageState = 'home' | 'testimonials' | 'contact';

export default function MarketingPage() {
  const [activePage, setActivePage] = useState<PageState>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const titles: Record<PageState, string> = {
      home: "AI Study Companion",
      testimonials: "Testimonials | AI Study Companion",
      contact: "Contact Us | AI Study Companion"
    };
    document.title = titles[activePage];
  }, [activePage]);

  const handleNavClick = (page: PageState) => (e: React.MouseEvent) => {
    e.preventDefault();
    setActivePage(page);
    window.history.pushState(null, '', `/#${page === 'home' ? '' : page}`);
  };

  return (
    <div className={`flex flex-col bg-surface ${activePage === 'home' ? 'min-h-screen' : 'h-screen'}`}>
      <header className="relative px-[var(--spacing-400)] md:px-[72px] h-16 flex items-center justify-between shrink-0 bg-surface z-50">
        <Link href="/" className="flex items-center justify-center cursor-pointer rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface" onClick={handleNavClick('home')}>
          <Image src="/icon.svg" alt="" width={24} height={24} />
          <span className="ml-[var(--spacing-150)] text-title-medium text-on-surface">
            AI Study Companion
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden md:flex gap-[var(--spacing-200)] sm:gap-[var(--spacing-400)] items-center absolute left-1/2 -translate-x-1/2">
          <Link 
            href="/#testimonials"
            className={`text-body-medium cursor-pointer transition-colors duration-1000 px-3 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${activePage === 'testimonials' ? 'text-primary' : 'text-on-surface hover:text-primary'}`} 
            onClick={handleNavClick('testimonials')}
            aria-current={activePage === 'testimonials' ? 'page' : undefined}
          >
            Testimonials
          </Link>
          <Link 
            href="/#contact"
            className={`text-body-medium cursor-pointer transition-colors duration-1000 px-3 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${activePage === 'contact' ? 'text-primary' : 'text-on-surface hover:text-primary'}`} 
            onClick={handleNavClick('contact')}
            aria-current={activePage === 'contact' ? 'page' : undefined}
          >
            Contact
          </Link>
        </nav>
        <div className="hidden md:flex items-center gap-[var(--spacing-100)]">
          <Link href="/auth?mode=signin">
            <Button variant="ghost" className="text-body-medium">Sign In</Button>
          </Link>
          <Link href="/auth?mode=signup">
            <Button variant="primary" className="text-label-large">Get Started</Button>
          </Link>
        </div>
        
        <button 
          className="md:hidden p-2 -mr-2 text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle mobile menu"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-surface border-b border-outline p-[var(--spacing-400)] flex flex-col gap-[var(--spacing-400)] z-40 shadow-medium">
          <nav aria-label="Primary" className="flex flex-col gap-[var(--spacing-200)]">
            <Link 
              href="/#testimonials"
              className={`text-body-medium cursor-pointer transition-colors px-3 py-2 rounded-md ${activePage === 'testimonials' ? 'bg-surface-variant text-primary' : 'text-on-surface hover:bg-surface-variant'}`} 
              onClick={(e) => { handleNavClick('testimonials')(e); setIsMobileMenuOpen(false); }}
              aria-current={activePage === 'testimonials' ? 'page' : undefined}
            >
              Testimonials
            </Link>
            <Link 
              href="/#contact"
              className={`text-body-medium cursor-pointer transition-colors px-3 py-2 rounded-md ${activePage === 'contact' ? 'bg-surface-variant text-primary' : 'text-on-surface hover:bg-surface-variant'}`} 
              onClick={(e) => { handleNavClick('contact')(e); setIsMobileMenuOpen(false); }}
              aria-current={activePage === 'contact' ? 'page' : undefined}
            >
              Contact
            </Link>
          </nav>
          <div className="flex flex-col gap-[var(--spacing-200)] pt-[var(--spacing-400)] border-t border-outline">
            <Link href="/auth?mode=signin" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
              <Button variant="ghost" className="w-full justify-center text-body-medium">Sign In</Button>
            </Link>
            <Link href="/auth?mode=signup" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
              <Button variant="primary" className="w-full justify-center text-label-large">Get Started</Button>
            </Link>
          </div>
        </div>
      )}

      {activePage === 'home' && (
        <main className="flex-1">
          <section className="w-full py-20 lg:py-32 xl:py-48 flex items-center justify-center text-center">
            <div className="px-[var(--spacing-400)] md:px-[72px] space-y-[var(--spacing-200)] max-w-4xl mx-auto">
              <h1 className="text-display-large leading-[1.15] text-on-surface">
                Supercharge your study sessions with AI.
              </h1>
              <p className="mx-auto max-w-[700px] text-body-large text-[var(--primitive-colors-neutral-color-palette-neutral50)]">
                Upload your course materials and let our AI generate comprehensive study notes and smart flashcards instantly.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-[var(--spacing-150)] pt-[var(--spacing-200)] w-full">
                <Link href="/auth?mode=signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto">Start For Free</Button>
                </Link>
              </div>
            </div>
          </section>

          <section id="features" className="w-full py-20 bg-surface-lowest">
            <div className="px-[var(--spacing-400)] md:px-[72px] max-w-6xl mx-auto">
              <h2 className="text-headline-large text-center mb-[var(--spacing-400)] text-on-surface">Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--spacing-400)]">
                <div className="flex flex-col items-center text-center space-y-[var(--spacing-100)] p-[var(--spacing-400)] bg-surface border border-outline rounded-xl shadow-soft">
                  <BookOpen className="h-10 w-10 text-primary mb-[var(--spacing-100)]" />
                  <h3 className="text-title-large text-on-surface">AI Study Notes</h3>
                  <p className="text-body-medium text-on-surface-variant">Turn long lectures and PDFs into concise, easy-to-read study guides in seconds.</p>
                </div>
                <div className="flex flex-col items-center text-center space-y-[var(--spacing-100)] p-[var(--spacing-400)] bg-surface border border-outline rounded-xl shadow-soft">
                  <LayoutDashboard className="h-10 w-10 text-primary mb-[var(--spacing-100)]" />
                  <h3 className="text-title-large text-on-surface">Smart Flashcards</h3>
                  <p className="text-body-medium text-on-surface-variant">Automatically generated Q&A flashcards based on your actual course materials.</p>
                </div>
                <div className="flex flex-col items-center text-center space-y-[var(--spacing-100)] p-[var(--spacing-400)] bg-surface border border-outline rounded-xl shadow-soft">
                  <GraduationCap className="h-10 w-10 text-primary mb-[var(--spacing-100)]" />
                  <h3 className="text-title-large text-on-surface">Ace Your Exams</h3>
                  <p className="text-body-medium text-on-surface-variant">Review more efficiently, retain more information, and improve your grades effortlessly.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {activePage === 'testimonials' && (
        <main className="flex-1 flex flex-col items-center justify-center px-[var(--spacing-400)] md:px-[72px] text-center">
          <div className="max-w-3xl space-y-[var(--spacing-300)]">
            <h1 className="text-display-small text-on-surface">
              What our students say
            </h1>
            <p className="text-body-large text-on-surface-variant">
              &quot;AI Study Companion has completely transformed how I prepare for exams. The flashcards are incredibly accurate!&quot;
            </p>
            <p className="text-label-medium text-on-surface">— Sarah, Computer Science Student</p>
          </div>
        </main>
      )}

      {activePage === 'contact' && (
        <main className="flex-1 flex flex-col items-center justify-center px-[var(--spacing-400)] md:px-[72px]">
          <div className="w-full max-w-[400px] space-y-[var(--spacing-400)] rounded-xl border border-outline bg-surface p-[var(--spacing-400)] sm:p-[var(--spacing-600)] shadow-medium">
            <div className="flex flex-col space-y-[var(--spacing-100)] text-center">
              <h1 className="text-headline-small text-on-surface">Contact Us</h1>
              <p className="text-body-medium text-on-surface-variant">We&apos;d love to hear from you.</p>
            </div>
            <form className="space-y-[var(--spacing-300)]" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-[var(--spacing-100)]">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required placeholder="hello@example.com" />
              </div>
              <div className="space-y-[var(--spacing-100)]">
                <Label htmlFor="message">Message</Label>
                <textarea 
                  id="message" 
                  rows={4}
                  required 
                  placeholder="How can we help?"
                  className="flex w-full rounded-md border border-outline bg-surface px-3 py-2 text-body-medium text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button type="submit" className="w-full">
                Send Message
              </Button>
            </form>
          </div>
        </main>
      )}

      {activePage === 'home' && (
        <footer className="flex flex-col gap-[var(--spacing-100)] sm:flex-row py-[var(--spacing-400)] w-full shrink-0 items-center px-[var(--spacing-400)] md:px-[72px] border-t border-outline">
          <p className="text-body-small text-on-surface-variant">© 2026 AI Study Companion. All rights reserved.</p>
          <nav aria-label="Footer" className="sm:ml-auto flex gap-[var(--spacing-400)] sm:gap-[var(--spacing-600)]">
            <Link className="text-label-small hover:underline underline-offset-4 text-on-surface-variant" href="#">
              Terms of Service
            </Link>
            <Link className="text-label-small hover:underline underline-offset-4 text-on-surface-variant" href="#">
              Privacy
            </Link>
          </nav>
        </footer>
      )}
    </div>
  );
}
