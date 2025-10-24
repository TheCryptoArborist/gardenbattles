export default function Footer() {
  return (
    <footer className="text-center py-6 mt-12" style={{
      background: 'rgba(0, 50, 0, 0.8)',
      borderTop: '2px solid #00ff00',
      boxShadow: '0 0 15px #00ff00'
    }}>
      <a
        href="https://sui.io"
        target="_blank"
        rel="noopener noreferrer"
        className="text-lg transition-all duration-300"
        style={{ 
          color: '#00ffcc',
          textDecoration: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#00ffff';
          e.currentTarget.style.textShadow = '0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#00ffcc';
          e.currentTarget.style.textShadow = 'none';
        }}
        data-testid="link-sponsor"
      >
        Powered by SUI
      </a>
    </footer>
  );
}
