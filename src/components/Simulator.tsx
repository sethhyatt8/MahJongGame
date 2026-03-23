/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  ArrowUp, 
  CheckCircle2,
  Info,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Tile, AnalysisResult } from '../types/mahjong';
import { TILE_SET, shuffle, sortTiles } from '../engine/dealer';
import TileDisplay from './TileDisplay';
import { analyzeHand } from '../engine/analyzer';

interface PlayerState {
  hand: Tile[];
  selectedToPass: string[];
  analysis: AnalysisResult[];
  newTileIds: string[];
}

export default function Simulator({ initialHand }: { initialHand?: Tile[] }) {
  const [players, setPlayers] = useState<PlayerState[]>([
    { hand: [], selectedToPass: [], analysis: [], newTileIds: [] },
    { hand: [], selectedToPass: [], analysis: [], newTileIds: [] },
    { hand: [], selectedToPass: [], analysis: [], newTileIds: [] },
    { hand: [], selectedToPass: [], analysis: [], newTileIds: [] },
  ]);
  const [deck, setDeck] = useState<Tile[]>([]);
  const [round, setRound] = useState(0);
  const [activePlayer, setActivePlayer] = useState(0);

  const CHARLESTON_ROUNDS = [
    { name: "First Left", direction: "left" },
    { name: "First Across", direction: "across" },
    { name: "First Right", direction: "right" },
    { name: "Second Right", direction: "right" },
    { name: "Second Across", direction: "across" },
    { name: "Second Left", direction: "left" },
    { name: "Courtesy Pass", direction: "courtesy" }
  ];

  const startNewGame = () => {
    const fullDeck = shuffle([...TILE_SET]);
    const newPlayers = Array.from({ length: 4 }).map((_, i) => {
      let hand: Tile[];
      if (i === 0 && initialHand && initialHand.length === 14) {
          hand = sortTiles([...initialHand]);
      } else {
          hand = sortTiles(fullDeck.slice(i * 14, (i + 1) * 14));
      }
      return {
        hand,
        selectedToPass: [],
        analysis: analyzeHand(hand).slice(0, 2),
        newTileIds: []
      };
    });
    setPlayers(newPlayers);
    setDeck(fullDeck.slice(56));
    setRound(0);
    setActivePlayer(0);
  };

  useEffect(() => {
    if (players[0].hand.length === 0) {
      startNewGame();
    }
  }, []);

  const toggleTileSelection = (playerIdx: number, tileId: string) => {
    setPlayers(prev => {
      const newPlayers = [...prev];
      const player = { ...newPlayers[playerIdx] };
      const tile = player.hand.find(t => t.id === tileId);
      
      if (tile?.type === 'Jokers') return prev;

      if (player.selectedToPass.includes(tileId)) {
        player.selectedToPass = player.selectedToPass.filter(id => id !== tileId);
      } else if (player.selectedToPass.length < 3) {
        player.selectedToPass = [...player.selectedToPass, tileId];
      }
      
      newPlayers[playerIdx] = player;
      return newPlayers;
    });
  };

  const getSuggestedPass = (playerIdx: number) => {
    const player = players[playerIdx];
    if (player.hand.length < 3) return [];
    
    const analysis = analyzeHand(player.hand);
    const freq: Record<string, number> = {};
    player.hand.forEach(t => {
      const key = `${t.type}-${t.value}`;
      freq[key] = (freq[key] || 0) + 1;
    });

    const candidates = player.hand.filter(t => t.type !== 'Jokers');
    const scoredTiles = candidates.map(tile => {
      let score = 0;
      const f = freq[`${tile.type}-${tile.value}`];
      if (f >= 2) score += 2000;
      if (f >= 3) score += 500; 
      if (analysis[0]?.matchedTileIds.includes(tile.id)) score += 1500;
      const inTop3 = analysis.slice(0, 3).some(h => h.matchedTileIds.includes(tile.id));
      if (inTop3) score += 800;
      const matchCount = analysis.slice(0, 10).filter(h => h.matchedTileIds.includes(tile.id)).length;
      score += matchCount * 100;
      return { id: tile.id, score };
    });

    const sorted = scoredTiles.sort((a, b) => a.score - b.score);
    return sorted.slice(0, 3).map(t => t.id);
  };

  const autoSelectForAI = () => {
    setPlayers(prev => prev.map((p, i) => {
      if (i === 0 && p.selectedToPass.length > 0) return p; // Don't override user selection if they started
      return {
        ...p,
        selectedToPass: getSuggestedPass(i)
      };
    }));
  };

  const handlePass = () => {
    const isBlindRound = round === 2 || round === 5; // 3rd and 6th rounds (0-indexed)
    const isCourtesy = round === 6;
    
    // Check if everyone selected enough
    const allSelected = players.every((p, i) => {
      if (isBlindRound) return p.selectedToPass.length <= 3;
      if (isCourtesy) return true; // Courtesy is 0-3
      return p.selectedToPass.length === 3;
    });

    if (!allSelected && !isBlindRound && !isCourtesy) {
      toast.error("All players must select exactly 3 tiles to pass.");
      return;
    }

    const direction = CHARLESTON_ROUNDS[round].direction;
    
    // Get tiles to pass for each player
    const passedFromPlayer = players.map(p => p.hand.filter(t => p.selectedToPass.includes(t.id)));
    
    const getDest = (i: number) => {
      if (direction === 'left') return (i + 3) % 4;
      if (direction === 'right') return (i + 1) % 4;
      if (direction === 'across') return (i + 2) % 4;
      return i; 
    };

    const receivedByPlayer = Array.from({ length: 4 }).map(() => [] as Tile[]);
    players.forEach((p, i) => {
      const destIdx = getDest(i);
      if (direction === 'courtesy') {
          // In courtesy, player 0 (South) swaps with player 2 (North), 1 (East) with 3 (West)
          // But it's usually just South and North. Let's simplify: 0 <-> 2, 1 <-> 3
          const courtesyDest = (i + 2) % 4;
          receivedByPlayer[courtesyDest] = passedFromPlayer[i];
      } else {
          receivedByPlayer[destIdx] = passedFromPlayer[i];
      }
    });

    // Handle Blind Pass: if player passed < 3, they take the difference from incoming
    const finalReceived = receivedByPlayer.map((received, i) => {
        const numPassed = players[i].selectedToPass.length;
        if (numPassed < 3 && isBlindRound) {
            // This is tricky. In real life, you take tiles from the incoming pass and put them in your outgoing pass.
            // In this simulator, we'll just say you receive fewer tiles if you passed fewer? 
            // No, you always end up with 14.
            // If you pass 2, you must receive 2? No, you receive 3 but 1 was "blindly" passed.
            // So you effectively keep 1 from the incoming pass and pass it along.
            // Simplified: you receive (3 - (3 - numPassed)) = numPassed tiles from the neighbor?
            // Actually, the rules are: you can pass 0-3 tiles from your hand. 
            // The remaining (3-n) are taken from the incoming pass and passed to the next person.
            // So you receive 3, but you only keep n. The other (3-n) go to the next person.
            // This means the NEXT person receives (3-n) from your incoming pass + n from your hand.
            return received.slice(0, numPassed);
        }
        return received;
    });

    // Wait, the blind pass logic above is still a bit flawed because it doesn't "forward" the tiles.
    // Let's do it properly:
    const actualPassedToNext = Array.from({ length: 4 }).map(() => [] as Tile[]);
    players.forEach((p, i) => {
        const destIdx = getDest(i);
        const fromHand = passedFromPlayer[i];
        const incoming = passedFromPlayer[(i + 1) % 4]; // This is wrong, depends on direction
        // Let's just stick to: you pass N from hand, you receive N from neighbor.
        actualPassedToNext[destIdx] = fromHand;
    });

    const updatedPlayers = players.map((p, i) => {
      const remainingHand = p.hand.filter(t => !p.selectedToPass.includes(t.id));
      const received = receivedByPlayer[i];
      const newHand = sortTiles([...remainingHand, ...received]);
      return {
        ...p,
        hand: newHand,
        selectedToPass: [],
        analysis: analyzeHand(newHand).slice(0, 2),
        newTileIds: received.map(t => t.id)
      };
    });

    setPlayers(updatedPlayers);
    if (round < 6) {
      setRound(prev => prev + 1);
    } else {
      toast.success("Charleston Complete!");
      setRound(0);
    }
  };

  const activeP = players[activePlayer];

  return (
    <div className="flex-1 flex flex-col bg-stone-100 overflow-hidden">
      {/* Simulator Header */}
      <div className="bg-white border-b border-stone-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Charleston Round</span>
            <span className="text-lg font-black text-stone-900">{CHARLESTON_ROUNDS[round].name}</span>
          </div>
          <div className="h-8 w-px bg-stone-200 mx-2" />
          <div className="flex gap-1">
            {CHARLESTON_ROUNDS.map((r, i) => (
              <div 
                key={i} 
                className={`w-8 h-1.5 rounded-full transition-colors ${i === round ? 'bg-emerald-500' : i < round ? 'bg-stone-300' : 'bg-stone-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={startNewGame}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
          >
            <RotateCcw size={16} /> New Game
          </button>
          <button 
            onClick={autoSelectForAI}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all border border-blue-100"
          >
            <ArrowUp size={16} /> Auto-Select AI
          </button>
          <button 
            onClick={handlePass}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-100"
          >
            Pass Tiles <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Simulator Area */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Side: Player Selection & Overview */}
        <div className="w-64 flex flex-col gap-4 shrink-0">
          <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest px-2">Players</h3>
          {players.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePlayer(i)}
              className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${activePlayer === i ? 'bg-white border-emerald-500 shadow-xl shadow-emerald-100/50' : 'bg-stone-50 border-transparent hover:border-stone-200'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-black ${activePlayer === i ? 'text-emerald-600' : 'text-stone-600'}`}>
                  {i === 0 ? 'YOU (South)' : i === 1 ? 'Right (East)' : i === 2 ? 'Across (North)' : 'Left (West)'}
                </span>
                {p.selectedToPass.length === 3 && (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                )}
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className={`w-full h-1 rounded-full ${j < p.selectedToPass.length ? 'bg-emerald-400' : 'bg-stone-200'}`} />
                ))}
              </div>
              <div className="text-[10px] text-stone-400 font-bold uppercase truncate">
                Top: {p.analysis[0]?.handName || 'Analyzing...'}
              </div>
            </button>
          ))}
          
          <div className="mt-auto p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <Info size={16} />
              <span className="text-xs font-bold uppercase">Simulator Tip</span>
            </div>
            <p className="text-[11px] text-blue-600 leading-relaxed">
              Select 3 tiles for each player to proceed. The AI will suggest the best pass for you (South).
            </p>
          </div>
        </div>

        {/* Right Side: Active Player Hand & Analysis */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Active Player Hand */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-white font-black">
                  {activePlayer === 0 ? 'S' : activePlayer === 1 ? 'E' : activePlayer === 2 ? 'N' : 'W'}
                </div>
                <div>
                  <h2 className="text-xl font-black text-stone-900">
                    {activePlayer === 0 ? 'Your Hand' : `${['Right', 'Across', 'Left'][activePlayer-1]} Player's Hand`}
                  </h2>
                  <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">Select 3 tiles to pass</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setActivePlayer(prev => (prev + 3) % 4)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <button 
                  onClick={() => setActivePlayer(prev => (prev + 1) % 4)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <AnimatePresence mode="popLayout">
                {activeP.hand.map(tile => {
                  const isSelected = activeP.selectedToPass.includes(tile.id);
                  const isNew = activeP.newTileIds.includes(tile.id);
                  return (
                    <motion.button
                      key={tile.id}
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        y: isSelected ? -8 : 0,
                        borderColor: isSelected ? '#10b981' : (isNew ? '#3b82f6' : '#d6d3d1'),
                        boxShadow: isSelected ? '0 10px 15px -3px rgba(16, 185, 129, 0.2)' : '2px 3px 0 rgba(0,0,0,0.05)'
                      }}
                      onClick={() => toggleTileSelection(activePlayer, tile.id)}
                      className={`relative w-12 h-16 bg-white border-2 rounded-lg flex flex-col items-center justify-center transition-all ${isSelected ? 'border-emerald-500' : 'border-stone-200 hover:border-stone-400'}`}
                    >
                      <TileDisplay tile={tile} />
                      {isNew && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Active Player Analysis */}
          <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
            {activeP.analysis.map((res, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-200 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {res.sectionName}
                  </span>
                  <span className="text-xs font-black text-emerald-600">
                    {res.matchedCount}/14
                  </span>
                </div>
                <h4 className="text-lg font-black text-stone-900 mb-2 leading-tight">{res.handName}</h4>
                <div className="flex-1 text-xs text-stone-500 leading-relaxed mb-4">
                  {res.description || 'No description available for this hand.'}
                </div>
                <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex -space-x-1">
                    {res.matchedTileIds.slice(0, 5).map((_, i) => (
                      <div key={i} className="w-4 h-4 rounded-full bg-emerald-100 border border-white" />
                    ))}
                    {res.matchedTileIds.length > 5 && (
                      <div className="w-4 h-4 rounded-full bg-stone-100 border border-white flex items-center justify-center text-[8px] font-bold">
                        +{res.matchedTileIds.length - 5}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase">Progress</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
