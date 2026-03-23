/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tile, Suit } from '../types/mahjong';

export const TILE_SET: Tile[] = [];

const SUITS: Suit[] = ['Bams', 'Dots', 'Cracks'];
const VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Add 4 of each number tile for each suit
SUITS.forEach(suit => {
  VALUES.forEach(val => {
    for (let i = 0; i < 4; i++) {
      TILE_SET.push({ id: `${suit}-${val}-${i}`, type: suit, value: val });
    }
  });
});

// Add 4 of each Wind
['N', 'S', 'E', 'W'].forEach(wind => {
  for (let i = 0; i < 4; i++) {
    TILE_SET.push({ id: `Wind-${wind}-${i}`, type: 'Winds', value: wind });
  }
});

// Add 4 of each Dragon
['R', 'G', 'W'].forEach(dragon => {
  for (let i = 0; i < 4; i++) {
    TILE_SET.push({ id: `Dragon-${dragon}-${i}`, type: 'Dragons', value: dragon });
  }
});

// Add 8 Flowers
for (let i = 0; i < 8; i++) {
  TILE_SET.push({ id: `Flower-${i}`, type: 'Flowers', value: 'F' });
}

// Add 8 Jokers
for (let i = 0; i < 8; i++) {
  TILE_SET.push({ id: `Joker-${i}`, type: 'Jokers', value: 'J' });
}

export const getTileDisplayColor = (tile: Tile): string => {
  switch (tile.type) {
    case 'Bams': return 'text-emerald-600';
    case 'Dots': return 'text-black';
    case 'Cracks': return 'text-red-600';
    case 'Winds': return 'text-black';
    case 'Dragons': {
        if (tile.value === 'R') return 'text-red-600';
        if (tile.value === 'G') return 'text-emerald-600';
        return 'text-black'; // White Dragon (Soap)
    }
    case 'Flowers': return 'text-orange-500';
    case 'Jokers': return 'text-purple-600';
    default: return 'text-black';
  }
};

export const sortTiles = (tiles: Tile[]): Tile[] => {
  const typeOrder: Record<string, number> = {
    'Flowers': 0,
    'Bams': 1,
    'Dots': 2,
    'Cracks': 3,
    'Winds': 4,
    'Dragons': 5,
    'Jokers': 6
  };

  return [...tiles].sort((a, b) => {
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.value.localeCompare(b.value);
  });
};

export const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};
