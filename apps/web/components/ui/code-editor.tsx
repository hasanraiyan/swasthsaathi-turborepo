"use client";

import * as React from "react";
import { cn } from "cn";

// One highlighter instance, shared and lazily created across every
// CodeEditor on the page — createHighlighter() loads grammars/themes and
// is too expensive to redo per editor or per keystroke.
let highlighterPromise: ReturnType<typeof loadHighlighter> | null = null;

const LANGS = [
  "markdown", "javascript", "jsx", "typescript", "tsx", "python", "ruby",
  "bash", "yaml", "json", "html", "css", "sql", "go", "rust", "java",
  "c", "cpp", "csharp", "php", "plaintext",
];
const THEMES = ["github-light", "github-dark"];

async function loadHighlighter() {
  const { createHighlighter } = await import("shiki");
  return createHighlighter({ themes: THEMES, langs: LANGS });
}

function getHighlighter() {
  if (!highlighterPromise) highlighterPromise = loadHighlighter();
  return highlighterPromise;
}

function isDarkMode() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  placeholder?: string;
  className?: string;
  spellCheck?: boolean;
}

/**
 * A <textarea> with a Shiki-highlighted backdrop synced behind it — the
 * textarea itself stays functionally a plain textarea (real selection,
 * caret, paste, undo) but renders with transparent text/caret-colored
 * caret, so the colored tokens underneath show through as you type.
 */
function CodeEditor({ value, onChange, language, placeholder, className, spellCheck }: CodeEditorProps) {
  const [html, setHtml] = React.useState("");
  const [dark, setDark] = React.useState(isDarkMode);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  // A visible scrollbar reserves width on the textarea but not on the
  // overlay div (which never shows one), so their text would wrap at
  // different columns once content is tall enough to scroll — the two
  // layers drift further apart the deeper into the content you go. Hiding
  // the textarea's native scrollbar (scroll still fully works) keeps both
  // layers' usable width identical always. scrollbar-width covers modern
  // Chrome/Firefox; the id-scoped rule below covers older WebKit.
  const scrollbarHideId = React.useId().replace(/[:]/g, "");

  React.useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(isDarkMode()));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    getHighlighter().then((highlighter) => {
      if (cancelled) return;
      const lang = highlighter.getLoadedLanguages().includes(language) ? language : "plaintext";
      try {
        const out = highlighter.codeToHtml(value.length ? value : " ", {
          lang,
          theme: dark ? "github-dark" : "github-light",
        });
        setHtml(out);
      } catch {
        setHtml("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value, language, dark]);

  const syncScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <style>{`.${scrollbarHideId}::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={overlayRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden p-4 font-mono text-sm leading-relaxed",
          "[&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!overflow-visible [&_pre]:whitespace-pre-wrap [&_pre]:break-words",
          "[&_code]:whitespace-pre-wrap [&_code]:break-words"
        )}
        style={{ tabSize: 2 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        placeholder={placeholder}
        spellCheck={spellCheck}
        className={cn(
          "relative h-full w-full resize-none whitespace-pre-wrap break-words border-0 bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-foreground outline-none placeholder:text-muted-foreground",
          scrollbarHideId
        )}
        style={{ fieldSizing: "fixed", tabSize: 2, scrollbarWidth: "none" } as React.CSSProperties}
      />
    </div>
  );
}

export { CodeEditor };
