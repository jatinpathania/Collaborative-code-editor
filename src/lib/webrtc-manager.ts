export interface WebRTCConfig {
  roomId: string;
  username: string;
  onlineUsers: string[];
  onRemoteTrack: (userId: string, stream: MediaStream) => void;
  onConnectionChange: (userId: string, state: RTCPeerConnectionState) => void;
  onError: (userId: string, error: string) => void;
  socket: any;
}

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private config: WebRTCConfig;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  constructor(config: WebRTCConfig) {
    this.config = config;
  }

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    
    if (!stream) {
      this.peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        senders.forEach(sender => {
          if (sender.track?.kind === 'audio') {
            pc.removeTrack(sender);
          }
        });
      });
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    this.peerConnections.forEach((pc, userId) => {
      const senders = pc.getSenders();
      const existingAudioSender = senders.find(s => s.track?.kind === 'audio');
      
      if (existingAudioSender) {
        existingAudioSender.replaceTrack(audioTrack).catch(err => {
          console.error(`[WebRTC] Failed to replace audio track for ${userId}:`, err);
        });
      } else {
        pc.addTrack(audioTrack, stream);
      }
    });
  }

  async createPeerConnection(userId: string): Promise<RTCPeerConnection | null> {
    try {
      if (this.peerConnections.has(userId)) {
        const existing = this.peerConnections.get(userId)!;
        if (existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
          console.log(`[WebRTC] Peer connection already exists for ${userId}, skipping creation`);
          return existing;
        }
      }

      console.log(`[WebRTC] Creating peer connection to ${userId}`);
      const pc = new RTCPeerConnection({ iceServers: this.iceServers });
      
      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state changed for ${userId}: ${pc.connectionState}`);
        this.config.onConnectionChange(userId, pc.connectionState);
        
        if (pc.connectionState === 'failed') {
          console.log(`[WebRTC] Attempting ICE restart for ${userId}`);
          pc.restartIce?.();
        } else if (pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
          this.removePeerConnection(userId);
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log(`[WebRTC] ICE gathering state for ${userId}: ${pc.iceGatheringState}`);
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE connection state for ${userId}: ${pc.iceConnectionState}`);
      };

      if (this.localStream) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
          pc.addTrack(audioTrack, this.localStream);
          console.log(`[WebRTC] Added local audio track to ${userId}`);
        }
      }

      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received track from ${userId}:`, event.track.kind);
        if (event.track.kind === 'audio') {
          this.config.onRemoteTrack(userId, event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`[WebRTC] Sending ICE candidate to ${userId}`);
          this.config.socket.emit('webrtc-ice-candidate', {
            to: userId,
            roomId: this.config.roomId,
            candidate: event.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.config.socket.emit('webrtc-offer', {
        to: userId,
        roomId: this.config.roomId,
        offer: pc.localDescription,
      });

      console.log(`[WebRTC] Offer sent to ${userId}`);
      this.peerConnections.set(userId, pc);
      return pc;
    } catch (error) {
      console.error(`[WebRTC] Error creating peer connection to ${userId}:`, error);
      this.config.onError(userId, `Failed to create peer connection: ${error}`);
      return null;
    }
  }

  async handleOffer(userId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      let pc = this.peerConnections.get(userId);
      
      if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        console.log(`[WebRTC] Creating new peer connection for offer from ${userId}`);
        pc = new RTCPeerConnection({ iceServers: this.iceServers });

        pc.onconnectionstatechange = () => {
          console.log(`[WebRTC] Connection state changed for ${userId}: ${pc!.connectionState}`);
          this.config.onConnectionChange(userId, pc!.connectionState);
          
          if (pc!.connectionState === 'failed') {
            console.log(`[WebRTC] Attempting ICE restart for ${userId}`);
            pc!.restartIce?.();
          } else if (pc!.connectionState === 'closed' || pc!.connectionState === 'disconnected') {
            this.removePeerConnection(userId);
          }
        };

        pc.onicegatheringstatechange = () => {
          console.log(`[WebRTC] ICE gathering state for ${userId}: ${pc!.iceGatheringState}`);
        };

        pc.oniceconnectionstatechange = () => {
          console.log(`[WebRTC] ICE connection state for ${userId}: ${pc!.iceConnectionState}`);
        };

        if (this.localStream) {
          const audioTrack = this.localStream.getAudioTracks()[0];
          if (audioTrack) {
            pc.addTrack(audioTrack, this.localStream);
            console.log(`[WebRTC] Added local audio track to ${userId} (answerer)`);
          }
        }

        pc.ontrack = (event) => {
          console.log(`[WebRTC] Received track from ${userId}:`, event.track.kind);
          if (event.track.kind === 'audio') {
            this.config.onRemoteTrack(userId, event.streams[0]);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`[WebRTC] Sending ICE candidate to ${userId}`);
            this.config.socket.emit('webrtc-ice-candidate', {
              to: userId,
              roomId: this.config.roomId,
              candidate: event.candidate,
            });
          }
        };

        this.peerConnections.set(userId, pc);
      }

      console.log(`[WebRTC] Setting remote description for offer from ${userId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.config.socket.emit('webrtc-answer', {
        to: userId,
        roomId: this.config.roomId,
        answer: pc.localDescription,
      });

      console.log(`[WebRTC] Answer sent to ${userId}`);
    } catch (error) {
      console.error(`[WebRTC] Error handling offer from ${userId}:`, error);
      this.config.onError(userId, `Failed to handle offer: ${error}`);
    }
  }

  async handleAnswer(userId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(userId);
      if (!pc) {
        console.warn(`[WebRTC] No peer connection found for answer from ${userId}`);
        return;
      }

      console.log(`[WebRTC] Setting remote description for answer from ${userId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`[WebRTC] Remote description set for ${userId}`);
    } catch (error) {
      console.error(`[WebRTC] Error handling answer from ${userId}:`, error);
      this.config.onError(userId, `Failed to handle answer: ${error}`);
    }
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const pc = this.peerConnections.get(userId);
      if (!pc) {
        console.warn(`[WebRTC] No peer connection found for ICE candidate from ${userId}`);
        return;
      }

      console.log(`[WebRTC] Adding ICE candidate from ${userId}`);
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error(`[WebRTC] Error adding ICE candidate from ${userId}:`, error);
    }
  }

  async createConnectionsToAllUsers(): Promise<void> {
    const usersToConnect = this.config.onlineUsers.filter(user => user !== this.config.username);
    
    console.log(`[WebRTC] Creating connections to ${usersToConnect.length} users`);
    
    for (const userId of usersToConnect) {
      const existing = this.peerConnections.get(userId);
      if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
        console.log(`[WebRTC] Skipping ${userId}, connection already active`);
        continue;
      }

      await this.createPeerConnection(userId);
    }
  }

  removePeerConnection(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      console.log(`[WebRTC] Closing peer connection for ${userId}`);
      pc.close();
      this.peerConnections.delete(userId);
    }
  }

  closeAll(): void {
    console.log(`[WebRTC] Closing all ${this.peerConnections.size} peer connections`);
    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();
    this.localStream = null;
  }

  getPeerConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.peerConnections);
  }

  hasPeerConnection(userId: string): boolean {
    const pc = this.peerConnections.get(userId);
    return pc !== undefined && pc.connectionState !== 'closed' && pc.connectionState !== 'failed';
  }
}
