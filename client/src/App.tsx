import { useEffect, useRef } from 'react';
import { initGame } from './game/initGame';

export default function App() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const game = initGame('game-container');
    gameRef.current = game;

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '20px' }}>Virtual Lounge</h1>
      <div id="game-container" style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
      <p style={{ marginTop: '10px', color: '#888' }}>ใช้ปุ่มลูกศร (Arrow Keys) ในการควบคุมการเดิน</p>
    </div>
  );
}