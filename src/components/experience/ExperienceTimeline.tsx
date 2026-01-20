import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface Experience {
  company: string;
  logo: string;
  logoColor: string;
  duration: string;
  location?: string;
  roles: {
    title: string;
    period: string;
    description?: string;
    bullets?: string[];
  }[];
}

const experiences: Experience[] = [
  {
    company: 'Uber',
    logo: 'U',
    logoColor: 'bg-zinc-950',
    duration: 'Full-time · 3 yrs 8 mos',
    location: 'Bengaluru, Karnataka, India',
    roles: [
      {
        title: 'Senior Software Engineer',
        period: 'Mar 2024 - Present · 1 yr 11 mos',
        description: 'Search Platform team',
      },
      {
        title: 'Software Engineer 2',
        period: 'Jun 2022 - Feb 2024 · 1 yr 9 mos',
      },
    ],
  },
  {
    company: 'Oracle',
    logo: 'O',
    logoColor: 'bg-red-600',
    duration: 'Full-time · 1 yr 7 mos',
    location: 'Nov 2020 - May 2022',
    roles: [
      {
        title: 'Software Engineer',
        bullets: [
          'Working as a backend developer for cloud service - Database Backups and Recovery Service (DBRS)',
          'Worked on achieving high availability of the service by adding replication support to DBRS. Also developed a service that helped transition load from one ZDLRA to another in case one goes down for some reason and is replaced by another.',
          'Developed internal and customer-facing APIs using the Dropwizard framework in Java.',
          'Increased the load handling capacity of the APIs by ~10 times by handling concurrency issues during multiple API requests by implementing Distributed Locking.',
          'Developed Terraform provider for DBRS service in Go language. Terraform relies on plugins called "Providers" to interact with the service\'s underlying APIs. This provider enabled automating the provisioning of resources for customers.',
          'Developed a framework using which we can simulate some of the dependencies of the service and could provision resources without needing the actual hardware dependencies. This cut down the operational costs by a lot and allowed us to create 1000s of mock resources if needed for testing and development.',
          'Developed a Synchronization service that runs in the background and keeps the data plane and control plane in sync. This service also does a lot of other activities that provide operators an insight into customer usage patterns.',
          'Changed the authorization model to create resources in customer tenancy from S2S to OBO token model.',
          'Technologies: Java, Microservices, Python, Go language, Terraform, Dropwizard framework for REST APIs.',
        ],
      },
    ],
  },
  {
    company: 'Zendrive',
    logo: 'Z',
    logoColor: 'bg-emerald-600',
    duration: 'Internship · 6 mos',
    location: 'Jan 2020 - Jun 2020 · Greater Bengaluru Area',
    roles: [
      {
        title: 'Software Engineer Intern',
        bullets: [
          "Created an internal API for the company to fetch user logs from Elasticsearch on the basis of the user's inputs.",
          "Added 3 new metrics to measure the performance of the company's SDK.",
          'Built a complete website (backend + frontend) for browsing user SDK logs for analysis. Used Vue.js as the framework.',
          'Tech used: Python, Elasticsearch, Flask, PySpark, Javascript, VueJS',
        ],
      },
    ],
  },
  {
    company: 'CSIR-CEERI',
    logo: 'CSIR',
    logoColor: 'bg-blue-600',
    duration: 'Internship · 3 mos',
    location: 'May 2018 - Jul 2018',
    roles: [
      {
        title: 'Machine Learning Intern',
        bullets: [
          '(Conference Paper published) Developed a program that detects cancerous cervix images with an accuracy of 96.67%.',
          'GLCM algorithm to extract features from the images and SVM classifier was used for classification.',
          'Modified the code to take video input, because of which the code can be used for real-time detection as well. Also added GUI for easier use.',
          'Tech Used: C++, OpenCV, MATLAB for validating some parameter computations.',
        ],
      },
    ],
  },
];

export default function ExperienceTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const timeline = timelineRef.current;
    if (!container || !timeline) return;

    const entries = entriesRef.current.filter(Boolean) as HTMLDivElement[];

    // Set initial states
    gsap.set(entries, { opacity: 0, x: -30 });
    gsap.set(timeline, { scaleY: 0, transformOrigin: 'top' });

    // Animate the timeline line drawing
    gsap.to(timeline, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: container,
        start: 'top 80%',
        end: 'bottom 20%',
        scrub: 1,
      },
    });

    // Animate each entry
    entries.forEach((entry, index) => {
      gsap.to(entry, {
        opacity: 1,
        x: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: entry,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });

      // Animate the dot
      const dot = entry.querySelector('.timeline-dot');
      if (dot) {
        gsap.fromTo(
          dot,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            ease: 'back.out(1.7)',
            scrollTrigger: {
              trigger: entry,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          }
        );
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Timeline line */}
      <div
        ref={timelineRef}
        className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-zinc-500 via-zinc-400 to-zinc-600"
      />

      <div className="space-y-8">
        {experiences.map((exp, index) => (
          <div
            key={exp.company}
            ref={(el) => {
              entriesRef.current[index] = el;
            }}
            className="relative pl-16"
          >
            {/* Timeline dot */}
            <div className="timeline-dot absolute left-4 top-4 w-5 h-5 rounded-full bg-zinc-400 border-4 border-[var(--bg-primary)] shadow-lg" />

            {/* Company header */}
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={`w-12 h-12 rounded-lg ${exp.logoColor} flex items-center justify-center flex-shrink-0`}
                >
                  <span className="text-zinc-50 font-bold text-sm">{exp.logo}</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)]">{exp.company}</h3>
                  <p className="text-[var(--text-muted)] text-sm">{exp.duration}</p>
                  {exp.location && <p className="text-[var(--text-muted)] text-sm">{exp.location}</p>}
                </div>
              </div>

              {/* Roles */}
              <div className="space-y-4 ml-2 border-l-2 border-zinc-600 pl-6">
                {exp.roles.map((role, roleIndex) => (
                  <div key={roleIndex} className="relative">
                    <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-zinc-500" />
                    <h4 className="font-medium text-[var(--text-primary)]">{role.title}</h4>
                    {role.period && <p className="text-[var(--text-muted)] text-sm">{role.period}</p>}
                    {role.description && (
                      <p className="text-[var(--text-secondary)] text-sm mt-1">{role.description}</p>
                    )}
                    {role.bullets && (
                      <ul className="text-[var(--text-secondary)] text-sm mt-2 space-y-2 list-disc list-inside">
                        {role.bullets.map((bullet, bulletIndex) => (
                          <li key={bulletIndex}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
