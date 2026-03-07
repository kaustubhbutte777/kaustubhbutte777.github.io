import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface WhoAmIProps {
  name?: string;
  title?: string;
}

export default function WhoAmI({ name = "Kaustubh Butte", title = "Senior Software Engineer @ Uber" }: WhoAmIProps) {
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [typingComplete, setTypingComplete] = useState(false);

  const fullText = name;

  useEffect(() => {
    let index = 0;
    const typingInterval = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(typingInterval);
        setTypingComplete(true);
      }
    }, 80);

    return () => clearInterval(typingInterval);
  }, [fullText]);

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <div className="font-mono text-sm md:text-base">
      <div className="flex items-center gap-2 text-zinc-500 mb-1">
        <span className="text-emerald-500">~</span>
        <span className="text-zinc-400">$</span>
        <span className="text-zinc-300">whoami</span>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pl-4"
      >
        <span className="text-[var(--text-primary)] text-lg md:text-xl font-semibold">
          {displayText}
          <span
            className={`inline-block w-2 h-5 ml-1 bg-emerald-500 ${
              showCursor ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-100`}
            style={{ verticalAlign: 'text-bottom' }}
          />
        </span>
      </motion.div>
      {typingComplete && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pl-4 mt-1 text-[var(--text-secondary)]"
        >
          {title}
        </motion.div>
      )}
    </div>
  );
}
