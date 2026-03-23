/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Flower2, 
  Sparkles, 
  Circle, 
  Bird 
} from 'lucide-react';
import { Tile } from '../types/mahjong';

export default function TileDisplay({ tile }: { tile: Tile }) {
  if (tile.type === 'Flowers') {
    return (
      <div className="flex flex-col items-center justify-center">
        <Flower2 className="w-6 h-6 text-orange-500" strokeWidth={2.5} />
        <span className="text-[6px] font-black uppercase text-orange-400 mt-0.5">Flower</span>
      </div>
    );
  }

  if (tile.type === 'Jokers') {
    return (
      <div className="flex flex-col items-center justify-center">
        <Sparkles className="w-6 h-6 text-purple-600" strokeWidth={2.5} />
        <span className="text-[7px] font-black uppercase text-purple-500 mt-0.5 italic">Joker</span>
      </div>
    );
  }

  if (tile.type === 'Winds') {
    return (
      <div className="flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none text-stone-900">{tile.value}</span>
        <span className="text-[6px] font-bold uppercase text-stone-400 mt-0.5">
          {tile.value === 'N' ? 'North' : tile.value === 'E' ? 'East' : tile.value === 'W' ? 'West' : 'South'}
        </span>
      </div>
    );
  }

  if (tile.type === 'Dragons') {
    if (tile.value === 'W') {
      return (
        <div className="flex flex-col items-center justify-center">
          <div className="w-6 h-8 border-[2px] border-blue-600 rounded-sm flex items-center justify-center mb-0.5 bg-transparent relative overflow-hidden">
             <div 
               className="absolute inset-0" 
               style={{
                 background: `
                   repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(37, 99, 235, 0.1) 2px, rgba(37, 99, 235, 0.1) 3px),
                   repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(37, 99, 235, 0.1) 2px, rgba(37, 99, 235, 0.1) 3px)
                 `
               }}
             />
             <div className="w-3 h-5 border border-blue-200 rounded-xs z-10 bg-transparent" />
          </div>
          <span className="text-[6px] font-black uppercase text-blue-600">Dragon</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <span className={`text-2xl font-black leading-none ${tile.value === 'R' ? 'text-red-600' : 'text-emerald-600'}`}>
            {tile.value === 'R' ? '中' : '發'}
          </span>
        </div>
        <span className={`text-[6px] font-bold uppercase mt-0.5 ${tile.value === 'R' ? 'text-red-400' : 'text-emerald-400'}`}>
          {tile.value === 'R' ? 'Red' : 'Green'}
        </span>
      </div>
    );
  }

  if (tile.type === 'Dots') {
    const num = parseInt(tile.value);
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-1">
        <div className="grid grid-cols-3 gap-0.5 items-center justify-center">
          {Array.from({ length: num }).map((_, i) => (
            <Circle key={i} className="w-1.5 h-1.5 fill-blue-600 text-blue-600" />
          ))}
        </div>
        <span className="text-[10px] font-black text-blue-800 mt-auto">{tile.value}</span>
      </div>
    );
  }

  if (tile.type === 'Bams') {
    const num = parseInt(tile.value);
    if (num === 1) {
      return (
        <div className="flex flex-col items-center justify-center">
          <Bird className="w-6 h-6 text-emerald-600" strokeWidth={2.5} />
          <span className="text-[6px] font-black uppercase text-emerald-500 mt-0.5">1 Bam</span>
        </div>
      );
    }
    
    const layouts: Record<number, { rows: number[]; cols: number }> = {
      2: { rows: [1, 1], cols: 1 },
      3: { rows: [1, 2], cols: 2 },
      4: { rows: [2, 2], cols: 2 },
      5: { rows: [2, 1, 2], cols: 2 },
      6: { rows: [3, 3], cols: 2 },
      7: { rows: [1, 3, 3], cols: 3 },
      8: { rows: [2, 2, 2, 2], cols: 2 },
      9: { rows: [3, 3, 3], cols: 3 }
    };

    const layout = layouts[num] || { rows: [num], cols: 1 };

    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-1">
        <div className="flex flex-col gap-0.5 items-center justify-center mb-1">
          {layout.rows.map((rowCount, rowIndex) => (
            <div key={rowIndex} className="flex gap-0.5">
              {Array.from({ length: rowCount }).map((_, i) => (
                <div key={i} className="w-1 h-2 bg-emerald-600 rounded-full" />
              ))}
            </div>
          ))}
        </div>
        <span className="text-[10px] font-black text-emerald-800 mt-auto">{tile.value}</span>
      </div>
    );
  }

  if (tile.type === 'Cracks') {
    return (
      <div className="flex flex-col items-center justify-center">
        <span className="text-lg font-black leading-none text-red-600">{tile.value}</span>
        <div className="text-[10px] font-black text-red-800 leading-none -mt-0.5">萬</div>
        <span className="text-[6px] font-bold uppercase text-red-400 mt-0.5">Cracks</span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-lg font-black leading-none">{tile.value}</span>
      <span className="text-[7px] font-bold uppercase opacity-50">{(tile.type as string).slice(0, 3)}</span>
    </div>
  );
}
