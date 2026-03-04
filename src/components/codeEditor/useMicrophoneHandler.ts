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
            // Disable microphone - close everything
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(track => track.stop());
                micStreamRef.current = null;
            }
            if (volumeCheckIntervalRef.current) {
                clearInterval(volumeCheckIntervalRef.current);
                volumeCheckIntervalRef.current = null;
            }
            // Close all WebRTC connections and reset manager
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
            // Enable microphone
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioTracks = stream.getAudioTracks();
                
                if (audioTracks.length === 0) {
                    console.error('[Mic] ERROR: Stream has no audio tracks!');
                    toast({ title: 'Error', description: 'Microphone stream has no audio tracks', variant: 'destructive' });
                    return;
                }

                const audioTrack = audioTracks[0];

                micStreamRef.current = stream;
                setIsMicEnabled(true);
                toast({ title: 'Microphone Enabled' });

                // Create a FRESH WebRTC manager with our audio stream
                // This ensures all connections are created with audio from the start
                if (socketRef.current) {
                    // Make sure old one is closed (safety check)
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
                            console.error(`[WebRTC] Error for ${userId}:`, error);
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
                    // Broadcast audio to all other users in the room
                    const otherUsers = onlineUsers.filter(u => u !== username);
                    await webrtcManagerRef.current.createConnectionsToAllUsers(otherUsers);
                }

                // Broadcast to room that audio is now available
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
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to access microphone', variant: 'destructive' });
            }
        }
    }, [isMicEnabled, roomId, username, onlineUsers, socketRef, webrtcManagerRef, audioContextRef, analyserRef, micStreamRef, volumeCheckIntervalRef, isSpeakingRef, handleRemoteTrack, setIsMicEnabled, setIsSpeaking, toast]);

    return { handleMicrophoneToggle };
}
