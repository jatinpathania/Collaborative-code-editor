interface ExecuteCodeParams {
  code: string;
  language: string;
  input?: string;
}

interface ExecuteCodeResponse {
  output: string;
  error?: string;
  executionTime: number;
}

const LANGUAGE_CONFIGS: Record<string, { image: string; command: string; extension: string }> = {
  javascript: {
    image: 'node:18-alpine',
    command: 'node',
    extension: 'js',
  },
  python: {
    image: 'python:3.11-alpine',
    command: 'python',
    extension: 'py',
  },
  java: {
    image: 'eclipse-temurin:17-jdk-alpine',
    command: 'java',
    extension: 'java',
  },
  cpp: {
    image: 'gcc:latest',
    command: 'g++ -o output main.cpp && ./output',
    extension: 'cpp',
  },
  c: {
    image: 'gcc:latest',
    command: 'gcc -o output main.c && ./output',
    extension: 'c',
  },
};

export async function executeCode({ code, language, input }: ExecuteCodeParams): Promise<ExecuteCodeResponse> {
  const config = LANGUAGE_CONFIGS[language.toLowerCase()];

  if (!config) {
    return {
      output: '',
      error: `Unsupported language: ${language}`,
      executionTime: 0,
    };
  }

  try {
    const startTime = Date.now();

    const renderUrl = process.env.NEXT_PUBLIC_RENDER_URL
    const response = await fetch(`${renderUrl}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, language, input }),
    });

    const data = await response.json();
    const executionTime = Date.now() - startTime;

    return {
      output: data.output || '',
      error: data.error,
      executionTime,
    };
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      executionTime: 0,
    };
  }
}
