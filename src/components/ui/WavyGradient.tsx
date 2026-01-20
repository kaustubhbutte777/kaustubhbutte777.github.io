import React, { useEffect, useRef } from 'react';

interface WavyGradientProps {
  className?: string;
}

export default function WavyGradient({ className = '' }: WavyGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    resize();
    window.addEventListener('resize', resize);

    // Wave parameters - very slow, subtle movement
    const waves = [
      { amplitude: 50, frequency: 0.0015, speed: 0.00002, phase: 0, yOffset: 0.15 },
      { amplitude: 40, frequency: 0.002, speed: 0.000015, phase: 1.5, yOffset: 0.35 },
      { amplitude: 60, frequency: 0.0012, speed: 0.000025, phase: 3, yOffset: 0.55 },
      { amplitude: 45, frequency: 0.0018, speed: 0.00002, phase: 4.5, yOffset: 0.75 },
      { amplitude: 35, frequency: 0.002, speed: 0.000018, phase: 2, yOffset: 0.9 },
    ];

    // Get theme colors
    const getColors = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (isDark) {
        return {
          bg: '#09090b',
          colors: [
            'rgba(39, 39, 42, 0.6)',    // zinc-800
            'rgba(63, 63, 70, 0.5)',    // zinc-700
            'rgba(82, 82, 91, 0.45)',   // zinc-600
            'rgba(113, 113, 122, 0.4)', // zinc-500
            'rgba(161, 161, 170, 0.35)', // zinc-400
          ],
        };
      } else {
        return {
          bg: '#ffffff',
          colors: [
            'rgba(244, 244, 245, 0.7)', // zinc-100
            'rgba(228, 228, 231, 0.6)', // zinc-200
            'rgba(212, 212, 216, 0.5)', // zinc-300
            'rgba(161, 161, 170, 0.45)', // zinc-400
            'rgba(113, 113, 122, 0.4)', // zinc-500
          ],
        };
      }
    };

    let time = 0;

    const animate = () => {
      const { bg, colors } = getColors();

      // Clear with background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Draw each wave layer
      waves.forEach((wave, index) => {
        ctx.beginPath();
        ctx.moveTo(0, height);

        // Draw the wave path
        for (let x = 0; x <= width; x += 5) {
          const y =
            height * wave.yOffset +
            Math.sin(x * wave.frequency + time * wave.speed * 1000 + wave.phase) * wave.amplitude +
            Math.sin(x * wave.frequency * 0.5 + time * wave.speed * 500 + wave.phase * 2) * wave.amplitude * 0.5;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        // Complete the shape
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        // Create gradient fill
        const gradient = ctx.createLinearGradient(0, height * wave.yOffset - wave.amplitude, 0, height);
        gradient.addColorStop(0, colors[index]);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fill();
      });

      time += 16; // ~60fps
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    // Listen for theme changes
    const observer = new MutationObserver(() => {
      // Theme changed, colors will update on next frame
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 pointer-events-none ${className}`}
      style={{ opacity: 0.7 }}
    />
  );
}
