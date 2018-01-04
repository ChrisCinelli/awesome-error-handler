const ESC_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#x60;'
};

const reverseMap = Object.keys(ESC_MAP).reduce((acc, val) => {
    const key = ESC_MAP[val];
    acc[key] = val; // eslint-disable-line no-param-reassign
    return acc;
}, {});

const escapeHTML = (str, forAttribute) => (
    str.replace(forAttribute ? /[&<>'"]/g : /[&<>]/g, (c) => ESC_MAP[c])
);

const unescapeHTML = (str, forAttribute) => {
    const regEx = forAttribute ? /&amp;|&lt;|&gt;|&quot;|&#39;|&#x60;/gi : /&amp;|&lt;|&gt;|&#x60;/gi;
    return str.replace(regEx, (c) => reverseMap[c]);
};

module.exports = {
    escapeHTML,
    unescapeHTML
};
