"use client";

import React from 'react';
import { Terminal } from 'lucide-react';

interface OutputPanelProps {
    output: string;
    executionTime: number | null;
    isHorizontal: boolean;
}

export default function OutputPanel({
    output,
    executionTime,
    isHorizontal,
}: OutputPanelProps) {
    return (
        <div className={`${isHorizontal ? 'flex-1' : 'flex-1'} flex flex-col min-h-0 overflow-hidden`}>
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-b border-zinc-700 shrink-0">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-red-400" />
                    <span className="font-semibold text-sm">Output</span>
                </div>
                {executionTime !== null && (
                    <span className="text-xs text-zinc-500">⏱ {executionTime}ms</span>
                )}
            </div>
            <div className="flex-1 p-4 overflow-auto">
                <pre className={`text-sm font-mono whitespace-pre-wrap ${output.startsWith('Error') || output.includes('--- Error ---')
                    ? 'text-red-400'
                    : output.startsWith('⏳')
                        ? 'text-zinc-500 italic'
                        : 'text-zinc-200'
                    }`}>
                    {output || '▶ Run your code to see output here…'}
                </pre>
            </div>
        </div>
    );
}
