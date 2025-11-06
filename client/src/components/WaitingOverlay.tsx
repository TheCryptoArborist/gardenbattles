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
      console.log('AUTO-TRIGGERING REFUND (forced)...');
      setAutoTriggered(true);
      handleLeaveQueue();
    }
  }, [isWaiting, autoTriggerRefund, autoTriggered]);

  const handleLeaveQueue = async () => {
    if (!onLeaveQueue || isLeaving) return;

    setIsLeaving(true);
    try {
      await onLeaveQueue();
      console.log('Successfully left queue and received refund!');
    } catch (error: any) {
      console.error('Failed to leave queue:', error);
      alert(`Failed to leave queue: ${error.message}`);
      setIsLeaving(false);
    }
  };

  if (!isWaiting) return null;

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div 
      style={{
        position: 'fixed',
        top: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        textAlign: 'center',
        padding: '20px 40px',
        background: 'rgba(0, 50, 0, 0.95)',
        border: '3px solid #00ff00',
        borderRadius: '12px',
        boxShadow: '0 0 30px #00ff00, 0 0 15px rgba(0, 255, 0, 0.5)',
        animation: 'pulseGlow 2s infinite alternate',
        fontFamily: 'Orbitron, sans-serif',
      }}
      data-testid="waiting-overlay"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div 
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.2)',
            borderTop: '4px solid #00ff00',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
          data-testid="waiting-spinner"
        />
        <div style={{ textAlign: 'left' }}>
          <p style={{ 
            fontSize: '24px', 
            color: '#00ff00', 
            margin: 0,
            fontWeight: 'bold',
            textShadow: '0 0 10px rgba(0, 255, 0, 0.8)'
          }} data-testid="waiting-text">
            Waiting for Opponent...
          </p>
          <p style={{ 
            fontSize: '16px', 
            color: '#00ffcc', 
            margin: '5px 0 0 0'
          }} data-testid="waiting-timer">
            {mins}:{secs} elapsed
          </p>
        </div>
        
        {onLeaveQueue && (
          <button
            onClick={handleLeaveQueue}
            disabled={isLeaving}
            style={{
              padding: '10px 20px',
              background: isLeaving ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(45deg, #cc0000, #ff3333)',
              color: '#fff',
              border: '2px solid #ff0000',
              borderRadius: '6px',
              fontSize: '14px',
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 'bold',
              cursor: isLeaving ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              boxShadow: isLeaving ? 'none' : '0 0 10px rgba(255, 0, 0, 0.6)',
              opacity: isLeaving ? 0.5 : 1,
              transition: 'all 0.3s ease',
              whiteSpace: 'nowrap',
            }}
            data-testid="button-leave-queue"
          >
            {isLeaving ? 'Leaving...' : 'Leave & Refund'}
          </button>
        )}
      </div>
    </div>
  );
}
