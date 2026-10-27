import React from 'react';

/**
 * Removes dangerous script tags, event handlers, and javascript: protocols from HTML.
 */
export function sanitizeBulletinHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href="#"')
    .replace(/src\s*=\s*(['"])javascript:.*?\1/gi, '');
}

/**
 * Checks if the string contains HTML tags.
 */
export function isHtmlContent(content: string): boolean {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

/**
 * Strips HTML tags for clean plaintext summaries/excerpts.
 */
export function stripHtmlTags(content: string): string {
  if (!content) return '';
  return content
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/li>/gi, ' ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

interface BulletinContentProps {
  content: string;
  className?: string;
  theme?: 'light' | 'dark';
}

/**
 * Renders bulletin content either as sanitized rich HTML or plaintext with line breaks.
 */
export const BulletinContent: React.FC<BulletinContentProps> = ({
  content,
  className = '',
  theme = 'light',
}) => {
  if (!content) return null;

  const hasHtml = isHtmlContent(content);

  if (hasHtml) {
    const sanitized = sanitizeBulletinHtml(content);
    const linkColor = theme === 'dark' ? '[&_a]:text-emerald-400 [&_a:hover]:text-emerald-300' : '[&_a]:text-emerald-700 [&_a:hover]:text-emerald-900';
    const textColor = theme === 'dark' ? 'text-slate-200' : 'text-slate-700';

    return (
      <div
        className={`leading-relaxed text-xs sm:text-sm font-sans break-words ${textColor} ${linkColor} [&_a]:underline [&_a]:font-semibold [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2.5 [&_img]:shadow-sm [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-1.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:italic [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:p-1.5 [&_td]:border [&_td]:p-1.5 ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  return (
    <p
      className={`leading-relaxed whitespace-pre-line text-xs sm:text-sm font-sans ${
        theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
      } ${className}`}
    >
      {content}
    </p>
  );
};
