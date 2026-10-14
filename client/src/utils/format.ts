export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formatted = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${sizes[i]}`;
}
