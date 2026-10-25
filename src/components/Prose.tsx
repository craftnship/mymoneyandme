/**
 * Renders a long message string as sections: blank-line separated blocks, where a
 * block starting with "## " is a heading and a block whose lines all start with
 * "- " is a list. Keeps legal and about copy editable in messages/<locale>.json
 * without a second content format.
 */
export function Prose({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
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
