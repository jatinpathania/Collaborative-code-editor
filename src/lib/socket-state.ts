export const roomUsers = new Map<string, Map<string, string>>();
export const roomState = new Map<string, any>();

export function getRoomState(roomId: string) {
    if (!roomState.has(roomId)) roomState.set(roomId, {});
    return roomState.get(roomId);
}
