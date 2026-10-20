import { open } from 'node:fs/promises';
import { extname } from 'node:path';

export const MAX_BYTES = 32 * 1024 * 1024;
export const FORMATS = new Set(['stl', 'obj', 'ply']);

/** Read only the explicitly opened model; do not accept paths from a webview. */
export async function readModel(filename: string): Promise<{format: string; base64: string}> {
    const format = extname(filename).slice(1).toLowerCase();
    if (!FORMATS.has(format)) throw new Error('Only local STL, OBJ and PLY files are supported.');
    const file = await open(filename, 'r');
    try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) {
            throw new Error('Open a regular model file between 1 byte and 32 MiB.');
        }
        // One extra byte detects growth without an unbounded readFile allocation.
        const data = Buffer.alloc(stat.size + 1);
        let total = 0;
        while (total < data.length) {
            const { bytesRead } = await file.read(data, total, data.length - total, total);
            if (!bytesRead) break;
            total += bytesRead;
        }
        if (total !== stat.size) throw new Error('The model changed while being read. Reopen it.');
        return {format, base64: data.subarray(0, total).toString('base64')};
    } finally { await file.close(); }
}
