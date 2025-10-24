import { useEffect, useState } from 'react';

interface WaitingOverlayProps {
  isWaiting: boolean;
}

export default function WaitingOverlay({ isWaiting }: WaitingOverlayProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isWaiting) {
      setSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isWaiting]);

  if (!isWaiting) return null;

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[9999] transition-opacity duration-400"
      style={{
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(8px)'
      }}
      data-testid="waiting-overlay"
    >
      <div 
        className="text-center px-12 md:px-20 py-10 rounded-2xl"
        style={{
          color: '#b5ffb5',
          background: 'rgba(25, 40, 25, 0.8)',
          border: '2px solid #00ff99',
          boxShadow: '0 0 20px #00ff99',
          animation: 'pulseGlow 2s infinite alternate'
        }}
      >
        <div 
          className="w-12 h-12 md:w-14 md:h-14 mx-auto mb-5 rounded-full"
          style={{
            border: '6px solid rgba(255, 255, 255, 0.1)',
            borderTop: '6px solid #00ff99',
            animation: 'spin 1s linear infinite'
          }}
          data-testid="waiting-spinner"
        />
        <p className="text-xl md:text-2xl font-sans mb-2" data-testid="waiting-text">
          Waiting for Opponent...
        </p>
        <p className="text-lg md:text-xl font-sans" data-testid="waiting-timer">
          {mins}:{secs} elapsed
        </p>
      </div>
    </div>
  );
}
