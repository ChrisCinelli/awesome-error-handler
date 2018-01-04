const { escapeHTML, unescapeHTML } = require('./escapeHTML');

describe('escapeHTML', () => {
    it('should not change the value of a string after escaping and unescaping', () => {
        const testStr = '&quot;&quot;Test&quot;&quot;"';
        expect(unescapeHTML(escapeHTML(testStr))).toEqual(testStr);
    });

    it('should remove script tags', () => {
        const testStr = '<script>hey dude</script>';
        expect((escapeHTML(testStr).indexOf('<script>'))).toEqual(-1);
    });
});
