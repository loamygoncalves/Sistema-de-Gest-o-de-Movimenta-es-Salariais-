"use client";

import React, { useCallback, useRef, useState } from "react";
import clsx from "@/lib/clsx";

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
  accept?: string;
  hint?: string;
  file?: File | null;
}

export function FileDropzone({ onFileSelected, accept = ".xlsx,.xls,.csv", hint, file }: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files && files.length > 0) {
        onFileSelected(files[0]);
      }
    },
    [onFileSelected]
  );

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3"
        />
      </svg>
      {file ? (
        <p className="text-sm font-medium text-slate-700">{file.name}</p>
      ) : (
        <p className="text-sm text-slate-600">
          Arraste um arquivo aqui ou{" "}
          <button
            type="button"
            className="font-medium text-brand-600 hover:underline"
            onClick={() => inputRef.current?.click()}
          >
            selecione no computador
          </button>
        </p>
      )}
      <p className="text-xs text-slate-400">{hint ?? `Formatos aceitos: ${accept}`}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
