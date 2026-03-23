/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  RotateCcw,
  Maximize2,
  Minimize2,
  Flower2,
  Wind,
  Sparkles,
  Circle,
  Bird,
  BrainCircuit,
  Dices,
  X,
  Loader2,
  HelpCircle,
  BookOpen,
  LayoutGrid,
  Gamepad2
} from 'lucide-react';
import { Tile, MahjongCard, AnalysisResult } from './types/mahjong';
import { TILE_SET, getTileDisplayColor, sortTiles, shuffle } from './engine/dealer';
import { analyzeHand, getPatternColorClass } from './engine/analyzer';
import cardData from './data/card.json';
import { GoogleGenAI } from "@google/genai";
import TileDisplay from './components/TileDisplay';
import Simulator from './components/Simulator';

const card = cardData as MahjongCard;

export default function App() {
  const [currentHand, setCurrentHand] = useState<Tile[]>([]);
  const [deck, setDeck] = useState<Tile[]>([]);
  const [viewMode, setViewMode] = useState<'analyzer' | 'card' | 'simulator'>('card');
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [suggestedPass, setSuggestedPass] = useState<string[] | null>(null);
  const [newTileIds, setNewTileIds] = useState<string[]>([]);
  const [charlestonRound, setCharlestonRound] = useState(0);
  const [selectedToPass, setSelectedToPass] = useState<string[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  const CHARLESTON_ROUNDS = [
    "First Left",
    "First Across",
    "First Right",
    "Second Right",
    "Second Across",
    "Second Left",
    "Courtesy Pass"
  ];

  const analysis = useMemo(() => analyzeHand(currentHand), [currentHand]);

  const [showHelp, setShowHelp] = useState(false);

  const startCharleston = () => {
    if (currentHand.length !== 14) {
      toast.error("You need exactly 14 tiles to start the Charleston.");
      return;
    }
    setCharlestonRound(1);
    setSelectedToPass([]);
    setSuggestedPass(null);
  };

  const handlePass = () => {
    const isBlindRound = charlestonRound === 3 || charlestonRound === 6;
    const isCourtesy = charlestonRound === 7;
    
    if (!isBlindRound && !isCourtesy && selectedToPass.length !== 3) {
      toast.error("You must select exactly 3 tiles to pass.");
      return;
    }

    if (isBlindRound && selectedToPass.length > 3) {
      toast.error("You can only pass up to 3 tiles.");
      return;
    }

    if (selectedToPass.some(id => currentHand.find(t => t.id === id)?.type === 'Jokers')) {
      toast.error("You cannot pass Jokers!");
      return;
    }

    // Remove selected tiles
    const remainingHand = currentHand.filter(t => !selectedToPass.includes(t.id));
    
    // Add new random tiles from the deck
    const newTiles: Tile[] = [];
    let currentDeck = [...deck];
    
    // If deck is empty or too small, refill it with all tiles not currently in hand
    if (currentDeck.length < selectedToPass.length) {
      const inHandIds = currentHand.map(t => t.id);
      currentDeck = shuffle(TILE_SET.filter(t => !inHandIds.includes(t.id)));
    }

    for (let i = 0; i < selectedToPass.length; i++) {
      // During Charleston, we must NOT receive a Joker
      const nonJokerIdx = currentDeck.findIndex(t => t.type !== 'Jokers');
      if (nonJokerIdx !== -1) {
        newTiles.push(currentDeck.splice(nonJokerIdx, 1)[0]);
      } else {
        const drawn = currentDeck.pop();
        if (drawn) newTiles.push(drawn);
      }
    }

    setCurrentHand(sortTiles([...remainingHand, ...newTiles]));
    setDeck(currentDeck);
    setSelectedToPass([]);
    setNewTileIds(newTiles.map(t => t.id));
    
    if (charlestonRound < 7) {
      setCharlestonRound(prev => prev + 1);
    } else {
      setCharlestonRound(0);
      toast.success("Charleston Complete!");
    }
  };

  const toggleTileSelection = (id: string) => {
    const tile = currentHand.find(t => t.id === id);
    if (tile?.type === 'Jokers') return;

    setNewTileIds([]); // Clear new tile highlights when user interacts
    setSelectedToPass(prev => {
      if (prev.includes(id)) {
        return prev.filter(tId => tId !== id);
      }
      // Limit to 3 if in Charleston (except round 7)
      if (charlestonRound > 0 && charlestonRound < 7 && prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      // No limit outside Charleston, but usually people pass 3
      return [...prev, id];
    });
  };

  const handleManualPass = () => {
    if (selectedToPass.length === 0) return;
    
    if (selectedToPass.some(id => currentHand.find(t => t.id === id)?.type === 'Jokers')) {
      toast.error("You cannot pass Jokers!");
      return;
    }

    // Remove selected tiles
    const remainingHand = currentHand.filter(t => !selectedToPass.includes(t.id));
    
    // Add new random tiles from the deck
    const newTiles: Tile[] = [];
    let currentDeck = [...deck];
    
    if (currentDeck.length < selectedToPass.length) {
      const inHandIds = currentHand.map(t => t.id);
      currentDeck = shuffle(TILE_SET.filter(t => !inHandIds.includes(t.id)));
    }

    for (let i = 0; i < selectedToPass.length; i++) {
      const drawn = currentDeck.pop();
      if (drawn) newTiles.push(drawn);
    }

    setCurrentHand(sortTiles([...remainingHand, ...newTiles]));
    setDeck(currentDeck);
    setSelectedToPass([]);
    setSuggestedPass(null);
    setNewTileIds(newTiles.map(t => t.id));
  };

  const removeSelected = () => {
    setCurrentHand(prev => prev.filter(t => !selectedToPass.includes(t.id)));
    setSelectedToPass([]);
    setSuggestedPass(null);
  };

  const getSuggestedPass = () => {
    if (currentHand.length < 3) return;
    
    // Count frequencies of each tile type/value pair
    const freq: Record<string, number> = {};
    currentHand.forEach(t => {
      const key = `${t.type}-${t.value}`;
      freq[key] = (freq[key] || 0) + 1;
    });

    // Score each tile based on its utility - EXCLUDE JOKERS
    const candidates = currentHand.filter(t => t.type !== 'Jokers');
    
    const scoredTiles = candidates.map(tile => {
      let score = 0;
      
      // 1. Pairs/Triples/Kongs are very valuable - protect them heavily
      const f = freq[`${tile.type}-${tile.value}`];
      if (f >= 2) score += 2000;
      if (f >= 3) score += 500; 

      // 3. Absolute protection for the top hand (closest to completion)
      if (analysis[0]?.matchedTileIds.includes(tile.id)) {
        score += 1500;
      }

      // 4. Protection for top 3 hands
      const inTop3 = analysis.slice(0, 3).some(h => h.matchedTileIds.includes(tile.id));
      if (inTop3) score += 800;

      // 5. General utility in top 10 hands
      const matchCount = analysis.slice(0, 10).filter(h => h.matchedTileIds.includes(tile.id)).length;
      score += matchCount * 100;

      return { id: tile.id, score };
    });

    // Sort by score ascending (lowest score = best to pass)
    const sorted = scoredTiles.sort((a, b) => a.score - b.score);
    const suggestedIds = sorted.slice(0, 3).map(t => t.id);
    setSuggestedPass(suggestedIds);
  };

  const addTile = (tile: Tile) => {
    if (currentHand.length < 14) {
      // Find an available tile of this type/value in the TILE_SET
      const inHandIds = currentHand.map(t => t.id);
      const available = TILE_SET.find(t => t.type === tile.type && t.value === tile.value && !inHandIds.includes(t.id));
      
      if (available) {
        setCurrentHand(prev => sortTiles([...prev, available]));
        setSuggestedPass(null);
        // Also remove from deck if it's there
        setDeck(prev => prev.filter(t => t.id !== available.id));
      } else {
        toast.error(`No more ${tile.value} ${tile.type} available in the set!`);
      }
    }
  };

  const removeTile = (id: string) => {
    const removedTile = currentHand.find(t => t.id === id);
    setCurrentHand(prev => prev.filter(t => t.id !== id));
    if (removedTile) {
      setDeck(prev => [...prev, removedTile]);
    }
    setSuggestedPass(null);
  };

  const clearHand = () => {
    setCurrentHand([]);
    setDeck(shuffle(TILE_SET));
    setSelectedResult(null);
    setSuggestedPass(null);
    setNewTileIds([]);
    setCharlestonRound(0);
    setSelectedToPass([]);
    setAiAnalysis(null);
  };

  const dealRandomHand = () => {
    const shuffled = shuffle(TILE_SET);
    const newHand = shuffled.slice(0, 14);
    const remaining = shuffled.slice(14);
    
    setCurrentHand(sortTiles(newHand));
    setDeck(remaining);
    setSelectedResult(null);
    setSuggestedPass(null);
    setNewTileIds([]); // Don't highlight initial deal
    setCharlestonRound(1); // Auto-start Charleston
    setSelectedToPass([]);
    setViewMode('card'); // Default to card view on new deal
    setAiAnalysis(null);
  };

  const getAIAnalysis = async () => {
    if (currentHand.length === 0) return;
    
    setIsAnalyzing(true);
    setShowAIModal(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const handString = currentHand.map(t => `${t.value} ${t.type}`).join(', ');
      const topHands = analysis.slice(0, 3).map(h => 
        `${h.handName} (${h.sectionName}): ${h.pattern} - ${h.matchedCount}/14 tiles matched`
      ).join('\n');

      const prompt = `
        You are a world-class National Mah Jongg League (NMJL) expert. 
        Analyze the following hand and provide strategic advice for the Charleston and beyond.
        
        Current Hand: ${handString}
        
        Top 3 Suggested Hands from Rule-Based Analyzer:
        ${topHands}
        
        Please provide:
        1. A brief strategic overview of the hand's potential.
        2. Specific advice on which tiles to prioritize and which to pass in the Charleston.
        3. Any "in-between" strategies if the hand is split between two different sections.
        4. Long-term outlook (e.g., "This hand is strong but needs Jokers" or "This is a difficult hand, consider switching to X if Y happens").
        
        Keep the tone professional yet encouraging. Use Markdown for formatting.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiAnalysis(response.text || "Sorry, I couldn't generate an analysis at this time.");
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiAnalysis("Error generating AI analysis. Please check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isTileMatched = (tileId: string) => {
    return selectedResult?.matchedTileIds.includes(tileId);
  };

  const isTileSuggested = (tileId: string) => {
    return suggestedPass?.includes(tileId);
  };

  return (
    <div className="h-screen w-screen bg-white text-stone-900 font-sans selection:bg-emerald-100 overflow-hidden flex flex-col">
      <Toaster position="top-center" richColors />
      
      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-stone-200"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <BookOpen size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">How to use Mahjong Analyzer</h2>
                </div>
                <button 
                  onClick={() => setShowHelp(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors text-stone-400 hover:text-stone-600"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8 max-h-[70vh]">
                <section>
                  <h3 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                    <LayoutGrid size={20} className="text-indigo-600" />
                    Hand Analyzer
                  </h3>
                  <p className="text-stone-600 leading-relaxed">
                    Add tiles to your hand using the picker at the bottom. The analyzer will automatically compare your hand against the 2026 NMJL card and show you the closest matching patterns.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                    <BookOpen size={20} className="text-indigo-600" />
                    Card View
                  </h3>
                  <p className="text-stone-600 leading-relaxed">
                    Browse all the official 2026 patterns. You can see the required tiles, scores, and descriptions for every hand in each section.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                    <Gamepad2 size={20} className="text-indigo-600" />
                    Charleston Simulator
                  </h3>
                  <p className="text-stone-600 leading-relaxed">
                    Practice the Charleston passing round. You can start with your current hand or deal a random one. AI players will simulate the other three seats.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-stone-900 mb-3 flex items-center gap-2">
                    <Sparkles size={20} className="text-indigo-600" />
                    AI Strategic Advice
                  </h3>
                  <p className="text-stone-600 leading-relaxed">
                    Click the "AI Strategy" button to receive personalized tips from the Gemini AI on which tiles to keep and which patterns to aim for.
                  </p>
                </section>
              </div>
              
              <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end">
                <button 
                  onClick={() => setShowHelp(false)}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Analysis Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-stone-200"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <BrainCircuit size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">AI Strategic Analysis</h2>
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Powered by Gemini 3</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAIModal(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors text-stone-400 hover:text-stone-600"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8">
                {isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h3 className="text-lg font-bold text-stone-800">Analyzing your hand...</h3>
                    <p className="text-stone-500 max-w-xs">Our AI is calculating probabilities and evaluating NMJL strategies.</p>
                  </div>
                ) : (
                  <div className="prose prose-stone max-w-none prose-headings:text-stone-900 prose-p:text-stone-600 prose-strong:text-blue-700">
                    <div className="markdown-body">
                      <Markdown>{aiAnalysis || ""}</Markdown>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end">
                <button 
                  onClick={() => setShowAIModal(false)}
                  className="px-6 py-2.5 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors shadow-lg shadow-stone-200"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between px-4 py-2 border-b border-stone-100 shrink-0 bg-white z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowHelp(true)}
            className="p-2 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
            title="Help & Instructions"
          >
            <HelpCircle size={24} />
          </button>
          <span className="text-xl font-black tracking-tighter uppercase">2026 Mahjong Card</span>
          <div className="h-6 w-px bg-stone-100" />
          <div className="flex bg-stone-50 p-1 rounded-xl border border-stone-100">
            <button 
              onClick={() => setViewMode(viewMode === 'analyzer' ? 'card' : 'analyzer')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode !== 'simulator' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
              {viewMode === 'analyzer' ? 'Card View' : 'Analyzer'}
            </button>
            <button 
              onClick={() => setViewMode('simulator')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'simulator' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
              Game Simulator
            </button>
          </div>
        </div>

        {viewMode !== 'simulator' && (
          <div className="flex items-center gap-3">
            <button 
              onClick={getAIAnalysis}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-2 hover:bg-blue-100 border border-blue-200"
            >
              <BrainCircuit size={14} /> AI Strategy
            </button>
            <button 
              onClick={dealRandomHand} 
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-2 hover:bg-emerald-100 border border-emerald-200"
            >
              <RotateCcw size={14} /> Deal Random
            </button>
            <button onClick={() => setShowPicker(!showPicker)} className="text-[10px] font-bold uppercase flex items-center gap-1 px-3 py-1.5 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors">
              <Plus size={14} /> Add Tiles
            </button>
            <button onClick={clearHand} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors" title="Clear Hand">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </header>

      {viewMode === 'simulator' ? (
        <Simulator initialHand={currentHand.length === 14 ? currentHand : undefined} />
      ) : (
        <>
          {/* Current Hand - One line across the top */}
          <div className="bg-stone-50 border-b border-stone-200 p-4 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-hide flex-1">
            <AnimatePresence mode="popLayout">
              {currentHand.length === 0 ? (
                <div className="text-stone-300 font-bold italic text-sm py-2">No tiles in hand. Add some to start analyzing.</div>
              ) : (
                currentHand.map(tile => {
                  const isNew = newTileIds.includes(tile.id);
                  return (
                    <motion.div
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: selectedToPass.includes(tile.id) ? 0.7 : 1,
                        y: isTileMatched(tile.id) ? -4 : (isTileSuggested(tile.id) ? 4 : 0),
                        borderColor: isTileMatched(tile.id) ? '#10b981' : (selectedToPass.includes(tile.id) ? '#f43f5e' : (isTileSuggested(tile.id) ? '#fda4af' : (isNew ? '#3b82f6' : '#d6d3d1'))),
                        boxShadow: isNew 
                          ? '0 0 15px rgba(59, 130, 246, 0.4), 2px 3px 0 rgba(0,0,0,0.1)' 
                          : (isTileSuggested(tile.id) && !selectedToPass.includes(tile.id) 
                              ? '0 0 12px rgba(244, 63, 94, 0.25), 2px 3px 0 rgba(0,0,0,0.1)' 
                              : '2px 3px 0 rgba(0,0,0,0.1)')
                      }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      key={tile.id}
                      onClick={() => toggleTileSelection(tile.id)}
                      className={`w-10 h-14 rounded-md border-t border-l flex flex-col items-center justify-center relative group cursor-pointer transition-all shrink-0 
                        ${isNew ? 'bg-blue-300 border-blue-500 ring-2 ring-blue-600/20 shadow-inner' : 'bg-[#fdfbf7] border-white'}
                        ${isTileMatched(tile.id) ? 'shadow-emerald-100 shadow-lg ring-2 ring-emerald-500/20' : ''} 
                        ${selectedToPass.includes(tile.id) ? 'ring-2 ring-rose-500/20' : ''}
                        ${isTileSuggested(tile.id) && !selectedToPass.includes(tile.id) ? 'ring-1 ring-rose-200' : ''}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-b ${isNew ? 'from-blue-400/30' : 'from-white/40'} to-transparent pointer-events-none rounded-md`} />
                      <TileDisplay tile={tile} />
                      {isTileMatched(tile.id) && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                      {selectedToPass.includes(tile.id) && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                        <Trash2 size={8} className="text-white" />
                      </div>
                    )}
                    {isTileSuggested(tile.id) && !selectedToPass.includes(tile.id) && (
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-rose-100 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                        <Sparkles size={8} className="text-rose-500" />
                      </div>
                    )}
                  </motion.div>
                )
              }))}
            </AnimatePresence>
          </div>
          
          {currentHand.length >= 1 && (
            <div className="ml-4 pl-4 border-l border-stone-200 flex items-center gap-3">
              {charlestonRound === 0 ? (
                <>
                  <button 
                    onClick={getSuggestedPass}
                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 shadow-sm"
                  >
                    {suggestedPass ? 'Refresh Pass' : 'Suggest Pass'}
                  </button>
                  
                  {selectedToPass.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleManualPass}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm"
                      >
                        Pass {selectedToPass.length}
                      </button>
                      <button 
                        onClick={removeSelected}
                        className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {currentHand.length === 14 && selectedToPass.length === 0 && (
                    <button 
                      onClick={startCharleston}
                      className="px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-sm"
                    >
                      Start Charleston
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-stone-400 uppercase leading-none mb-1">Round {charlestonRound}/7</span>
                    <span className="text-[10px] font-black text-stone-900 uppercase leading-none">{CHARLESTON_ROUNDS[charlestonRound - 1]}</span>
                  </div>
                  
                  <button 
                    onClick={getSuggestedPass}
                    className="px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 shadow-sm"
                  >
                    Suggest
                  </button>

                  <button 
                    onClick={handlePass}
                    disabled={(charlestonRound !== 3 && charlestonRound !== 6 && charlestonRound < 7) && selectedToPass.length !== 3}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${(charlestonRound !== 3 && charlestonRound !== 6 && charlestonRound < 7) && selectedToPass.length !== 3 ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    {(charlestonRound === 3 || charlestonRound === 6) && selectedToPass.length < 3 
                      ? `Blind Pass ${selectedToPass.length}` 
                      : `Pass ${selectedToPass.length} Tiles`}
                  </button>
                  <button 
                    onClick={() => setCharlestonRound(0)}
                    className="px-3 py-2 text-stone-400 hover:text-stone-900 text-[10px] font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col relative">
        {/* Picker Overlay */}
        <AnimatePresence>
          {showPicker && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="absolute top-0 left-0 right-0 bg-white border-b border-stone-200 z-20 shadow-xl overflow-hidden"
            >
              <div className="p-4 max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black uppercase text-xs tracking-widest">Tile Picker</h3>
                  <button onClick={() => setShowPicker(false)} className="text-stone-400 hover:text-stone-900">Close</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['Bams', 'Dots', 'Cracks', 'special'].map((type) => (
                    <div key={type} className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase text-stone-400">{type}</h4>
                      <div className="flex flex-wrap gap-1">
                        {TILE_SET.filter(t => type === 'special' ? ['Winds', 'Dragons', 'Flowers', 'Jokers'].includes(t.type) : t.type === type)
                          .filter((v, i, a) => a.findIndex(t => t.value === v.value && t.type === v.type) === i)
                          .map(tile => (
                            <button
                              key={`${tile.type}-${tile.value}`}
                              onClick={() => addTile(tile)}
                              className="w-9 h-12 bg-[#fdfbf7] rounded-md border-t border-l border-white flex flex-col items-center justify-center relative hover:border-stone-400 transition-all shadow-[2px_2px_0_rgba(0,0,0,0.1)] group overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                              <TileDisplay tile={tile} />
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {viewMode === 'analyzer' ? (
          <div className="flex-1 overflow-y-auto p-4 bg-stone-50">
            <div className="max-w-4xl mx-auto flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black uppercase italic tracking-tight">Hand Analysis</h2>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">{currentHand.length}/14 Tiles</span>
                  {selectedResult && (
                    <button 
                      onClick={() => setSelectedResult(null)}
                      className="text-[10px] font-bold text-emerald-600 uppercase hover:underline"
                    >
                      Clear Highlight
                    </button>
                  )}
                </div>
              </div>
              
              <div className="grid gap-3">
                {analysis.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
                    <p className="text-stone-300 font-bold italic text-lg">Add tiles to see possible hands...</p>
                  </div>
                ) : (
                  analysis.slice(0, 15).map((res, idx) => {
                    return (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        key={`${res.sectionName}-${res.handName}-${res.suits}-${res.description || idx}`}
                        onClick={() => setSelectedResult(res)}
                        className={`bg-white border-2 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group ${selectedResult?.handName === res.handName ? 'border-emerald-500 ring-4 ring-emerald-500/5' : 'border-transparent'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                {res.sectionName}
                              </span>
                              {res.concealed && (
                                <span className="text-[8px] font-black bg-stone-900 text-white px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">Concealed</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                              {res.handName.split(' ').map((group, gIdx) => (
                                <span 
                                  key={gIdx} 
                                  className={`text-2xl font-black tracking-tighter leading-none ${getPatternColorClass(group[0], gIdx, res.suits)}`}
                                >
                                  {group}
                                </span>
                              ))}
                            </div>
                            {res.description && (
                              <p className="text-[10px] text-stone-400 font-bold italic mt-2 leading-tight">{res.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-3xl font-black leading-none ${res.missingTiles === 0 ? 'text-emerald-600' : 'text-stone-900'}`}>
                              {14 - res.missingTiles}/14
                            </div>
                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter mt-1">
                              Tiles Matched
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden mb-3">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${((14 - res.missingTiles) / 14) * 100}%` }}
                            className={`h-full transition-colors ${res.missingTiles === 0 ? 'bg-emerald-500' : 'bg-stone-800'}`}
                          />
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black px-3 py-1 rounded-full ${res.missingTiles <= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                                {res.missingTiles === 0 ? 'MAHJONG!' : `${res.missingTiles} AWAY`}
                              </span>
                              {selectedResult?.handName === res.handName && (
                                <span className="text-[10px] font-bold text-emerald-600 animate-pulse">Highlighted in hand</span>
                              )}
                            </div>
                            {res.missingTiles > 0 && res.missingTiles <= 6 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span className="text-[9px] font-bold text-stone-400 uppercase">Need:</span>
                                {Array.from(new Set(res.missingTilesList)).map((tile, tIdx) => (
                                  <span key={tIdx} className="text-[9px] font-black bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 uppercase">{tile}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-black text-stone-400">
                            {res.score} POINTS
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* RESPONSIVE CARD VIEW */
          <div className="flex-1 overflow-y-auto p-4 bg-stone-100/30">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1600px] mx-auto">
              {[
                ['Year', '13579'],
                ['Like Numbers', 'Consecutive Run'],
                ['2468', '369'],
                ['Quints', 'Winds Dragons', 'Singles Pairs']
              ].map((colSections, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-4">
                  {colSections.map(sectionName => {
                    const section = card.sections.find(s => s.name === sectionName);
                    if (!section) return null;
                    return (
                      <div key={section.name} className="bg-white border border-stone-200 p-3 rounded-2xl shadow-sm flex flex-col min-h-0">
                        <h3 className="text-xs font-black uppercase italic border-b-2 border-stone-900 mb-2 pb-1 flex justify-between items-center bg-stone-50/50 px-2 leading-none h-6 shrink-0 rounded-t-lg">
                          {section.name}
                        </h3>
                        {section.description && (
                          <p className="text-[9px] text-stone-500 font-bold italic px-2 mb-2 leading-tight">{section.description}</p>
                        )}
                        <div className="space-y-1.5 overflow-hidden">
                          {section.hands.map((hand, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-2 group py-1 px-2 hover:bg-stone-50 rounded-xl transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-baseline gap-x-1">
                                  {hand.pattern.split(' ').map((group, gIdx) => (
                                    <span 
                                      key={gIdx} 
                                      className={`text-[16px] font-black tracking-tighter leading-none ${getPatternColorClass(group[0], gIdx, hand.suits)}`}
                                    >
                                      {group}
                                    </span>
                                  ))}
                                </div>
                                {hand.description && (
                                  <p className="text-[9px] text-stone-400 font-bold italic leading-tight mt-1">{hand.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 mt-1">
                                <span className="text-xs font-black text-stone-800 leading-none">{hand.score}</span>
                                {hand.concealed && (
                                  <span className="text-[10px] font-black bg-stone-900 text-white px-1 rounded-sm leading-none">C</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
        </>
      )}
    </div>
  );
}
