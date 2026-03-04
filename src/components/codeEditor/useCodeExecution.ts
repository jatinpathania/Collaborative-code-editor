"use client";

import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { executeCode } from '@/lib/docker-executor';

interface CodeExecutionHookProps {
    code: string;
    language: string;
    input: string;
    roomId: string;
    socketRef: React.MutableRefObject<Socket | null>;
    setIsExecuting: (executing: boolean) => void;
    setOutput: (output: string) => void;
    setExecutionTime: (time: number | null) => void;
    toast: any;
}

export function useCodeExecution({
    code,
    language,
    input,
    roomId,
    socketRef,
    setIsExecuting,
    setOutput,
    setExecutionTime,
    toast,
}: CodeExecutionHookProps) {
    const handleRunCode = useCallback(async () => {
        setIsExecuting(true);
        setOutput('⏳ Executing...');
        setExecutionTime(null);

        if (socketRef.current) {
            socketRef.current.emit('execution-start', { roomId });
        }

        try {
            const result = await executeCode({ code, language, input });
            setExecutionTime(result.executionTime);

            if (result.error) {
                const combined = [result.output, result.error].filter(Boolean).join('\n--- Error ---\n');
                setOutput(combined);
                if (socketRef.current) {
                    socketRef.current.emit('execution-result', {
                        roomId,
                        output: result.output || '',
                        error: result.error,
                        executionTime: result.executionTime,
                    });
                }
                toast({ title: 'Execution Error', description: result.error.slice(0, 120), variant: 'destructive' });
            } else {
                const finalOutput = result.output || '(Program exited with no output)';
                setOutput(finalOutput);
                if (socketRef.current) {
                    socketRef.current.emit('execution-result', {
                        roomId,
                        output: finalOutput,
                        executionTime: result.executionTime,
                    });
                }
                toast({ title: '✅ Executed', description: `Done in ${result.executionTime}ms` });
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            setOutput(`Error: ${errorMsg}`);
            if (socketRef.current) {
                socketRef.current.emit('execution-result', {
                    roomId,
                    output: '',
                    error: errorMsg,
                    executionTime: 0,
                });
            }
            toast({ title: 'Execution Failed', description: errorMsg, variant: 'destructive' });
        } finally {
            setIsExecuting(false);
        }
    }, [roomId, code, language, input, setOutput, setIsExecuting, setExecutionTime, socketRef, toast]);

    return { handleRunCode };
}
