import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  const tempDir = path.join(os.tmpdir(), "code-editor", uuidv4());

  try {
    const { code, language, input } = await request.json();

    if (!code || !language) {
      return NextResponse.json(
        { error: "Code and language are required" },
        { status: 400 }
      );
    }

    mkdirSync(tempDir, { recursive: true });

    const inputFile = path.join(tempDir, "input.txt");
    writeFileSync(inputFile, typeof input === "string" ? input : "");

    let command = "";
    let args: string[] = [];

    switch (language.toLowerCase()) {
      case "cpp": {
        writeFileSync(path.join(tempDir, "main.cpp"), code);
        command = "sh";
        args = [
          "-c",
          `g++ "${path.join(tempDir, "main.cpp")}" -o "${path.join(tempDir, "output")}" 2>"${path.join(tempDir, "compile_error.txt")}" && "${path.join(tempDir, "output")}" <"${inputFile}" 2>&1 || (cat "${path.join(tempDir, "compile_error.txt")}" >&2 && exit 1)`,
        ];
        break;
      }

      case "c": {
        writeFileSync(path.join(tempDir, "main.c"), code);
        command = "sh";
        args = [
          "-c",
          `gcc "${path.join(tempDir, "main.c")}" -o "${path.join(tempDir, "output")}" 2>"${path.join(tempDir, "compile_error.txt")}" && "${path.join(tempDir, "output")}" <"${inputFile}" 2>&1 || (cat "${path.join(tempDir, "compile_error.txt")}" >&2 && exit 1)`,
        ];
        break;
      }

      case "python": {
        writeFileSync(path.join(tempDir, "main.py"), code);
        command = "sh";
        args = [
          "-c",
          `python3 "${path.join(tempDir, "main.py")}" <"${inputFile}" 2>&1`,
        ];
        break;
      }

      case "javascript": {
        writeFileSync(path.join(tempDir, "main.js"), code);
        command = "sh";
        args = [
          "-c",
          `node "${path.join(tempDir, "main.js")}" <"${inputFile}" 2>&1`,
        ];
        break;
      }

      case "java": {
        writeFileSync(path.join(tempDir, "Main.java"), code);
        command = "sh";
        args = [
          "-c",
          `javac "${path.join(tempDir, "Main.java")}" 1>"${path.join(tempDir, "compile_error.txt")}" 2>&1 && java -cp "${tempDir}" Main <"${inputFile}" 2>&1 || (cat "${path.join(tempDir, "compile_error.txt")}" >&2 && exit 1)`,
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
      const process = spawn(command, args, { timeout: 30000 });

      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      process.on("close", (code: number | null) => {
        // Delay cleanup slightly
        setTimeout(() => {
          try { rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
        }, 1000);

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

      process.on("error", (err: Error) => {
        try { rmSync(tempDir, { recursive: true, force: true }); } catch (e) { }
        resolve(
          NextResponse.json({
            output: "",
            error: `Failed to execute: ${err.message}`,
          })
        );
      });
    });
  } catch (error) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { }
    return NextResponse.json(
      { error: "Execution failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}