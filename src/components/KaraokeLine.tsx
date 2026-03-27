import React from 'react';

interface KaraokeLineProps {
  lyric: string;
  spokenText: string;
  colorClass: string;
  animationClass: string;
  sizeClass?: string;
}

export default function KaraokeLine({ lyric, spokenText, colorClass, animationClass, sizeClass = "text-2xl" }: KaraokeLineProps) {
  const words = lyric.split(' ');
  const spokenWords = spokenText.toLowerCase().split(/\s+/);
  
  return (
    <p className={`${sizeClass} font-bold leading-relaxed`}>
      {words.map((word, i) => {
        const isSpoken = spokenWords.includes(word.toLowerCase().replace(/[.,!?;:]/g, ''));
        return (
          <span 
            key={i} 
            className={`mr-2 transition-all duration-300 ${isSpoken ? colorClass : 'text-gray-400 opacity-50'}`}
            style={{ 
              textShadow: isSpoken && animationClass === 'glow' ? '0 0 8px rgba(currentColor, 0.4)' : 'none'
            }}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
}
