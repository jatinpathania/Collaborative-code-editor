"use client";

import { useCallback } from 'react';

interface RemoteAudioHandlerProps {
    remoteAudioContextRef: React.MutableRefObject<AudioContext | null>;
    remoteAudioElementsRef: React.MutableRefObject<Map<string, { audio: HTMLAudioElement; source: MediaElementAudioSourceNode }>>;
}

export function useRemoteAudioHandler({
    remoteAudioContextRef,
    remoteAudioElementsRef,
}: RemoteAudioHandlerProps) {
    const ensureRemoteAudioContext = useCallback(() => {
        if (!remoteAudioContextRef.current) {
            try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                remoteAudioContextRef.current = audioCtx;

                if (audioCtx.state === 'suspended') {
                    const resumeAudio = () => {
                        audioCtx.resume().then(() => {
                            document.removeEventListener('click', resumeAudio);
                            document.removeEventListener('keydown', resumeAudio);
                        });
                    };
                    document.addEventListener('click', resumeAudio);
                    document.addEventListener('keydown', resumeAudio);
                }
            } catch (err) {
                console.error('[Audio] Failed to create audio context:', err);
            }
        }
        return remoteAudioContextRef.current;
    }, [remoteAudioContextRef]);

    const handleRemoteTrack = useCallback((userId: string, stream: MediaStream) => {
        if (!stream || stream.getAudioTracks().length === 0) {
            console.error(`[Audio] Stream from ${userId} has no audio tracks!`);
            return;
        }

        ensureRemoteAudioContext();

        const existing = remoteAudioElementsRef.current.get(userId);
        if (existing) {
            try {
                existing.audio.pause();
                existing.audio.srcObject = null;
                if (existing.audio.parentNode) {
                    document.body.removeChild(existing.audio);
                }
            } catch (e) {
                console.error(`[Audio] Error cleaning up old audio element for ${userId}:`, e);
            }
        }

        const audioElement = document.createElement('audio');
        audioElement.id = `audio-${userId}`;
        audioElement.autoplay = true;
        audioElement.controls = false;
        audioElement.muted = false;
        audioElement.defaultMuted = false;
        audioElement.style.display = 'none';
        audioElement.volume = 1;

        // Verify stream before assigning
        if (!audioElement.srcObject && stream) {
            audioElement.srcObject = stream;
        }

        document.body.appendChild(audioElement);

        const playPromise = audioElement.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise
                .then(() => {
                })
                .catch(err => {
                    console.error(`[Audio] Play failed for ${userId}:`, err.name, err.message);

                    // Retry on user interaction
                    const retryFn = () => {
                        audioElement.play()
                            .catch(e => console.error(`[Audio] Retry failed for ${userId}:`, e.message));
                        document.removeEventListener('click', retryFn);
                        document.removeEventListener('keydown', retryFn);
                        document.removeEventListener('touchstart', retryFn);
                    };
                    document.addEventListener('click', retryFn);
                    document.addEventListener('keydown', retryFn);
                    document.addEventListener('touchstart', retryFn);
                });
        }

        remoteAudioElementsRef.current.set(userId, { audio: audioElement, source: null as any });
    }, [ensureRemoteAudioContext, remoteAudioElementsRef]);

    return { handleRemoteTrack, ensureRemoteAudioContext };
}
