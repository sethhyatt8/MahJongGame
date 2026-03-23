/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tile, HandPattern, AnalysisResult, MahjongCard, Suit, CardSection } from '../types/mahjong';
import cardData from '../data/card.json';

const card = cardData as MahjongCard;

export const analyzeHand = (currentHand: Tile[]): AnalysisResult[] => {
  if (currentHand.length === 0) return [];

  const results: AnalysisResult[] = [];

  card.sections.forEach(section => {
    section.hands.forEach(handPattern => {
      // Expand patterns for Like Numbers and Consecutive Runs
      const expandedPatterns = expandPattern(section, handPattern);
      
      let bestMatch: MatchResult = { isMatch: false, matchedCount: 0, matchedTileIds: [], neededTiles: [], jokerPotential: 0 };

      expandedPatterns.forEach(p => {
        const match = checkPatternMatch(currentHand, p);
        if (match.matchedCount > bestMatch.matchedCount) {
          bestMatch = match;
        } else if (match.matchedCount === bestMatch.matchedCount && match.jokerPotential > bestMatch.jokerPotential) {
          bestMatch = match;
        }
      });

      results.push({
        handName: handPattern.pattern,
        sectionName: section.name,
        isMatch: bestMatch.isMatch,
        missingTiles: 14 - bestMatch.matchedCount,
        matchedCount: bestMatch.matchedCount,
        missingTilesList: bestMatch.neededTiles,
        score: handPattern.score,
        matchedTileIds: bestMatch.matchedTileIds,
        suits: handPattern.suits,
        pattern: handPattern.pattern,
        description: handPattern.description,
        concealed: handPattern.concealed
      });
    });
  });

  return results.sort((a, b) => a.missingTiles - b.missingTiles);
};

// Helper to expand patterns based on section rules and descriptions
const expandPattern = (section: CardSection, hand: HandPattern): HandPattern[] => {
  const sectionName = section.name;
  const handDesc = hand.description?.toLowerCase() || '';
  const sectionDesc = section.description?.toLowerCase() || '';

  const isExact = handDesc.includes('these exact numbers') || handDesc.includes('only these numbers');
  if (isExact) return [hand];

  const isLikeNumber = sectionName === 'Like Numbers' || handDesc.includes('any matching number') || handDesc.includes('any two numbers') || sectionDesc.includes('any matching number');
  const isConsecutive = sectionName === 'Consecutive Run' || handDesc.includes('any consecutive numbers') || handDesc.includes('any 3 consecutive numbers') || handDesc.includes('any 4 consecutive numbers') || sectionDesc.includes('any consecutive numbers');
  const isEven = handDesc.includes('any even number');
  const isOdd = handDesc.includes('any odd number');

  if (isLikeNumber) {
    const digits = Array.from(new Set(hand.pattern.match(/[1-9]/g) || []));
    if (digits.length === 1) {
      return Array.from({ length: 9 }, (_, i) => {
        const num = (i + 1).toString();
        return {
          ...hand,
          pattern: hand.pattern.replace(new RegExp(digits[0], 'g'), num)
        };
      });
    } else if (digits.length === 2 && handDesc.includes('any two numbers')) {
      // Expand to all pairs of different numbers
      const expanded: HandPattern[] = [];
      for (let i = 1; i <= 9; i++) {
        for (let j = 1; j <= 9; j++) {
          if (i === j) continue;
          let newPattern = hand.pattern;
          // Use placeholders to avoid double replacement
          newPattern = newPattern.replace(new RegExp(digits[0], 'g'), 'X');
          newPattern = newPattern.replace(new RegExp(digits[1], 'g'), 'Y');
          newPattern = newPattern.replace(/X/g, i.toString());
          newPattern = newPattern.replace(/Y/g, j.toString());
          expanded.push({ ...hand, pattern: newPattern });
        }
      }
      return expanded;
    }
  }

  if (isEven) {
    const digits = Array.from(new Set(hand.pattern.match(/[1-9]/g) || []));
    const toExpand = digits.find(d => (hand.pattern.match(new RegExp(d, 'g')) || []).length >= 3) || digits[0];
    if (toExpand) {
      return ['2', '4', '6', '8'].map(num => {
        if (num === toExpand) return hand;
        let newPattern = hand.pattern;
        const placeholder = 'X';
        newPattern = newPattern.replace(new RegExp(toExpand, 'g'), placeholder);
        newPattern = newPattern.replace(new RegExp(num, 'g'), toExpand);
        newPattern = newPattern.replace(new RegExp(placeholder, 'g'), num);
        return { ...hand, pattern: newPattern };
      });
    }
  }

  if (isOdd) {
    const digits = Array.from(new Set(hand.pattern.match(/[1-9]/g) || []));
    const toExpand = digits.find(d => (hand.pattern.match(new RegExp(d, 'g')) || []).length >= 3) || digits[0];
    if (toExpand) {
      return ['1', '3', '5', '7', '9'].map(num => {
        if (num === toExpand) return hand;
        let newPattern = hand.pattern;
        const placeholder = 'X';
        newPattern = newPattern.replace(new RegExp(toExpand, 'g'), placeholder);
        newPattern = newPattern.replace(new RegExp(num, 'g'), toExpand);
        newPattern = newPattern.replace(new RegExp(placeholder, 'g'), num);
        return { ...hand, pattern: newPattern };
      });
    }
  }

  const is369 = sectionName === '369' || handDesc.includes('matching kongs of 3, 6, or 9');
  if (is369) {
    const digits = Array.from(new Set(hand.pattern.match(/[369]/g) || []));
    const toExpand = digits.find(d => (hand.pattern.match(new RegExp(d, 'g')) || []).length >= 3) || '3';
    return ['3', '6', '9'].map(num => {
      if (num === toExpand) return hand;
      let newPattern = hand.pattern;
      const placeholder = 'X';
      newPattern = newPattern.replace(new RegExp(toExpand, 'g'), placeholder);
      newPattern = newPattern.replace(new RegExp(num, 'g'), toExpand);
      newPattern = newPattern.replace(new RegExp(placeholder, 'g'), num);
      return { ...hand, pattern: newPattern };
    });
  }

  if (isConsecutive) {
    const digits = Array.from(new Set(hand.pattern.match(/[1-9]/g)?.map(d => parseInt(d)) || []));
    if (digits.length > 0) {
      const minDigit = Math.min(...digits);
      const maxDigit = Math.max(...digits);
      const range = maxDigit - minDigit;
      const maxStart = 9 - range;
      
      return Array.from({ length: maxStart }, (_, i) => {
        const start = i + 1;
        const shift = start - minDigit;
        return {
          ...hand,
          pattern: hand.pattern.replace(/[1-9]/g, (d) => (parseInt(d) + shift).toString())
        };
      });
    }
  }

  return [hand];
};

interface MatchResult {
  isMatch: boolean;
  matchedCount: number;
  matchedTileIds: string[];
  neededTiles: string[];
  jokerPotential: number; // Number of missing tiles that can be filled by jokers
}

const checkPatternMatch = (hand: Tile[], handPattern: HandPattern): MatchResult => {
  const groups = handPattern.pattern.split(' ');
  const relativeSuits = handPattern.suits.split(' ');
  
  const naturalSuits: Suit[] = ['Bams', 'Dots', 'Cracks'];

  const getPermutations = <T>(arr: T[]): T[][] => {
    if (arr.length <= 1) return [arr];
    const perms: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const char = arr[i];
      const remainingChars = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of getPermutations(remainingChars)) {
        perms.push([char, ...perm]);
      }
    }
    return perms;
  };

  const patternSuits = Array.from(new Set(relativeSuits.filter(s => 'GBR'.includes(s))));
  const suitPerms = getPermutations(naturalSuits);
  
  let bestResult: MatchResult = { isMatch: false, matchedCount: 0, matchedTileIds: [], neededTiles: [], jokerPotential: 0 };

  suitPerms.forEach(perm => {
    const mapping: Record<string, Suit> = {};
    patternSuits.forEach((ps, idx) => {
      mapping[ps] = perm[idx];
    });

    // Track which tiles are used
    const usedTileIds: string[] = [];
    const availableTiles = [...hand];
    let currentMatched = 0;
    const missingTiles: string[] = [];
    let jokerPotential = 0;

    const needsJokerSubstitution: { char: string, relSuit: string, isCombination: boolean, display: string }[] = [];

    // Pass 1: Natural matches
    groups.forEach((group, groupIdx) => {
      const relSuit = relativeSuits[groupIdx];
      // A combination allows Jokers if it's 3+ identical tiles
      const isComb = group.length >= 3 && new Set(group.split('')).size === 1;
      
      group.split('').forEach(char => {
        let targetType = '';
        let targetValue = '';
        let displayValue = char;

        if ('123456789'.includes(char)) {
          targetType = mapping[relSuit] || '';
          targetValue = char;
          displayValue = `${char} ${targetType ? targetType.slice(0, -1) : ''}`;
        } else if (char === '0') {
          targetType = 'Dragons';
          targetValue = 'W';
          displayValue = 'Soap';
        } else if (char === 'F') {
          targetType = 'Flowers';
          targetValue = 'F';
          displayValue = 'Flower';
        } else if ('NEWS'.includes(char)) {
          targetType = 'Winds';
          targetValue = char;
          displayValue = char === 'N' ? 'North' : char === 'E' ? 'East' : char === 'W' ? 'West' : 'South';
        } else if (char === 'D') {
          const actualSuit = mapping[relSuit];
          targetType = 'Dragons';
          if (actualSuit === 'Bams') targetValue = 'G';
          else if (actualSuit === 'Cracks') targetValue = 'R';
          else if (actualSuit === 'Dots') targetValue = 'W';
          displayValue = `${targetValue === 'G' ? 'Green' : targetValue === 'R' ? 'Red' : 'White'} Drag`;
        }

        const tileIdx = availableTiles.findIndex(t => t.type === targetType && t.value === targetValue);
        if (tileIdx !== -1) {
          const tile = availableTiles.splice(tileIdx, 1)[0];
          usedTileIds.push(tile.id);
          currentMatched++;
        } else {
          needsJokerSubstitution.push({ char, relSuit, isCombination: isComb, display: displayValue });
        }
      });
    });

    // Pass 2: Jokers
    needsJokerSubstitution.forEach(need => {
      // Jokers can be used for any tile in a combination EXCEPT Flowers or "0" (Soap)
      const canUseJoker = need.isCombination && need.char !== 'F' && need.char !== '0';
      
      if (canUseJoker) {
        const jokerIdx = availableTiles.findIndex(t => t.type === 'Jokers');
        if (jokerIdx !== -1) {
          const joker = availableTiles.splice(jokerIdx, 1)[0];
          usedTileIds.push(joker.id);
          currentMatched++;
        } else {
          missingTiles.push(need.display);
          jokerPotential++;
        }
      } else {
        missingTiles.push(need.display);
      }
    });

    if (currentMatched > bestResult.matchedCount || (currentMatched === bestResult.matchedCount && jokerPotential > bestResult.jokerPotential)) {
      bestResult = {
        isMatch: currentMatched === 14,
        matchedCount: Math.min(currentMatched, 14),
        matchedTileIds: usedTileIds,
        neededTiles: missingTiles,
        jokerPotential
      };
    }
  });

  return bestResult;
};

export const getPatternColorClass = (char: string | undefined, suitIndex: number, suits: string): string => {
  if (!char) return 'text-slate-900';
  const suitArr = suits.split(' ');
  const suitCode = suitArr[suitIndex] || suitArr[0];

  if (char === 'F') return 'text-orange-500';
  if ('NEWS'.includes(char)) return 'text-slate-900';
  if (char === 'D') {
      if (suitCode === 'G') return 'text-emerald-600';
      if (suitCode === 'B') return 'text-blue-600';
      if (suitCode === 'R') return 'text-red-600';
  }
  
  switch (suitCode) {
    case 'G': return 'text-emerald-600';
    case 'B': return 'text-blue-600';
    case 'R': return 'text-red-600';
    default: return 'text-slate-900';
  }
};
