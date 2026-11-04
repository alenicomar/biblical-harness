/** Plain text of a verse: footnote markers and inline headings dropped, line breaks become spaces. */
export function verseText(items) {
    const parts = [];
    for (const item of items) {
        if (typeof item === 'string')
            parts.push(item);
        else if ('text' in item)
            parts.push(item.text);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}
/** Splits chapter content into verses and section headings (attached to the verse they precede). */
export function readChapter(content) {
    const verses = [];
    const headings = [];
    const pending = [];
    for (const item of content) {
        if (item.type === 'heading') {
            pending.push(item.content.join(' ').trim());
        }
        else if (item.type === 'verse') {
            for (const text of pending.splice(0))
                headings.push({ beforeVerse: item.number, text });
            for (const inline of item.content) {
                if (typeof inline !== 'string' && 'heading' in inline) {
                    headings.push({ beforeVerse: item.number, text: inline.heading });
                }
            }
            verses.push({ verse: item.number, text: verseText(item.content) });
        }
    }
    return { verses, headings };
}
