import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlowButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'glass';
  className?: string;
}

export default function GlowButton({
  children,
  href,
  onClick,
  variant = 'primary',
  className = '',
}: GlowButtonProps) {
  const baseStyles = variant === 'primary' ? 'btn-primary' : 'btn-glass';

  const buttonContent = (
    <motion.span
      className={`inline-flex items-center gap-2 ${baseStyles} ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.span>
  );

  if (href) {
    return (
      <a href={href} className="inline-block">
        {buttonContent}
      </a>
    );
  }

  return (
    <button onClick={onClick} className="inline-block">
      {buttonContent}
    </button>
  );
}
