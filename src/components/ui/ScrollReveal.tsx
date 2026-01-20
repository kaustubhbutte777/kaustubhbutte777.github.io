import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type AnimationType = 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scaleIn' | 'blur';

interface ScrollRevealProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

const animationStyles: Record<AnimationType, { initial: React.CSSProperties; visible: React.CSSProperties }> = {
  fadeUp: {
    initial: { opacity: 0, transform: 'translateY(40px)' },
    visible: { opacity: 1, transform: 'translateY(0)' },
  },
  fadeDown: {
    initial: { opacity: 0, transform: 'translateY(-40px)' },
    visible: { opacity: 1, transform: 'translateY(0)' },
  },
  fadeLeft: {
    initial: { opacity: 0, transform: 'translateX(-40px)' },
    visible: { opacity: 1, transform: 'translateX(0)' },
  },
  fadeRight: {
    initial: { opacity: 0, transform: 'translateX(40px)' },
    visible: { opacity: 1, transform: 'translateX(0)' },
  },
  scaleIn: {
    initial: { opacity: 0, transform: 'scale(0.9)' },
    visible: { opacity: 1, transform: 'scale(1)' },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(10px)' },
    visible: { opacity: 1, filter: 'blur(0px)' },
  },
};

export default function ScrollReveal({
  children,
  animation = 'fadeUp',
  delay = 0,
  duration = 0.6,
  className = '',
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [once]);

  const styles = animationStyles[animation];
  const currentStyle = isVisible ? styles.visible : styles.initial;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...currentStyle,
        transition: `all ${duration}s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s`,
        willChange: 'opacity, transform, filter',
      }}
    >
      {children}
    </div>
  );
}
