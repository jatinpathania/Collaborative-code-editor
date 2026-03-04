"use client";

import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { LANGUAGES } from './constants';

interface CodeHandlersProps {
    roomId: string;
    socketRef: React.MutableRefObject<Socket | null>;
    editorRef: React.MutableRefObject<any>;
    isRemoteChange: React.MutableRefObject<boolean>;
    code: string;
    language: string;
    setLanguage: (lang: string) => void;
    setCode: (code: string) => void;
    setInput: (input: string) => void;
    toast: any;
}

export function useCodeHandlers({
    roomId,
    socketRef,
    editorRef,
    isRemoteChange,
    code,
    language,
    setLanguage,
    setCode,
    setInput,
    toast,
}: CodeHandlersProps) {
    const handleCodeChange = useCallback((value: string | undefined) => {
        const newCode = value || '';
        setCode(newCode);
        if (!isRemoteChange.current && socketRef.current) {
            socketRef.current.emit('code-change', { roomId, code: newCode });
        }
    }, [roomId, socketRef, setCode, isRemoteChange]);

    const handleInputChange = useCallback((newInput: string) => {
        setInput(newInput);
        if (socketRef.current) {
            socketRef.current.emit('input-change', { roomId, input: newInput });
        }
    }, [roomId, socketRef, setInput]);

    const handleLanguageChange = useCallback((newLanguage: string) => {
        setLanguage(newLanguage);
        const langConfig = LANGUAGES.find(l => l.value === newLanguage);
        const newCode = langConfig?.defaultCode || '';
        setCode(newCode);
        if (socketRef.current) {
            socketRef.current.emit('language-change', { roomId, language: newLanguage, code: newCode });
        }
    }, [roomId, socketRef, setLanguage, setCode]);

    const handleDownloadCode = useCallback(() => {
        const extension = language === 'javascript' ? 'js'
            : language === 'python' ? 'py'
                : language === 'java' ? 'java'
                    : language === 'cpp' ? 'cpp' : 'c';

        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
    }, [code, language]);

    const handleSaveCode = useCallback(async () => {
        try {
            const response = await fetch('/api/code/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, code, language }),
            });
            if (response.ok) {
                toast({ title: 'Saved', description: 'Code saved successfully!' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to save code', variant: 'destructive' });
        }
    }, [roomId, code, language, toast]);

    const handleEditorDidMount = useCallback((editor: any) => {
        editorRef.current = editor;
    }, [editorRef]);

    return {
        handleCodeChange,
        handleInputChange,
        handleLanguageChange,
        handleDownloadCode,
        handleSaveCode,
        handleEditorDidMount,
    };
}
