export {};

declare global {
  interface Window {
    mammoth?: {
      convertToHtml(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
    };
  }
}
