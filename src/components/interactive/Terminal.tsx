import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalLine {
  type: 'command' | 'output' | 'error';
  content: string;
}

const commands: Record<string, string | string[]> = {
  help: [
    'Available commands:',
    '  help      - Show this help message',
    '  whoami    - About me',
    '  skills    - List my technical skills',
    '  projects  - Show recent projects',
    '  contact   - How to reach me',
    '  clear     - Clear the terminal',
    '  sudo hire-me - ???',
  ],
  whoami: [
    '┌──────────────────────────────────────┐',
    '│  Kaustubh Butte                      │',
    '│  Senior Software Engineer @ Uber     │',
    '│                                      │',
    '│  Passionate about:                   │',
    '│  • Distributed Systems               │',
    '│  • High-Performance Computing        │',
    '│  • Scalable Backend Services         │',
    '│  • Clean Code & Architecture         │',
    '└──────────────────────────────────────┘',
  ],
  skills: [
    'Languages:  Java, Go, Python',
    'Backend:    Kafka, PostgreSQL, Redis, gRPC',
    'Systems:    Distributed Systems, Microservices',
    'DevOps:     Docker, Kubernetes, AWS',
    'Tools:      Git, Linux, CI/CD',
  ],
  projects: [
    'Recent Projects:',
    '',
    '🚀 project-alpha - Distributed data pipeline',
    '💻 project-beta  - Full-stack web app',
    '🔧 project-gamma - CLI automation tool',
    '',
    'Run "open /projects" to see more!',
  ],
  contact: [
    '📧 Email:    kaustubhbutte@gmail.com',
    '🐙 GitHub:   github.com/kaustubhbutte777',
    '💼 LinkedIn: linkedin.com/in/kaustubh-butte',
    '🐦 Twitter:  @KaustubhButte',
  ],
  'sudo hire-me': [
    '',
    '  ╔══════════════════════════════════════╗',
    '  ║                                      ║',
    '  ║   🎉 ACCESS GRANTED! 🎉              ║',
    '  ║                                      ║',
    '  ║   I am available for:                ║',
    '  ║   • Full-time opportunities          ║',
    '  ║   • Contract work                    ║',
    '  ║   • Open source collaboration        ║',
    '  ║                                      ║',
    '  ║   Let\'s build something awesome!     ║',
    '  ║                                      ║',
    '  ╚══════════════════════════════════════╝',
    '',
  ],
};

export default function Terminal() {
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: 'output', content: 'Welcome to my terminal! Type "help" for available commands.' },
    { type: 'output', content: '' },
  ]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    const newHistory: TerminalLine[] = [
      ...history,
      { type: 'command', content: `$ ${cmd}` },
    ];

    if (trimmedCmd === 'clear') {
      setHistory([]);
      return;
    }

    if (trimmedCmd.startsWith('open ')) {
      const path = trimmedCmd.replace('open ', '');
      window.location.href = path;
      return;
    }

    const output = commands[trimmedCmd];
    if (output) {
      const lines = Array.isArray(output) ? output : [output];
      lines.forEach((line) => {
        newHistory.push({ type: 'output', content: line });
      });
    } else if (trimmedCmd) {
      newHistory.push({
        type: 'error',
        content: `Command not found: ${trimmedCmd}. Type "help" for available commands.`,
      });
    }

    setHistory(newHistory);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="glass-strong rounded-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-black/30 border-b border-white/10">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm text-gray-400 ml-2 font-mono">terminal@portfolio ~ </span>
        </div>

        {/* Terminal content */}
        <div
          ref={terminalRef}
          className="p-4 h-80 overflow-y-auto font-mono text-sm"
          onClick={() => inputRef.current?.focus()}
        >
          <AnimatePresence>
            {history.map((line, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`mb-1 ${
                  line.type === 'command'
                    ? 'text-green-400'
                    : line.type === 'error'
                    ? 'text-red-400'
                    : 'text-gray-300'
                }`}
              >
                {line.content || '\u00A0'}
              </motion.div>
            ))}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex items-center">
            <span className="text-green-400 mr-2">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-white caret-green-400"
              autoFocus
              spellCheck={false}
            />
            <span className="w-2 h-5 bg-green-400 animate-pulse"></span>
          </form>
        </div>
      </div>

      <p className="text-center text-gray-500 text-sm mt-4">
        Try typing <code className="text-indigo-400">help</code> to get started
      </p>
    </motion.div>
  );
}
