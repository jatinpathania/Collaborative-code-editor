"use client";

import React from 'react';
import Editor from '@monaco-editor/react';

interface EditorPanelProps {
    language: string;
    code: string;
    theme: string;
    onChange: (value: string | undefined) => void;
    onMount: (editor: any) => void;
}

export default function EditorPanel({
    language,
    code,
    theme,
    onChange,
    onMount,
}: EditorPanelProps) {
    return (
        <div className="flex-1 min-w-0 min-h-0">
            <Editor
                height="100%"
                language={language}
                value={code}
                theme={theme}
                onChange={onChange}
                onMount={onMount}
                options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    formatOnPaste: true,
                    formatOnType: true,
                }}
            />
        </div>
    );
}
