"use client";

import React from 'react';
import { Button } from '@/components/ui/button';

interface ExitConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ExitConfirmDialog({
    isOpen,
    onConfirm,
    onCancel,
}: ExitConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-2">Exit Room?</h2>
                <p className="text-sm text-zinc-300 mb-6">
                    Are you sure you want to exit the room? Any unsaved changes will be lost.
                </p>
                <div className="flex gap-3 justify-end">
                    <Button
                        onClick={onCancel}
                        variant="outline"
                        size="sm"
                        className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700"
                    >
                        No, Stay
                    </Button>
                    <Button
                        onClick={onConfirm}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        Yes, Exit
                    </Button>
                </div>
            </div>
        </div>
    );
}
