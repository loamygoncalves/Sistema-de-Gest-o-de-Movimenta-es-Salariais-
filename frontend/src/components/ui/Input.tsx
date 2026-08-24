import React from "react";
import clsx from "@/lib/clsx";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FieldWrapper({ label, error, hint, required, children }: FieldWrapperProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const baseInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, required, className, ...rest }: InputProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <input className={clsx(baseInputClass, error && "border-red-400", className)} {...rest} />
    </FieldWrapper>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, hint, required, options, placeholder, className, ...rest }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <select className={clsx(baseInputClass, error && "border-red-400", className)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, required, className, ...rest }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <textarea className={clsx(baseInputClass, "min-h-[90px]", error && "border-red-400", className)} {...rest} />
    </FieldWrapper>
  );
}
