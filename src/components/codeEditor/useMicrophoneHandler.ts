"use client";

import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { createWebRTCManager } from '@/lib/webrtc-manager';

interface MicrophoneHandlerProps {
    roomId: string;
    username: string;
    onlineUsers: string[];
    isMicEnabled: boolean;
    webrtcManagerRef: React.MutableRefObject<any>;
    micStreamRef: React.MutableRefObject<MediaStream | null>;
    volumeCheckIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
    audioContextRef: React.MutableRefObject<AudioContext | null>;
    analyserRef: React.MutableRefObject<AnalyserNode | null>;
    isSpeakingRef: React.MutableRefObject<boolean>;
    socketRef: React.MutableRefObject<Socket | null>;
    setIsMicEnabled: (enabled: boolean) => void;
    setIsSpeaking: (speaking: boolean) => void;
    handleRemoteTrack: (userId: string, stream: MediaStream) => void;
    toast: any;
}

export function useMicrophoneHandler({
    roomId,
    username,
    isMicEnabled,
    onlineUsers,
    socketRef,
    webrtcManagerRef,
    audioContextRef,
    analyserRef,
    micStreamRef,
    volumeCheckIntervalRef,
    isSpeakingRef,
    handleRemoteTrack,
    setIsMicEnabled,
    setIsSpeaking,
    toast,
}: MicrophoneHandlerProps) {
    const handleMicrophoneToggle = useCallback(async () => {
        if (isMicEnabled) {
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(track => track.stop());
                micStreamRef.current = null;
            }
            if (volumeCheckIntervalRef.current) {
                clearInterval(volumeCheckIntervalRef.current);
                volumeCheckIntervalRef.current = null;
            }
            if (webrtcManagerRef.current) {
                webrtcManagerRef.current.closeAll();
                webrtcManagerRef.current = null;
            }
            if (isSpeakingRef.current && socketRef.current) {
                socketRef.current.emit('user-speaking', { roomId, username, isSpeaking: false });
                isSpeakingRef.current = false;
                setIsSpeaking(false);
            }
            setIsMicEnabled(false);
            toast({ title: 'Microphone Disabled' });
        } else {
            try {
                // Check if running in secure context (HTTPS or localhost)
                const isSecureContext = typeof window !== 'undefined' && 
                    (window.isSecureContext || 
                     window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1');

                if (!isSecureContext) {
                    toast({ 
                        title: 'Error', 
                        description: 'Microphone requires HTTPS. Please access your app using a secure connection (https://).',
                        variant: 'destructive' 
                    });
                    return;
                }

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    toast({ 
                        title: 'Error', 
                        description: 'Your browser does not support microphone access. Please use a modern browser.',
                        variant: 'destructive' 
                    });
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioTracks = stream.getAudioTracks();
                
                if (audioTracks.length === 0) {
                    toast({ title: 'Error', description: 'Microphone stream has no audio tracks', variant: 'destructive' });
                    return;
                }

                const audioTrack = audioTracks[0];

                micStreamRef.current = stream;
                setIsMicEnabled(true);
                toast({ title: 'Microphone Enabled' });

                if (socketRef.current) {
                    if (webrtcManagerRef.current) {
                        webrtcManagerRef.current.closeAll();
                    }
                    webrtcManagerRef.current = createWebRTCManager({
                        roomId,
                        username,
                        onlineUsers,
                        onRemoteTrack: handleRemoteTrack,
                        onConnectionChange: (userId: string, state: RTCPeerConnectionState) => {
                        },
                        onError: (userId: string, error: string) => {
                            toast({
                                title: 'Connection Error',
                                description: `Error with ${userId}: ${error.slice(0, 60)}...`,
                                variant: 'destructive',
                            });
                        },
                        socket: socketRef.current,
                    });
                }

                if (webrtcManagerRef.current) {
                    webrtcManagerRef.current.setLocalStream(stream);
                    const otherUsers = onlineUsers.filter(u => u !== username);
                    await webrtcManagerRef.current.createConnectionsToAllUsers(otherUsers);
                }

                if (socketRef.current) {
                    socketRef.current.emit('audio-broadcast-start', { roomId, username });
                }

                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioContextRef.current = audioContext;
                const analyser = audioContext.createAnalyser();
                analyserRef.current = analyser;
                analyser.fftSize = 256;
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                volumeCheckIntervalRef.current = setInterval(() => {
                    analyser.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    const wasRecent = average > 20;

                    if (wasRecent && !isSpeakingRef.current) {
                        isSpeakingRef.current = true;
                        setIsSpeaking(true);
                        if (socketRef.current) {
                            socketRef.current.emit('user-speaking', { roomId, username, isSpeaking: true });
                        }
                    } else if (!wasRecent && isSpeakingRef.current) {
                        isSpeakingRef.current = false;
                        setIsSpeaking(false);
                        if (socketRef.current) {
                            socketRef.current.emit('user-speaking', { roomId, username, isSpeaking: false });
                        }
                    }
                }, 100);
            } catch (error: any) {
                let errorMessage = 'Failed to access microphone';
                
                console.error('[Audio] Error:', error.name, error.message);
                
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Microphone permission denied. Please grant permission in your browser settings.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'No microphone found. Please connect a microphone device.';
                } else if (error.name === 'NotReadableError') {
                    errorMessage = 'Microphone is already in use by another application.';
                } else if (error.name === 'SecurityError') {
                    errorMessage = 'Security error: HTTPS is required for microphone access. Please ensure you\'re using a secure connection (https://).';
                } else if (error.name === 'TypeError') {
                    errorMessage = 'Microphone access error. Please ensure the app is accessed via HTTPS and permissions are granted.';
                }
                
                toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
            }
        }
    }, [isMicEnabled, roomId, username, onlineUsers, socketRef, webrtcManagerRef, audioContextRef, analyserRef, micStreamRef, volumeCheckIntervalRef, isSpeakingRef, handleRemoteTrack, setIsMicEnabled, setIsSpeaking, toast]);

    return { handleMicrophoneToggle };
}
