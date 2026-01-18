import { motion } from 'framer-motion';
import HeroScene from './3d/HeroScene';
import AnimatedText from './ui/AnimatedText';
import GlowButton from './ui/GlowButton';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <HeroScene />

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <span className="inline-block px-4 py-2 rounded-full glass text-sm text-gray-300 mb-8">
            Welcome to my corner of the internet
          </span>
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <AnimatedText
            text="Hi, I'm"
            className="block text-white"
          />
          <AnimatedText
            text="Kaustubh Butte"
            className="block"
            gradient
            delay={0}
          />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-xl md:text-2xl text-gray-400 mb-8 max-w-2xl mx-auto"
        >
          Senior Software Engineer passionate about building scalable systems.
          <br />
          Currently crafting distributed systems at Uber.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <GlowButton href="/projects" variant="primary">
            View Projects
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </GlowButton>

          <GlowButton href="/blog" variant="glass">
            Read Blog
          </GlowButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-16 flex items-center justify-center gap-8 text-gray-500"
        >
          <div className="text-center">
            <div className="text-3xl font-bold gradient-text">6+</div>
            <div className="text-sm">Years Experience</div>
          </div>
          <div className="w-px h-12 bg-gray-700"></div>
          <div className="text-center">
            <div className="text-3xl font-bold gradient-text">Java</div>
            <div className="text-sm">& Go</div>
          </div>
          <div className="w-px h-12 bg-gray-700"></div>
          <div className="text-center">
            <div className="text-3xl font-bold gradient-text">Uber</div>
            <div className="text-sm">Current</div>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-gray-600 flex items-start justify-center p-2"
        >
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-2 bg-gray-400 rounded-full"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
