export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\0/g, '')
    .trim()
    .slice(0, 5000);
}

export function sanitizeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[char];
    })
    .replace(/\0/g, '')
    .trim()
    .slice(0, 5000);
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  return filename
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*\0]/g, '')
    .trim()
    .slice(0, 255);
}
