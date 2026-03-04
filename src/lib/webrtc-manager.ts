export interface WebRTCConfig {
    roomId: string;
    username: string;
    onlineUsers: string[];
    onRemoteTrack: (userId: string, stream: MediaStream) => void;
    onConnectionChange: (userId: string, state: RTCPeerConnectionState) => void;
    onError: (userId: string, error: string) => void;
    socket: any;
}

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    {
        urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    {
        urls: 'turn:numb.viagenie.ca',
        username: 'webrtc@example.com',
        credential: 'webrtc',
    },
];

export function createWebRTCManager(config: WebRTCConfig) {
    const peerConnections = new Map<string, RTCPeerConnection>();
    let localStream: MediaStream | null = null;

    function setLocalStream(stream: MediaStream | null) {
        localStream = stream;

        if (!stream) {
            peerConnections.forEach((pc) => {
                const senders = pc.getSenders();
                senders.forEach(sender => {
                    if (sender.track?.kind === 'audio') {
                        pc.removeTrack(sender);
                    }
                });
            });
            return;
        }

        const audioTracks = stream.getAudioTracks();

        if (audioTracks.length === 0) {
            return;
        }

        const audioTrack = audioTracks[0];

        peerConnections.forEach((pc, userId) => {
            const senders = pc.getSenders();
            const existingAudioSender = senders.find(s => s.track?.kind === 'audio');

            if (existingAudioSender) {
                existingAudioSender.replaceTrack(audioTrack).catch(err => {
                    try {
                        pc.removeTrack(existingAudioSender);
                        pc.addTrack(audioTrack, stream);
                    } catch (e) {
                        console.error(`[WebRTC] Failed to add audio track for ${userId}:`, e);
                    }
                });
            } else {
                try {
                    pc.addTrack(audioTrack, stream);
                } catch (e) {
                    console.error(`[WebRTC] Failed to add audio track for ${userId}:`, e);
                }
            }
        });
    }

    async function createPeerConnection(userId: string): Promise<RTCPeerConnection | null> {
        try {
            if (peerConnections.has(userId)) {
                const existing = peerConnections.get(userId)!;
                if (existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
                    return existing;
                }
            }

            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

            pc.onconnectionstatechange = () => {
                console.log(`[WebRTC] Connection state change for ${userId}: ${pc.connectionState}`);
                config.onConnectionChange(userId, pc.connectionState);

                if (pc.connectionState === 'failed') {
                    console.log(`[WebRTC] Connection to ${userId} failed, attempting ICE restart`);
                    pc.restartIce?.();
                } else if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
                    removePeerConnection(userId);
                }
            };

            pc.onicegatheringstatechange = () => { };

            pc.oniceconnectionstatechange = () => { };

            if (localStream) {
                const audioTracks = localStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    const audioTrack = audioTracks[0];
                    pc.addTrack(audioTrack, localStream);
                }
            }

            pc.ontrack = (event) => {
                if (event.track.kind === 'audio' && event.streams.length > 0) {
                    const stream = event.streams[0];
                    config.onRemoteTrack(userId, stream);
                }
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    config.socket.emit('webrtc-ice-candidate', {
                        to: userId,
                        roomId: config.roomId,
                        candidate: event.candidate,
                    });
                }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            config.socket.emit('webrtc-offer', {
                to: userId,
                roomId: config.roomId,
                offer: pc.localDescription,
            });

            peerConnections.set(userId, pc);
            return pc;
        } catch (error) {
            config.onError(userId, `Failed to create peer connection: ${error}`);
            return null;
        }
    }

    async function handleOffer(userId: string, offer: RTCSessionDescriptionInit): Promise<void> {
        try {
            let pc: RTCPeerConnection | null = peerConnections.get(userId) || null;

            if (pc && pc.signalingState === 'have-local-offer') {
                if (config.username < userId) {
                    return;
                } else {
                    removePeerConnection(userId);
                    pc = null;
                }
            }

            if (pc && pc.connectionState === 'connected' && pc.signalingState !== 'stable') {
                removePeerConnection(userId);
                pc = null;
            } else if (pc && pc.connectionState === 'connected' && pc.signalingState === 'stable') {
                removePeerConnection(userId);
                pc = null;
            }

            if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

                pc.onconnectionstatechange = () => {
                    config.onConnectionChange(userId, pc!.connectionState);

                    if (pc!.connectionState === 'failed') {
                        pc!.restartIce?.();
                    } else if (pc!.connectionState === 'closed' || pc!.connectionState === 'disconnected') {
                        removePeerConnection(userId);
                    }
                };

                pc.onicegatheringstatechange = () => { };

                pc.oniceconnectionstatechange = () => { };

                if (localStream) {
                    const audioTracks = localStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        const audioTrack = audioTracks[0];
                        pc.addTrack(audioTrack, localStream);
                    }
                }

                pc.ontrack = (event) => {
                    if (event.track.kind === 'audio' && event.streams.length > 0) {
                        const stream = event.streams[0];
                        config.onRemoteTrack(userId, stream);
                    }
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        config.socket.emit('webrtc-ice-candidate', {
                            to: userId,
                            roomId: config.roomId,
                            candidate: event.candidate,
                        });
                    }
                };

                peerConnections.set(userId, pc);
            }

            if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
                console.warn(`[WebRTC] Cannot handle offer from ${userId}, signaling state is ${pc.signalingState}`);
                return;
            }

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
            } catch (err) {
                throw err;
            }

            let answer;
            try {
                answer = await pc.createAnswer();
            } catch (err) {
                throw err;
            }

            try {
                await pc.setLocalDescription(answer);
            } catch (err) {
                throw err;
            }

            config.socket.emit('webrtc-answer', {
                to: userId,
                roomId: config.roomId,
                answer: pc.localDescription,
            });
        } catch (error) {
            config.onError(userId, `Failed to handle offer: ${error}`);
        }
    }

    async function handleAnswer(userId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        try {
            const pc = peerConnections.get(userId);
            if (!pc) {
                return;
            }

            if (pc.signalingState !== 'have-local-offer') {
                return;
            }

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                throw err;
            }
        } catch (error) {
            config.onError(userId, `Failed to handle answer: ${error}`);
        }
    }

    async function handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
        try {
            const pc = peerConnections.get(userId);
            if (!pc) {
                return;
            }

            if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                return;
            }

            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
            }
        } catch (error) {
        }
    }

    async function createConnectionsToAllUsers(usersToConnectTo?: string[]): Promise<void> {
        const targetUsers = usersToConnectTo || config.onlineUsers;
        const usersToConnect = targetUsers.filter(user => user !== config.username);

        for (const userId of usersToConnect) {
            const existing = peerConnections.get(userId);
            if (existing && (existing.connectionState === 'disconnected' || existing.connectionState === 'closed' || existing.connectionState === 'failed')) {
                removePeerConnection(userId);
            } else if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
                continue;
            }

            await createPeerConnection(userId);
        }
    }

    function removePeerConnection(userId: string): void {
        const pc = peerConnections.get(userId);
        if (pc) {
            pc.close();
            peerConnections.delete(userId);
        }
    }

    function closeAll(): void {
        peerConnections.forEach((pc) => {
            pc.close();
        });
        peerConnections.clear();
        localStream = null;
    }

    function getPeerConnections(): Map<string, RTCPeerConnection> {
        return new Map(peerConnections);
    }

    function hasPeerConnection(userId: string): boolean {
        const pc = peerConnections.get(userId);
        return pc !== undefined && pc.connectionState !== 'closed' && pc.connectionState !== 'failed';
    }

    return {
        setLocalStream,
        createPeerConnection,
        handleOffer,
        handleAnswer,
        handleIceCandidate,
        createConnectionsToAllUsers,
        removePeerConnection,
        closeAll,
        getPeerConnections,
        hasPeerConnection,
    };
}
