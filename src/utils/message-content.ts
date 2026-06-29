export function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "type" in part) {
          const block = part as { type: string; text?: string };
          if (block.type === "text" && block.text) {
            return block.text;
          }
        }

        return "";
      })
      .join("");
  }

  return content != null ? String(content) : "";
}
