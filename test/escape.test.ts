import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../src/escape';

describe('escapeHtml', () => {
	it('encodes all five HTML-significant characters', () => {
		expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
	});

	it('neutralises a script-injection payload in block-page text', () => {
		// The block page interpolates customer title/body into HTML; a naive value
		// must not be able to break out into markup or a new tag.
		expect(escapeHtml('</title><script>alert(1)</script>')).toBe(
			'&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
		);
	});

	it('encodes & first so introduced entities are not double-encoded', () => {
		expect(escapeHtml('<')).toBe('&lt;');
		// A literal "&lt;" typed by the customer must render as text, not as "<".
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});

	it('leaves safe text unchanged', () => {
		expect(escapeHtml('Access Denied')).toBe('Access Denied');
	});
});
