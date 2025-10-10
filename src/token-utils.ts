/**
 * Utility functions for token estimation and file management
 */

export class TokenUtils {
  /**
   * Estimate token count for text
   * Rough approximation: 1 token ≈ 4 characters for English text
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Format token count for display
   */
  static formatTokenCount(tokens: number): string {
    if (tokens < 1000) {
      return `${tokens} tokens`;
    } else if (tokens < 1000000) {
      return `${(tokens / 1000).toFixed(1)}K tokens`;
    } else {
      return `${(tokens / 1000000).toFixed(1)}M tokens`;
    }
  }

  /**
   * Split text into chunks that fit within token limit
   */
  static splitByTokens(text: string, maxTokens: number): string[] {
    const estimatedTokens = this.estimateTokens(text);

    if (estimatedTokens <= maxTokens) {
      return [text];
    }

    // Split by sections (## headers in markdown)
    const sections = text.split(/(?=^##\s)/m);
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const section of sections) {
      const sectionTokens = this.estimateTokens(section);

      if (currentTokens + sectionTokens > maxTokens && currentChunk) {
        // Current chunk is full, save it and start new one
        chunks.push(currentChunk);
        currentChunk = section;
        currentTokens = sectionTokens;
      } else {
        currentChunk += section;
        currentTokens += sectionTokens;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Check if text exceeds token limit
   */
  static exceedsLimit(text: string, limit: number): boolean {
    return this.estimateTokens(text) > limit;
  }

  /**
   * Get file size info
   */
  static getFileSizeInfo(content: string): {
    bytes: number;
    kb: number;
    tokens: number;
    tokenFormatted: string;
  } {
    const bytes = Buffer.byteLength(content, 'utf-8');
    const kb = Math.round(bytes / 1024);
    const tokens = this.estimateTokens(content);

    return {
      bytes,
      kb,
      tokens,
      tokenFormatted: this.formatTokenCount(tokens)
    };
  }

  /**
   * Recommend split strategy based on token count
   */
  static recommendSplitStrategy(tokens: number, limit: number): {
    needsSplit: boolean;
    recommendedParts: number;
    message: string;
  } {
    if (tokens <= limit) {
      return {
        needsSplit: false,
        recommendedParts: 1,
        message: `File size (${this.formatTokenCount(tokens)}) is within limit`
      };
    }

    const recommendedParts = Math.ceil(tokens / limit);
    return {
      needsSplit: true,
      recommendedParts,
      message: `File size (${this.formatTokenCount(tokens)}) exceeds limit (${this.formatTokenCount(limit)}). Recommend splitting into ${recommendedParts} parts.`
    };
  }
}
