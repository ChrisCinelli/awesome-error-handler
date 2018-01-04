const escapeHTML = require('./escapeHTML').escapeHTML;

const defaultColorMap = ['node', 'default', 'modules', '', ''];
// eslint-disable-next-line no-control-regex
const regEx = new RegExp('\x1b\\[([0-9]{1,2})m(.*)\x1b\\[[0-9]{2}m.*\n', 'g');
// eslint-disable-next-line no-control-regex
const regExNoTrycatch = new RegExp('([^\n]*)\n', 'g');
const extraNodeRegEx = new RegExp('((\\(internal)|(at internal))');

const V8_OUTER1 = /^\s*(eval )?at (.*) \((.*)\)$/;
const V8_OUTER2 = /^\s*at()() (\S+)$/;
// eslint-disable-next-line no-useless-escape
const V8_INNER = /^\(?([^\(]+):(\d+):(\d+)\)?$/;

function parseV8Line(line) {
    const outer = line.match(V8_OUTER1) || line.match(V8_OUTER2);
    if (!outer) return null;
    const inner = outer[3].match(V8_INNER);
    if (!inner) return null;

    let method = outer[2] || '';
    if (outer[1]) method = `eval at ${ method}`;
    return {
        method,
        location: inner[1] || '',
        line: parseInt(inner[2]) || 0,
        column: parseInt(inner[3]) || 0
    };
}

// TODO: Support other editors beside VSCode
function getEditorLink(data, { noLineCol, prefix = 'vscode://file/', noAbsolutize } = {}) {
    return `${prefix || ''}${data.location[0] === '.' && (!noAbsolutize && `${process.cwd() }/`) || ''}${data.location}${!noLineCol && data.line && `:${data.line}` || ''}${!noLineCol && data.column && `:${data.column}` || ''}`;
}

const path = require('path')
const node_modules = path.sep + 'node_modules' + path.sep;
// Used if trycatch is not enabled
function trycatchFormatter(line) {
    var type
  
    if (line.indexOf(node_modules) >= 0) {
        type = 'modules'
    } else if (line.indexOf(path.sep) >= 0) {
        type = 'default'
    } else if (line.substring(0, 5) === 'Error') {
        return undefined;
    } else {
        type = 'node'
    }

    return type;
}

// TODO: properly escape HTML everywhere

// Note: 
// maxFilenameLength tries to keep the files in a column and the method in the other
// Before maxFilenameLength reaches the ax size, the lines may be not completely aligned
// This is done to avoid iterating twice on the trace.  
let maxFilenameLength = 20;

function colorizeLine(text, colorStr) {
    const lineObj = parseV8Line(text);
    if (!lineObj) return `<span class="line ${colorStr}">  ${ text.trim() }<br /></span>`;
    const link = colorStr !== 'node' && getEditorLink(lineObj);
    const nakedLink = colorStr !== 'node' && getEditorLink(lineObj, { noLineCol: true }) || '';
    const linkText = getEditorLink(lineObj, { prefix: false,  noAbsolutize: true}) || '';
    if (linkText.length > maxFilenameLength) maxFilenameLength = linkText.length;

    return `<span class="line ${ colorStr }" data-link='${ nakedLink }' data-loc='${ lineObj.location }' data-line='${ lineObj.line }' data-col='${ lineObj.column }'>  at ${link && `<a class='link' href="${link}">` || ''}${ escapeHTML(linkText) }${link && `</a>` || ''}${ ' '.repeat(maxFilenameLength - linkText.length + 1) } ${escapeHTML(lineObj.method)}<br /></span>`;
}

// Colorize an escape sequence for console in HTML.
function colorize(str, colorMap = defaultColorMap) {
    // eslint-disable-next-line arrow-body-style
    let lines = 0;
    let formattedHtml = (`${str }\n`).replace(regEx, (_, color, text) => {
        lines++;
        let colorStr = colorMap[color % colorMap.length];
        if (extraNodeRegEx.test(text)) colorStr = 'node';
        return colorizeLine(text, colorStr);
    });

    if (!lines) formattedHtml = (`${str }\n`).replace(regExNoTrycatch, (_, text) => {
        lines++;
        let colorStr = trycatchFormatter(text);
        if (extraNodeRegEx.test(text)) colorStr = 'node';
        return colorizeLine(text, colorStr);
    });

    return formattedHtml;
}

colorize.regEx = regEx;

module.exports = colorize;
