import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface NFTCollection {
  id: string;
  name: string;
  type: string;
}

interface AdminPanelProps {
  adminAddress: string;
  currentAddress: string | null;
}

export default function AdminPanel({ adminAddress, currentAddress }: AdminPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionType, setNewCollectionType] = useState('');

  const isAdmin = currentAddress?.toLowerCase() === adminAddress.toLowerCase();
  
  console.log('AdminPanel Check:', {
    currentAddress,
    adminAddress,
    isAdmin,
    currentLower: currentAddress?.toLowerCase(),
    adminLower: adminAddress.toLowerCase()
  });

  useEffect(() => {
    const stored = localStorage.getItem('allowed_nft_collections');
    if (stored) {
      setCollections(JSON.parse(stored));
    } else {
      const defaultCollections = [
        {
          id: '1',
          name: 'Tree Roots NFT',
          type: '0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft'
        }
      ];
      setCollections(defaultCollections);
      localStorage.setItem('allowed_nft_collections', JSON.stringify(defaultCollections));
    }
  }, []);

  const saveCollections = (newCollections: NFTCollection[]) => {
    setCollections(newCollections);
    localStorage.setItem('allowed_nft_collections', JSON.stringify(newCollections));
  };

  const addCollection = () => {
    if (!newCollectionName.trim() || !newCollectionType.trim()) return;

    const newCollection: NFTCollection = {
      id: Date.now().toString(),
      name: newCollectionName.trim(),
      type: newCollectionType.trim()
    };

    saveCollections([...collections, newCollection]);
    setNewCollectionName('');
    setNewCollectionType('');
  };

  const removeCollection = (id: string) => {
    saveCollections(collections.filter(c => c.id !== id));
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'linear-gradient(45deg, #00ff00, #00cc00)',
          color: '#000',
          padding: '12px 24px',
          borderRadius: '9999px',
          border: '2px solid #00ff00',
          fontWeight: 'bold',
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 0 20px rgba(0, 255, 0, 0.6)',
          zIndex: 100,
          fontFamily: 'Orbitron, sans-serif',
          transition: 'transform 0.3s, box-shadow 0.3s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 0 30px #00ff00';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.6)';
        }}
        data-testid="button-admin-panel"
      >
        Admin Panel
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              background: 'linear-gradient(rgba(0, 50, 0, 0.95), rgba(0, 80, 0, 0.95))',
              border: '3px solid #00ff00',
              borderRadius: '10px',
              boxShadow: '0 0 30px rgba(0, 255, 0, 0.6)',
              padding: '30px',
              overflow: 'auto',
              fontFamily: 'Orbitron, sans-serif',
            }}
          >
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                width: '40px',
                height: '40px',
                background: 'rgba(0, 50, 0, 0.8)',
                color: '#00ff00',
                borderRadius: '50%',
                border: '2px solid #00ff00',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              data-testid="button-close-admin"
            >
              <X size={20} />
            </button>

            <h2
              style={{
                fontSize: '28px',
                color: '#00ff00',
                marginBottom: '20px',
                textShadow: '0 0 10px rgba(0, 255, 0, 0.8)',
              }}
            >
              NFT Collection Manager
            </h2>

            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ color: '#00ffcc', fontSize: '18px', marginBottom: '15px' }}>
                Allowed NFT Collections
              </h3>
              
              {collections.length === 0 ? (
                <p style={{ color: '#fff', opacity: 0.7 }}>No collections added yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {collections.map((collection) => (
                    <div
                      key={collection.id}
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid #00ff00',
                        borderRadius: '8px',
                        padding: '15px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#00ff00', fontWeight: 'bold', marginBottom: '5px' }}>
                          {collection.name}
                        </div>
                        <div
                          style={{
                            color: '#00ffcc',
                            fontSize: '12px',
                            wordBreak: 'break-all',
                            opacity: 0.8,
                          }}
                        >
                          {collection.type}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCollection(collection.id)}
                        style={{
                          background: 'rgba(255, 0, 0, 0.2)',
                          border: '1px solid #ff0000',
                          borderRadius: '5px',
                          padding: '8px',
                          cursor: 'pointer',
                          color: '#ff0000',
                          marginLeft: '10px',
                        }}
                        data-testid={`button-remove-${collection.id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '2px solid #00ff00',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <h3 style={{ color: '#00ffcc', fontSize: '18px', marginBottom: '15px' }}>
                Add New Collection
              </h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    color: '#00ff00',
                    marginBottom: '5px',
                    fontSize: '14px',
                  }}
                >
                  Collection Name
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g., Tree Roots NFT"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid #00ff00',
                    borderRadius: '5px',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'Orbitron, sans-serif',
                  }}
                  data-testid="input-collection-name"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    color: '#00ff00',
                    marginBottom: '5px',
                    fontSize: '14px',
                  }}
                >
                  NFT Type (Full Type String)
                </label>
                <input
                  type="text"
                  value={newCollectionType}
                  onChange={(e) => setNewCollectionType(e.target.value)}
                  placeholder="e.g., 0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid #00ff00',
                    borderRadius: '5px',
                    color: '#fff',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  data-testid="input-collection-type"
                />
              </div>

              <button
                onClick={addCollection}
                disabled={!newCollectionName.trim() || !newCollectionType.trim()}
                style={{
                  background: newCollectionName.trim() && newCollectionType.trim()
                    ? 'linear-gradient(45deg, #00ff00, #00cc00)'
                    : 'rgba(100, 100, 100, 0.3)',
                  color: newCollectionName.trim() && newCollectionType.trim() ? '#000' : '#666',
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  border: '2px solid #00ff00',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: newCollectionName.trim() && newCollectionType.trim() ? 'pointer' : 'not-allowed',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'Orbitron, sans-serif',
                }}
                data-testid="button-add-collection"
              >
                <Plus size={18} />
                Add Collection
              </button>
            </div>

            <div
              style={{
                marginTop: '20px',
                padding: '15px',
                background: 'rgba(255, 165, 0, 0.1)',
                border: '1px solid #ffa500',
                borderRadius: '8px',
              }}
            >
              <p style={{ color: '#ffa500', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
                ⚠️ <strong>Important:</strong> The smart contract validates NFT issuer fields. 
                Collections without an <code>issuer</code> field may be detected but rejected during battle join. 
                You may need to update the contract to support multiple collection types.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
