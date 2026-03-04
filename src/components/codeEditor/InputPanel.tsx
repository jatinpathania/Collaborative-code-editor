"use client";

import React from 'react';
import { Terminal, Trash2 } from 'lucide-react';

interface InputPanelProps {
    input: string;
    isHorizontal: boolean;
    onChange: (value: string) => void;
    onClear: () => void;
}

export default function InputPanel({
    input,
    isHorizontal,
    onChange,
    onClear,
}: InputPanelProps) {
    return (
        <div className={`${isHorizontal ? 'border-b border-zinc-800' : 'flex-1 border-r border-zinc-800'} flex flex-col`}>
            <div className="px-4 py-2 bg-zinc-800/80 border-b border-zinc-700 font-semibold text-sm flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-green-400" />
                    <span>Standard Input</span>
                </div>
                {input && (
                    <button
                        onClick={onClear}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                    >
                        <Trash2 className="w-3 h-3" />Clear
                    </button>
                )}
            </div>
            <div className="p-3 flex flex-col flex-1">
                <p className="text-xs text-zinc-500 mb-2">
                    💡 Type your program&apos;s input here before running.
                </p>
                <textarea
                    className="flex-1 min-h-[64px] w-full bg-zinc-950 border border-zinc-700 rounded-md p-3 text-sm text-zinc-100 font-mono outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none placeholder:text-zinc-600"
                    placeholder={`Enter input for your program...\nEach line = one Enter press.`}
                    value={input}
                    onChange={e => onChange(e.target.value)}
                    spellCheck={false}
                />
            </div>
        </div>
    );
}
