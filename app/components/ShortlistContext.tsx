'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { LocationScore } from '../lib/locationScores';

interface ShortlistContextType {
  shortlist: LocationScore[];
  addToShortlist: (loc: LocationScore) => void;
  removeFromShortlist: (id: string) => void;
  isInShortlist: (id: string) => boolean;
  isFull: boolean;
}

const ShortlistContext = createContext<ShortlistContextType | null>(null);

export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [shortlist, setShortlist] = useState<LocationScore[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('edu-loc-shortlist');
      if (saved) setShortlist(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('edu-loc-shortlist', JSON.stringify(shortlist));
  }, [shortlist]);

  const addToShortlist = (loc: LocationScore) => {
    if (shortlist.length < 2 && !shortlist.find(l => l.id === loc.id)) {
      setShortlist(prev => [...prev, loc]);
    }
  };

  const removeFromShortlist = (id: string) => {
    setShortlist(prev => prev.filter(l => l.id !== id));
  };

  const isInShortlist = (id: string) => shortlist.some(l => l.id === id);
  const isFull = shortlist.length >= 2;

  return (
    <ShortlistContext.Provider value={{ shortlist, addToShortlist, removeFromShortlist, isInShortlist, isFull }}>
      {children}
    </ShortlistContext.Provider>
  );
}

export function useShortlist() {
  const ctx = useContext(ShortlistContext);
  if (!ctx) throw new Error('useShortlist must be used within ShortlistProvider');
  return ctx;
}
