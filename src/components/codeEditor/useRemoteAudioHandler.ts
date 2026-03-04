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
        console.log(`[Audio] Received remote track from ${userId}`, {
            streamId: stream.id,
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length,
        });

        if (!stream || stream.getAudioTracks().length === 0) {
            console.error(`[Audio] Stream from ${userId} has no audio tracks!`);
            return;
        }

        ensureRemoteAudioContext();

        const existing = remoteAudioElementsRef.current.get(userId);
        if (existing) {
            try {
                console.log(`[Audio] Cleaning up existing audio element for ${userId}`);
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

        console.log(`[Audio] Created audio element for ${userId}:`, {
            id: audioElement.id,
            autoplay: audioElement.autoplay,
            muted: audioElement.muted,
            defaultMuted: audioElement.defaultMuted,
            volume: audioElement.volume,
        });

        // Verify stream before assigning
        if (!audioElement.srcObject && stream) {
            audioElement.srcObject = stream;
            console.log(`[Audio] Assigned stream to audio element for ${userId}`);
        }

        document.body.appendChild(audioElement);
        console.log(`[Audio] Appended audio element to DOM for ${userId}`);

        const playPromise = audioElement.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise
                .then(() => {
                    console.log(`[Audio] ✓ Audio playing successfully for ${userId}`);
                })
                .catch(err => {
                    console.error(`[Audio] ✗ Play failed for ${userId}:`, err.name, err.message);

                    // Retry on user interaction
                    const retryFn = () => {
                        console.log(`[Audio] Retrying playback for ${userId} after user interaction`);
                        audioElement.play()
                            .then(() => {
                                console.log(`[Audio] ✓ Retry successful for ${userId}`);
                            })
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
        console.log(`[Audio] Registered audio element in ref map for ${userId}`);
    }, [ensureRemoteAudioContext, remoteAudioElementsRef]);

    return { handleRemoteTrack, ensureRemoteAudioContext };
}
