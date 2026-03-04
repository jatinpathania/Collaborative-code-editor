"use client";

import React, { useEffect } from 'react';
import { Socket, io } from 'socket.io-client';
import { LANGUAGES } from './constants';

interface SocketSetupProps {
    roomId: string;
    username: string;
    socketRef: React.MutableRefObject<Socket | null>;
    isRemoteChange: React.MutableRefObject<boolean>;
    isMicEnabled: boolean;
    webrtcManagerRef: React.MutableRefObject<any>;
    editorRef: React.MutableRefObject<any>;
    handleRemoteTrack: (userId: string, stream: MediaStream) => void;
    onlineUsers: string[];
    setIsConnected: (connected: boolean) => void;
    setCode: (code: string) => void;
    setLanguage: (lang: string) => void;
    setInput: (input: string) => void;
    setOutput: (output: string) => void;
    setExecutionTime: (time: number | null) => void;
    setOnlineUsers: (users: string[]) => void;
    setSpeakingUsers: (users: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    toast: any;
}

export function useSocketSetup({
    roomId,
    username,
    socketRef,
    isRemoteChange,
    isMicEnabled,
    webrtcManagerRef,
    editorRef,
    handleRemoteTrack,
    onlineUsers,
    setIsConnected,
    setCode,
    setLanguage,
    setInput,
    setOutput,
    setExecutionTime,
    setOnlineUsers,
    setSpeakingUsers,
    toast,
}: SocketSetupProps) {
    // Create refs for values that change frequently to avoid dependency array issues
    const onlineUsersRef = React.useRef(onlineUsers);
    const handleRemoteTrackRef = React.useRef(handleRemoteTrack);
    const isMicEnabledRef = React.useRef(isMicEnabled);

    React.useEffect(() => {
        onlineUsersRef.current = onlineUsers;
    }, [onlineUsers]);

    React.useEffect(() => {
        handleRemoteTrackRef.current = handleRemoteTrack;
    }, [handleRemoteTrack]);

    React.useEffect(() => {
        isMicEnabledRef.current = isMicEnabled;
    }, [isMicEnabled]);

    useEffect(() => {
        const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
        let isMounted = true;

        const initSocket = async () => {
            try {
                await fetch('/api/init-socket');
            } catch (err) {
                console.error('Failed to initialize socket:', err);
            }

            if (!isMounted) return;

            const socket = io(socketUrl, {
                path: '/api/socket',
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 15,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                randomizationFactor: 0.5,
                timeout: 10000,
                autoConnect: true,
                forceNew: false,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                if (!isMounted) {
                    socket.disconnect();
                    return;
                }
                setIsConnected(true);
                const cleanRoomId = roomId.trim();
                socket.emit('join-room', { roomId: cleanRoomId, username });
            });

            socket.on('connect_error', (err) => {
                if (!isMounted) return;
                console.error('[Socket] Connection Error:', err.message);
                toast({
                    title: 'Connection Error',
                    description: `Failed to connect to ${socketUrl || 'local server'}.`,
                    variant: 'destructive',
                });
            });

            socket.on('disconnect', () => {
                setIsConnected(false);
            });

            socket.on('code-change', ({ code: remoteCode }: { code: string }) => {
                if (editorRef.current && isMounted) {
                    isRemoteChange.current = true;
                    const model = editorRef.current.getModel();
                    if (model && model.getValue() !== remoteCode) {
                        editorRef.current.setValue(remoteCode);
                    }
                    isRemoteChange.current = false;
                }
                setCode(remoteCode);
            });

            socket.on('room-state', ({
                code: snapCode,
                language: snapLang,
                input: snapInput,
                output: snapOutput,
                executionTime: snapTime,
            }: {
                code?: string;
                language?: string;
                input?: string;
                output?: string;
                executionTime?: number;
            }) => {
                if (!isMounted) return;
                isRemoteChange.current = true;
                if (snapCode !== undefined) {
                    setCode(snapCode);
                    if (editorRef.current) editorRef.current.setValue(snapCode);
                }
                if (snapLang !== undefined) setLanguage(snapLang);
                if (snapInput !== undefined) setInput(snapInput);
                if (snapOutput !== undefined) setOutput(snapOutput);
                if (snapTime !== undefined) setExecutionTime(snapTime);
                isRemoteChange.current = false;
            });

            socket.on('language-change', ({
                language: remoteLang,
                code: remoteCode,
            }: {
                language: string;
                code?: string;
            }) => {
                if (!isMounted) return;
                isRemoteChange.current = true;
                setLanguage(remoteLang);
                const newCode = remoteCode ?? (LANGUAGES.find(l => l.value === remoteLang)?.defaultCode || '');
                setCode(newCode);
                if (editorRef.current) editorRef.current.setValue(newCode);
                isRemoteChange.current = false;
            });

            socket.on('users-update', async (users: string[]) => {
                if (!isMounted) return;
                setOnlineUsers(users);
                if (isMicEnabledRef.current && webrtcManagerRef.current) {
                    // Pass the updated users list to webrtc manager
                    await webrtcManagerRef.current.createConnectionsToAllUsers(users);
                }
            });

            socket.on('user-speaking', ({
                username: speakingUsername,
                isSpeaking: speaking,
            }: {
                username: string;
                isSpeaking: boolean;
            }) => {
                if (!isMounted) return;
                setSpeakingUsers((prev: Set<string>) => {
                    const newSet = new Set(prev);
                    if (speaking) {
                        newSet.add(speakingUsername);
                    } else {
                        newSet.delete(speakingUsername);
                    }
                    return newSet;
                });
            });

            socket.on('audio-broadcast-start', async ({
                username: broadcastingUsername,
            }: {
                username: string;
            }) => {
                // This event is no longer needed - connections are made when mic is enabled
            });

            socket.on('webrtc-offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
                if (!isMounted) {
                    console.warn('[WebRTC] Offer from', from, 'dropped: component unmounted');
                    return;
                }

                // Only handle offer if we have a manager (means our mic is enabled)
                // If we don't have a manager, we'll create one passively to receive audio
                if (!webrtcManagerRef.current) {
                    try {
                        webrtcManagerRef.current = (await import('@/lib/webrtc-manager')).createWebRTCManager({
                            roomId: roomId.trim(),
                            username: username,
                            onlineUsers: onlineUsersRef.current,
                            onRemoteTrack: handleRemoteTrackRef.current,
                            onConnectionChange: (userId: string, state: RTCPeerConnectionState) => {
                            },
                            onError: (userId: string, error: string) => {
                                console.error(`[WebRTC] Error for ${userId}:`, error);
                            },
                            socket: socket,
                        });
                    } catch (err) {
                        console.error('[WebRTC] Failed to initialize WebRTC manager:', err);
                        return;
                    }
                }

                try {
                    await webrtcManagerRef.current.handleOffer(from, offer);
                } catch (err) {
                    console.error('[WebRTC] Failed to handle offer from', from, ':', err);
                }
            });

            socket.on('webrtc-answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
                if (!isMounted || !webrtcManagerRef.current) {
                    return;
                }
                await webrtcManagerRef.current.handleAnswer(from, answer);
            });

            socket.on('webrtc-ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
                if (!isMounted || !webrtcManagerRef.current) {
                    return;
                }
                await webrtcManagerRef.current.handleIceCandidate(from, candidate);
            });

            socket.on('execution-start', () => {
                if (!isMounted) return;
                setOutput('⏳ Executing...');
                setExecutionTime(null);
            });

            socket.on('execution-result', ({
                output: remoteOutput,
                error,
                executionTime: time,
            }: {
                output: string;
                error?: string;
                executionTime: number;
            }) => {
                if (!isMounted) return;
                setExecutionTime(time);
                if (error) {
                    const combined = [remoteOutput, error].filter(Boolean).join('\n--- Error ---\n');
                    setOutput(combined);
                } else {
                    setOutput(remoteOutput || '(Program exited with no output)');
                }
            });

            socket.on('input-change', ({ input: remoteInput }: { input: string }) => {
                if (!isMounted) return;
                setInput(remoteInput);
            });
        };

        initSocket();

        return () => {
            isMounted = false;
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [roomId, username, toast]);
}
