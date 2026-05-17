import katex from "katex";

export function renderLatex(content: string | undefined | null): string {
  if (!content) return "";
  const parts = content.split(/(\$\$[\s\S]*?\$\$)/);
  return parts
    .map((part) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const math = part.slice(2, -2).trim();
        return katex.renderToString(math, {
          throwOnError: false,
          displayMode: true,
        });
      }
      
      const inlineParts = part.split(/(\$[^$\n]+?\$)/);
      return inlineParts
        .map((inline) => {
          if (
            inline.startsWith("$") &&
            inline.endsWith("$") &&
            inline.length > 2
          ) {
            const math = inline.slice(1, -1).trim();
            return katex.renderToString(math, {
              throwOnError: false,
              displayMode: false,
            });
          }
          return inline.replace(/\n/g, "<br>");
        })
        .join("");
    })
    .join("");
}
