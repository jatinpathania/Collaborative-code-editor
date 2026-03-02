import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { roomName, username } = await request.json();

    if (!roomName || !username) {
      return NextResponse.json(
        { error: 'Room name and username are required' },
        { status: 400 }
      );
    }

    // Create or get existing room
    let room = await prisma.room.findUnique({
      where: { name: roomName },
    });

    if (!room) {
      room = await prisma.room.create({
        data: { name: roomName },
      });
    }

    // Check if user already exists in room
    const existingUser = await prisma.user.findUnique({
      where: {
        username_roomId: {
          username,
          roomId: room.id,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json({ room, user: existingUser });
    }

    // Create user in room
    const user = await prisma.user.create({
      data: {
        username,
        roomId: room.id,
      },
    });

    return NextResponse.json({ room, user });
  } catch (error) {
    console.error('Error creating/joining room:', error);
    return NextResponse.json(
      { error: 'Failed to create/join room' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        users: true,
        codeSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}
