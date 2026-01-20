import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Section {
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: Section[];
}

export default function SectionNav({ sections }: SectionNavProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '');

  useEffect(() => {
    // Track which sections are visible
    const visibleSections = new Set<string>();

    const updateActiveSection = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const clientHeight = window.innerHeight;

      // If near bottom of page, activate last section
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        setActiveSection(sections[sections.length - 1]?.id || '');
        return;
      }

      // Find the section that's most in view (closest to top of viewport)
      let closestSection = sections[0]?.id || '';
      let closestDistance = Infinity;

      sections.forEach((section) => {
        const element = document.getElementById(section.id);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top - 100); // Distance from 100px below top

        if (rect.top < clientHeight * 0.6 && rect.bottom > 100) {
          if (distance < closestDistance) {
            closestDistance = distance;
            closestSection = section.id;
          }
        }
      });

      setActiveSection(closestSection);
    };

    window.addEventListener('scroll', updateActiveSection, { passive: true });
    updateActiveSection(); // Initial call

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
    };
  }, [sections]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const navHeight = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: 'smooth',
      });
    }
  };

  return (
    <nav className="w-56">
      <div className="glass-strong rounded-2xl p-6">
        <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-6 px-3 font-semibold">
          Navigation
        </p>
        <div className="flex flex-col gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className="relative px-4 py-3 rounded-xl text-base font-medium transition-all text-left"
            >
              {activeSection === section.id && (
                <motion.div
                  layoutId="activeSectionSidebar"
                  className="absolute inset-0 bg-zinc-500/20 rounded-xl"
                  transition={{ type: 'spring', duration: 0.4 }}
                />
              )}
              <span
                className={`relative z-10 flex items-center gap-3 ${
                  activeSection === section.id
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full transition-colors ${
                    activeSection === section.id ? 'bg-zinc-400' : 'bg-zinc-600'
                  }`}
                />
                {section.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
