/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Suit = 'Bams' | 'Dots' | 'Cracks' | 'Winds' | 'Dragons' | 'Flowers' | 'Jokers';

export interface Tile {
  id: string;
  type: Suit;
  value: string; // '1'-'9', 'N', 'S', 'E', 'W', 'R', 'G', 'W', 'F', 'J'
  color?: string;
}

export interface HandPattern {
  pattern: string; // e.g., "222 444 6666 8888"
  suits: string;   // e.g., "G B R R"
  score: number;
  concealed: boolean;
  description?: string;
}

export interface CardSection {
  name: string;
  description?: string;
  hands: HandPattern[];
}

export interface MahjongCard {
  year: number;
  sections: CardSection[];
}

export interface AnalysisResult {
  handName: string;
  sectionName: string;
  isMatch: boolean;
  missingTiles: number;
  matchedCount: number;
  missingTilesList: string[];
  score: number;
  matchedTileIds: string[];
  suits: string;
  pattern: string;
  description?: string;
  concealed?: boolean;
}
