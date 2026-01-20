import React, { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type AnimationType = 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scaleIn' | 'blur';

interface ScrollAnimationProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  stagger?: number;
  once?: boolean;
}

const animationConfigs: Record<AnimationType, gsap.TweenVars> = {
  fadeUp: {
    from: { opacity: 0, y: 40 },
    to: { opacity: 1, y: 0 },
  },
  fadeDown: {
    from: { opacity: 0, y: -40 },
    to: { opacity: 1, y: 0 },
  },
  fadeLeft: {
    from: { opacity: 0, x: -40 },
    to: { opacity: 1, x: 0 },
  },
  fadeRight: {
    from: { opacity: 0, x: 40 },
    to: { opacity: 1, x: 0 },
  },
  scaleIn: {
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
  },
  blur: {
    from: { opacity: 0, filter: 'blur(10px)' },
    to: { opacity: 1, filter: 'blur(0px)' },
  },
};

export default function ScrollAnimation({
  children,
  animation = 'fadeUp',
  delay = 0,
  duration = 0.8,
  className = '',
  once = true,
}: ScrollAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const config = animationConfigs[animation];

    // Set initial state
    gsap.set(element, config.from);

    // Create scroll trigger animation
    const tween = gsap.to(element, {
      ...config.to,
      duration,
      delay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        end: 'bottom 15%',
        toggleActions: once ? 'play none none none' : 'play reverse play reverse',
      },
    });

    return () => {
      tween.kill();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.vars.trigger === element) {
          trigger.kill();
        }
      });
    };
  }, [animation, delay, duration, once]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// Staggered children animation component
interface StaggerAnimationProps {
  children: ReactNode;
  animation?: AnimationType;
  staggerDelay?: number;
  duration?: number;
  className?: string;
  childSelector?: string;
}

export function StaggerAnimation({
  children,
  animation = 'fadeUp',
  staggerDelay = 0.1,
  duration = 0.6,
  className = '',
  childSelector = ':scope > *',
}: StaggerAnimationProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const config = animationConfigs[animation];
    const childElements = element.querySelectorAll(childSelector);

    if (childElements.length === 0) return;

    // Set initial state for all children
    gsap.set(childElements, config.from);

    // Create scroll trigger animation with stagger
    const tween = gsap.to(childElements, {
      ...config.to,
      duration,
      stagger: staggerDelay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
      },
    });

    return () => {
      tween.kill();
    };
  }, [animation, staggerDelay, duration, childSelector]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
