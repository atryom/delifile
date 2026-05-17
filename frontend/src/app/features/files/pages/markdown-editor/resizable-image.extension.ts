import { Image } from '@tiptap/extension-image';

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        // Parse both HTML width attribute and CSS style="width: Xpx"
        parseHTML: (el: HTMLElement) => {
          const attr = el.getAttribute('width');
          if (attr) return attr;
          const sw = el.style.width;
          return sw ? sw.replace(/px$/, '').trim() : null;
        },
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs['width']) return {};
          const w = /^\d+$/.test(String(attrs['width']))
            ? `${attrs['width']}px`
            : String(attrs['width']);
          return { style: `width: ${w}; max-width: 100%` };
        },
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          const { src, alt, title, width } = node.attrs as Record<string, string | null>;
          if (width) {
            const px = /^\d+$/.test(String(width)) ? `${width}px` : width;
            const altA  = alt   ? ` alt="${alt}"`     : '';
            const titleA = title ? ` title="${title}"` : '';
            state.write(`<img src="${src}"${altA}${titleA} style="width: ${px}; max-width: 100%">`);
          } else {
            const escapedAlt = state.esc(alt   ?? '');
            const escapedSrc = state.esc(src   ?? '');
            const titlePart  = title ? ` "${title.replace(/"/g, '\\"')}"` : '';
            state.write(`![${escapedAlt}](${escapedSrc}${titlePart})`);
          }
        },
        // parse: {} — markdown-it handles standard ![alt](src) and HTML img tags natively
        parse: {},
      },
    };
  },
});
