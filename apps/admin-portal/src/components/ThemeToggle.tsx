'use client';

import React from 'react';
import { useTheme } from './providers/theme-provider';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg border border-[var(--border-main)] bg-[var(--glass-bg)] hover:bg-[var(--glass-hover-bg)] hover:border-[var(--brand-primary)] text-[var(--fg-main)] hover:text-[var(--brand-primary)] transition-all duration-300 shadow-sm flex items-center justify-center group overflow-hidden relative"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
        >
            <div className="relative w-4 h-4 flex items-center justify-center">
                {/* Sun Icon for Light Mode */}
                <Sun 
                    className={`absolute h-4 w-4 transition-all duration-500 transform ${
                        theme === 'light' 
                            ? 'rotate-0 scale-100 opacity-100 text-amber-500' 
                            : 'rotate-90 scale-0 opacity-0 text-yellow-400'
                    }`} 
                />
                {/* Moon Icon for Dark Mode */}
                <Moon 
                    className={`absolute h-4 w-4 transition-all duration-500 transform ${
                        theme === 'dark' 
                            ? 'rotate-0 scale-100 opacity-100 text-cyan-400' 
                            : '-rotate-90 scale-0 opacity-0 text-slate-700'
                    }`} 
                />
            </div>
        </button>
    );
};
export default ThemeToggle;
