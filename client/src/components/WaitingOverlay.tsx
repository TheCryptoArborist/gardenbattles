import { useEffect, useState } from 'react';

interface WaitingOverlayProps {
  isWaiting: boolean;
  onLeaveQueue?: () => Promise<any>;
  autoTriggerRefund?: boolean;
}

export default function WaitingOverlay({ isWaiting, onLeaveQueue, autoTriggerRefund }: WaitingOverlayProps) {
  const [seconds, setSeconds] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (!isWaiting) {
      setSeconds(0);
      setAutoTriggered(false);
      return;
    }

    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isWaiting]);

  // Auto-trigger refund on first mount (forced refund)
  useEffect(() => {
    if (isWaiting && autoTriggerRefund && !autoTriggered && onLeaveQueue) {
      console.log('🔥 AUTO-TRIGGERING REFUND (forced)...');
      setAutoTriggered(true);
      handleLeaveQueue();
    }
  }, [isWaiting, autoTriggerRefund, autoTriggered]);

  const handleLeaveQueue = async () => {
    if (!onLeaveQueue || isLeaving) return;

    setIsLeaving(true);
    try {
      await onLeaveQueue();
      console.log('✅ Successfully left queue and received refund!');
    } catch (error: any) {
      console.error('❌ Failed to leave queue:', error);
      alert(`Failed to leave queue: ${error.message}`);
      setIsLeaving(false);
    }
  };

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
        <p className="text-lg md:text-xl font-sans mb-4" data-testid="waiting-timer">
          {mins}:{secs} elapsed
        </p>
        
        {onLeaveQueue && (
          <button
            onClick={handleLeaveQueue}
            disabled={isLeaving}
            style={{
              marginTop: '20px',
              padding: '12px 28px',
              background: isLeaving ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(45deg, #cc0000, #ff3333)',
              color: '#fff',
              border: '2px solid #ff0000',
              borderRadius: '8px',
              fontSize: '16px',
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 'bold',
              cursor: isLeaving ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              boxShadow: isLeaving ? 'none' : '0 0 15px rgba(255, 0, 0, 0.6)',
              opacity: isLeaving ? 0.5 : 1,
              transition: 'all 0.3s ease',
            }}
            data-testid="button-leave-queue"
          >
            {isLeaving ? 'Leaving...' : 'Leave Queue & Get Refund'}
          </button>
        )}
      </div>
    </div>
  );
}
