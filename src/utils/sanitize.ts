export function sanitizeInput(input: string): string {
  const element = document.createElement("div");
  element.textContent = input;
  return element.innerHTML;
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}