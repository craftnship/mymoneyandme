/**
 * Renders a long message string as sections: blank-line separated blocks, where a
 * block starting with "## " is a heading and a block whose lines all start with
 * "- " is a list. Keeps legal and about copy editable in messages/<locale>.json
 * without a second content format.
 */
export function Prose({ text, className = "" }: { text: string; className?: string }) {
  // A heading line may be followed directly by its first paragraph; split it off so the body is never part of the h2.
  const blocks = text
    .split(/\n\s*\n/)
    .flatMap((b) => (b.trimStart().startsWith("## ") && b.includes("\n") ? [b.slice(0, b.indexOf("\n")), b.slice(b.indexOf("\n") + 1)] : [b]))
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className={`space-y-4 leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={i} className="text-xl font-semibold tracking-tight pt-4">
              {block.slice(3)}
            </h2>
          );
        }
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc ps-5 space-y-1.5">
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}
