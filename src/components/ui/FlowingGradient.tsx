import React from 'react';

interface FlowingGradientProps {
  className?: string;
}

export default function FlowingGradient({ className = '' }: FlowingGradientProps) {
  return (
    <div className={`flowing-gradient-container ${className}`}>
      {/* Primary gradient blob */}
      <div className="gradient-blob gradient-blob-1" />
      {/* Secondary gradient blob */}
      <div className="gradient-blob gradient-blob-2" />
      {/* Tertiary gradient blob */}
      <div className="gradient-blob gradient-blob-3" />
      {/* Overlay for smoothness */}
      <div className="gradient-overlay" />

      <style>{`
        .flowing-gradient-container {
          position: fixed;
          inset: 0;
          z-index: -2;
          overflow: hidden;
          pointer-events: none;
        }

        .gradient-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.5;
          mix-blend-mode: normal;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }

        /* Light mode colors - subtle grays */
        .gradient-blob-1 {
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, #d4d4d8 0%, #a1a1aa 50%, transparent 70%);
          top: -250px;
          left: -150px;
          animation: float1 20s ease-in-out infinite alternate;
        }

        .gradient-blob-2 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, #e4e4e7 0%, #d4d4d8 50%, transparent 70%);
          top: 40%;
          right: -200px;
          animation: float2 25s ease-in-out infinite alternate;
        }

        .gradient-blob-3 {
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, #a1a1aa 0%, #71717a 50%, transparent 70%);
          bottom: -200px;
          left: 25%;
          animation: float3 22s ease-in-out infinite alternate;
        }

        /* Dark mode colors - more visible gradient blobs */
        [data-theme="dark"] .gradient-blob-1 {
          background: radial-gradient(circle, #3f3f46 0%, #27272a 40%, transparent 70%);
          opacity: 0.8;
        }

        [data-theme="dark"] .gradient-blob-2 {
          background: radial-gradient(circle, #52525b 0%, #3f3f46 40%, transparent 70%);
          opacity: 0.7;
        }

        [data-theme="dark"] .gradient-blob-3 {
          background: radial-gradient(circle, #71717a 0%, #52525b 40%, transparent 70%);
          opacity: 0.6;
        }

        .gradient-overlay {
          position: absolute;
          inset: 0;
          background: transparent;
        }

        @keyframes float1 {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            transform: translate(100px, 50px) rotate(45deg) scale(1.1);
          }
          66% {
            transform: translate(50px, 100px) rotate(90deg) scale(0.95);
          }
          100% {
            transform: translate(150px, 80px) rotate(180deg) scale(1.05);
          }
        }

        @keyframes float2 {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            transform: translate(-80px, 60px) rotate(-30deg) scale(1.15);
          }
          66% {
            transform: translate(-120px, -40px) rotate(-60deg) scale(0.9);
          }
          100% {
            transform: translate(-60px, 100px) rotate(-90deg) scale(1.1);
          }
        }

        @keyframes float3 {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            transform: translate(60px, -80px) rotate(60deg) scale(1.2);
          }
          66% {
            transform: translate(-40px, -60px) rotate(120deg) scale(0.85);
          }
          100% {
            transform: translate(80px, -100px) rotate(180deg) scale(1.1);
          }
        }

        /* Reduce motion for accessibility */
        @media (prefers-reduced-motion: reduce) {
          .gradient-blob {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
