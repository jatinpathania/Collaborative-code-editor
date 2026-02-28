import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export async function POST(request: NextRequest) {
  const tempDir = path.join(process.cwd(), "temp", uuidv4());

  try {
    const { code, language, input } = await request.json();

    if (!code || !language) {
      return NextResponse.json(
        { error: "Code and language are required" },
        { status: 400 }
      );
    }

    mkdirSync(tempDir, { recursive: true });

    // Write stdin input file — always write it (even empty) so we can always redirect
    const inputFile = path.join(tempDir, "input.txt");
    writeFileSync(inputFile, typeof input === "string" ? input : "");

    let dockerArgs: string[] = [];

    switch (language.toLowerCase()) {
      case "cpp": {
        writeFileSync(path.join(tempDir, "main.cpp"), code);
        dockerArgs = [
          "run", "--rm",
          "--network", "none",
          "--memory", "256m",
          "--cpus", "0.5",
          "-v", `${tempDir}:/app`,
          "-w", "/app",
          "gcc:latest",
          "sh", "-c",
          "g++ main.cpp -o output 2>compile_error.txt && ./output <input.txt 2>&1 || (cat compile_error.txt >&2 && exit 1)",
        ];
        break;
      }

      case "c": {
        writeFileSync(path.join(tempDir, "main.c"), code);
        dockerArgs = [
          "run", "--rm",
          "--network", "none",
          "--memory", "256m",
          "--cpus", "0.5",
          "-v", `${tempDir}:/app`,
          "-w", "/app",
          "gcc:latest",
          "sh", "-c",
          "gcc main.c -o output 2>compile_error.txt && ./output <input.txt 2>&1 || (cat compile_error.txt >&2 && exit 1)",
        ];
        break;
      }

      case "python": {
        writeFileSync(path.join(tempDir, "main.py"), code);
        dockerArgs = [
          "run", "--rm",
          "--network", "none",
          "--memory", "256m",
          "--cpus", "0.5",
          "-v", `${tempDir}:/app`,
          "-w", "/app",
          "python:3.11-alpine",
          "sh", "-c",
          "python main.py <input.txt 2>&1",
        ];
        break;
      }

      case "javascript": {
        writeFileSync(path.join(tempDir, "main.js"), code);
        dockerArgs = [
          "run", "--rm",
          "--network", "none",
          "--memory", "256m",
          "--cpus", "0.5",
          "-v", `${tempDir}:/app`,
          "-w", "/app",
          "node:18-alpine",
          "sh", "-c",
          "node main.js <input.txt 2>&1",
        ];
        break;
      }

      case "java": {
        writeFileSync(path.join(tempDir, "Main.java"), code);
        dockerArgs = [
          "run", "--rm",
          "--network", "none",
          "--memory", "256m",
          "--cpus", "0.5",
          "-v", `${tempDir}:/app`,
          "-w", "/app",
          "eclipse-temurin:17-jdk-alpine",
          "sh", "-c",
          "javac Main.java 2>compile_error.txt && java Main <input.txt 2>&1 || (cat compile_error.txt >&2 && exit 1)",
        ];
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unsupported language: ${language}` },
          { status: 400 }
        );
    }

    return await new Promise<NextResponse>((resolve) => {
      const docker = spawn("docker", dockerArgs, { timeout: 30000 });

      let stdout = "";
      let stderr = "";

      docker.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      docker.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      docker.on("close", (code: number | null) => {
        rmSync(tempDir, { recursive: true, force: true });

        if (code !== 0) {
          resolve(
            NextResponse.json({
              output: stdout,
              error: stderr || `Process exited with code ${code}`,
            })
          );
        } else {
          resolve(
            NextResponse.json({
              output: stdout || "(No output)",
            })
          );
        }
      });

      docker.on("error", (err: Error) => {
        rmSync(tempDir, { recursive: true, force: true });
        resolve(
          NextResponse.json({
            output: "",
            error: `Failed to run Docker: ${err.message}`,
          })
        );
      });
    });
  } catch (error) {
    // Clean up on unexpected errors
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { }
    return NextResponse.json(
      { error: "Execution failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}