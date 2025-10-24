interface BattleDialogProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export default function BattleDialog({ isOpen, message, onClose }: BattleDialogProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50"
      onClick={onClose}
      data-testid="dialog-overlay"
    >
      <div 
        className="p-6 md:p-8 rounded-xl max-w-md mx-4"
        style={{
          background: 'rgba(0, 50, 0, 0.8)',
          border: '2px solid #00ff00',
          boxShadow: '0 0 15px #00ff00'
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-content"
      >
        <p className="text-white text-lg md:text-xl mb-6 font-sans" data-testid="dialog-message">
          {message}
        </p>
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-3 text-base md:text-lg font-sans transition-all duration-300"
            style={{
              border: '2px solid #00ff00',
              background: 'transparent',
              color: 'white',
              borderRadius: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00ff00';
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.boxShadow = '0 0 25px #00ff00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = 'none';
            }}
            data-testid="button-close-dialog"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
