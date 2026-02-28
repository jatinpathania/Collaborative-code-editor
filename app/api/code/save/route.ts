import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { roomId, code, language } = await request.json();

    if (!roomId || !code || !language) {
      return NextResponse.json(
        { error: 'Room ID, code, and language are required' },
        { status: 400 }
      );
    }

    const snapshot = await prisma.codeSnapshot.create({
      data: {
        roomId,
        code,
        language,
      },
    });

    return NextResponse.json({ success: true, snapshot });
  } catch (error) {
    console.error('Error saving code:', error);
    return NextResponse.json(
      { error: 'Failed to save code' },
      { status: 500 }
    );
  }
}
