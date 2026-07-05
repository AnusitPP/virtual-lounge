import { useEffect, useRef, useState } from 'react';
import { initGame } from './game/initGame';
import { socket } from './socket';

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);
  
  // Local state for profile form, load from sessionStorage if exists
  const [name, setName] = useState(() => sessionStorage.getItem('vl_username') || `Player_${Math.floor(Math.random() * 9000 + 1000)}`);
  const [color, setColor] = useState(() => sessionStorage.getItem('vl_color') || '#00ff00');
  const [roomId, setRoomId] = useState(() => sessionStorage.getItem('vl_roomId') || 'lobby');
  const [avatarImg, setAvatarImg] = useState(() => sessionStorage.getItem('vl_avatarImg') || '');
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    // Save defaults to sessionStorage if not exists
    if (!sessionStorage.getItem('vl_username')) sessionStorage.setItem('vl_username', name);
    if (!sessionStorage.getItem('vl_color')) sessionStorage.setItem('vl_color', color);
    if (!sessionStorage.getItem('vl_roomId')) sessionStorage.setItem('vl_roomId', roomId);
    if (avatarImg && !sessionStorage.getItem('vl_avatarImg')) sessionStorage.setItem('vl_avatarImg', avatarImg);

    const game = initGame('game-container');
    gameRef.current = game;

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit to 200 KB
    const limitBytes = 200 * 1024;
    if (file.size > limitBytes) {
      setImageError('ขนาดไฟล์ต้องไม่เกิน 200 KB');
      setAvatarImg('');
      e.target.value = ''; // Reset file input
      return;
    }

    setImageError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarImg(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to session storage
    sessionStorage.setItem('vl_username', name);
    sessionStorage.setItem('vl_color', color);
    sessionStorage.setItem('vl_roomId', roomId);
    sessionStorage.setItem('vl_avatarImg', avatarImg);

    // Emit join event to the server
    socket.emit('join', {
      name,
      roomId,
      color: parseInt(color.replace('#', '0x')),
      avatarImg
    });

    // Notify Phaser game to update local player styling
    window.dispatchEvent(new CustomEvent('vl-profile-updated', {
      detail: { name, color, roomId, avatarImg }
    }));
  };

  const [showPanel, setShowPanel] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#121212',
      color: '#fff',
      fontFamily: '"Outfit", "Inter", sans-serif',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <h1 style={{ margin: '0 0 15px 0', fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px' }}>Virtual Lounge</h1>
      
      {/* Game Canvas Container */}
      <div style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        border: '2px solid #2d2d2d',
        backgroundColor: '#1e1e1e',
        width: '800px',
        height: '600px'
      }}>
        {/* Phaser target div */}
        <div id="game-container" style={{ width: '100%', height: '100%' }} />

        {/* Floating Menu Toggle Button */}
        <button
          onClick={() => setShowPanel(!showPanel)}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            zIndex: 10,
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(30, 30, 30, 0.75)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            transition: 'background 0.2s, transform 0.1s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(50, 50, 50, 0.9)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(30, 30, 30, 0.75)';
          }}
        >
          ⚙️ Profile & Room
        </button>

        {/* Floating Configuration Panel */}
        {showPanel && (
          <div style={{
            position: 'absolute',
            top: '65px',
            right: '15px',
            zIndex: 10,
            width: '280px',
            backgroundColor: 'rgba(30, 30, 30, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, background: 'linear-gradient(45deg, #00ff87, #60efff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Player Profile
              </h2>
              <button 
                onClick={() => setShowPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '2px'
                }}
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={(e) => { handleSave(e); setShowPanel(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Nickname</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => window.dispatchEvent(new CustomEvent('vl-input-focus'))}
                  onBlur={() => window.dispatchEvent(new CustomEvent('vl-input-blur'))}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    backgroundColor: '#222',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onFocus={() => window.dispatchEvent(new CustomEvent('vl-input-focus'))}
                  onBlur={() => window.dispatchEvent(new CustomEvent('vl-input-blur'))}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    backgroundColor: '#222',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Avatar Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      width: '35px',
                      height: '35px',
                      padding: 0,
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#ccc', fontFamily: 'monospace' }}>{color}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px' }}>Custom Avatar Image (Max 200KB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    backgroundColor: '#222',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                />
                {imageError && <span style={{ color: '#ff4a4a', fontSize: '11px' }}>{imageError}</span>}
                {avatarImg && !imageError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                    <img src={avatarImg} alt="Preview" style={{ width: '32px', height: '32px', borderRadius: '4px', border: '1px solid #555', objectFit: 'cover' }} />
                    <button 
                      type="button" 
                      onClick={() => { setAvatarImg(''); sessionStorage.removeItem('vl_avatarImg'); }} 
                      style={{ background: 'none', border: 'none', color: '#ff4a4a', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                    >
                      ลบรูป
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '5px',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(45deg, #00ff87, #60efff)',
                  color: '#121212',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Save & Join Room
              </button>
            </form>

            <div style={{ borderTop: '1px solid #444', paddingTop: '10px', fontSize: '12px', color: '#888' }}>
              <p style={{ margin: '0 0 4px 0' }}>• Arrow keys / WASD to move.</p>
              <p style={{ margin: '0' }}>• Current Room: <strong style={{ color: '#00ff87' }}>{roomId}</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}