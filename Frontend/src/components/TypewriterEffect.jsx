import { useState, useEffect } from 'react';

const TypewriterEffect = ({ text, speed = 50, className = '', darkMode = true }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed]);

  useEffect(() => {
    setDisplayText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <div className={className}>
      {displayText}
      {currentIndex < text.length && (
        <span className={`inline-block w-0.5 h-5 ml-1 animate-pulse ${
          darkMode ? 'bg-neon-blue' : 'bg-blue-500'
        }`}></span>
      )}
    </div>
  );
};

export default TypewriterEffect;