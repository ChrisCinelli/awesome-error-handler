const requestAsCurl = require('request-as-curl');
const httpStatusCode = require('http-status-codes')
const merge = require('deepmerge');
const ejs = require('ejs');
const fs = require('fs');
const serveStatic = require('serve-static')

const moduleName = 'awesomeErrorHandler';

const debug = require('debug')(moduleName);
const colorize = require('./colorizeHTML');
const escapeHTML = require('./escapeHTML').escapeHTML;

let _logger; // NOTE: There is only one instance for process!
let _trycatch;

// Where fileName is name of the file and response is Node.js Reponse. 
function sendFile(filePath, res) {  
    // Check if file specified by the filePath exists 
    fs.exists(filePath, function(exists){
        if (exists) {     
          // Content-type is very interesting part that guarantee that
          // Web browser will handle response in an appropriate manner.
          res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            //"Content-Disposition": "attachment; filename=" + fileName
          });
          fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(400, {"Content-Type": "text/plain"});
          res.end("ERROR File does not exist");
        }
    });
}

class DefaultLogger {
    error() {
        console.error.apply(console, arguments);
    }

    warn() {
        console.warn.apply(console, arguments);
    }

    log() {
        console.log.apply(console, arguments);
    }

    // By default the debug is using the https://www.npmjs.com/package/debug and the text are hidden
    // If you want to show the messages run your process with DEBUG=awesomeErrorHandler
    debug() {
        debug.apply(debug, arguments);
    }
}

const defaultLogger = new DefaultLogger();

// function that add rawBody and rawBodyEncoding to the body parser
function rawBodySaverFnDefault(req, res, buf, encoding) {
    if (buf && buf.length) {
        // eslint-disable-next-line no-param-reassign
        req.rawBody = buf;
        // eslint-disable-next-line no-param-reassign
        req.rawBodyEncoding = encoding; // Do this only when necessary -> .toString(encoding || 'utf8');
    }
}

// Initialization function to be called as soon as possible when the node process start
// app is the express app (this is mandatory)
// logger (optional) is going to be used to log. It needs to have the classic 'error', 'log', 'debug' functions. You have only one shared. If you call initialize again on another app, the logger will be overridden.
// opts (optional) see below for the explanation  
function initialize({ app, logger, opts = {} }) {
    _logger = _logger || logger || defaultLogger;

    _logger.debug('initialize: called');
    _logger.debug('initialize: process.cwd()', process.cwd());

    const isProd = opts.isProd || process.env.NODE_ENV === 'production';
    const noLongAsyncTrace = opts.noLongAsyncTrace || process.env.LONG_STACK === 'false';

    // undefined -> if not in production -> `/${moduleName}` 
    // otherwise opts.reflectionMiddlewarePath
    const reflectionMiddlewarePath = opts.reflectionMiddlewarePath === undefined && !isProd && `/${moduleName}` || opts.reflectionMiddlewarePath;

    const _opts = merge({
        bodyParser: { // Options for bodyParser
            skip: false, // Do not install body parser
            limit: '20mb'
        },
        logFilter: undefined,                 // Function (data, req) that need to return an object with the properties to be logged. Default all `data`
        logDataFn: undefined,                 // Function use for logging (default: logData)
        logShortTrace: false,                 // If it true, it removes the lines in the stack trace that belong to node and node_modules
        rawBodySaverFn: undefined,            // Function used by bodyparser to store the rawBody on the request (Default: use rawBodySaverFnDefault) 
        skipTryCatch: false,                  // If true, it does not load trycatch. Async errors will crash the server is not addressed in other ways. No long stack. No colors.
        skipPromiseUnhandledRejection: false, // It does not set the unhandledRejection handler that console log the error
        noLongAsyncTrace,                     // If true, assuming skipTryCatch is false, it will not use long async trace. Long async trace are very useful for debugging but they are also introducing about a 10% overhead. Default LONG_STACK === 'false'
        skipNext: !isProd,                    // In prod the error is passed to the next error handler. You may have an extra handler to gracefully shutdown the process. 
        skipSendHtml: isProd,                 // In production, you do not want to send the HTML to the user
        skipSendJson: false,                  // Send json response with 'Accept': 'application/json'. It will have more or less data depending on isProd
        redirectUrl: undefined,               // In production, this is the url you  want to redirect in case of a 500 error. You can also add the redirectUtl on req. This can also be a function (data, req)
        extraDataFn: undefined,               // Function (data, req) that can return an object with the properties to displayed contracted in the HTML. Default nothing
        reflectionMiddlewarePath,             // Path where the middleware to change options will be installed. If false it does not install it. Default: `/${moduleName}`
        reflectionExtraMiddlewares: undefined,// Middleware to call before the refection on the reflectionMiddlewarePath. If can be use to implement authentication.
        monacoEditorFolder: undefined,        // Folder with the monaco-editor. By default try to require the editor to find the folder
        isProd                                // If true, assume that we are in the production environment. Default: NODE_ENV === 'production'
    }, opts);

    if (!app) {
        throw new Error(`${moduleName}: initialize requires "app"`);
    }
    if (app[moduleName] && app[moduleName].initialized) {
        _logger.debug('initialize: already initialized');
        return;
    }
    app[moduleName] = app[moduleName] || {};

    app[moduleName].initialized = true;
    app[moduleName].opts = _opts;
    _logger.debug(`initialize: opts = ${JSON.stringify(_opts, null, 4)}`);

    const mountPath = '/__aeh/';
    const mountEditorPath = `${mountPath}editor/`;
    let monacoEditorFolder = _opts.monacoEditorFolder;
    if (!monacoEditorFolder) {
        const detectMonacoFile = 'monaco-editor/esm/vs/editor/editor.main.js';
        try {
            monacoEditorFolder = require.resolve(detectMonacoFile);
            monacoEditorFolder = monacoEditorFolder.match(/^(.*)\/esm\/vs\/editor/)[1];
        } catch (err) {
            const pathSearch = require.resolve.paths && require.resolve.paths(detectMonacoFile).join('\n');
            const errorMessage = `ERROR cannot assign "monacoEditorFolder" to the path of the "monaco-editor". These paths were searched: \n${pathSearch}\nNOTE: The Editor will not work`;
            _logger.error(`initialize: ${errorMessage}`, err);
            //throw (new Error (errorMessage));
        }
    }
    if (monacoEditorFolder) {
        _logger.debug(`initialize: setting up a serveStatic route to "${mountEditorPath} for "${monacoEditorFolder}"`);
        app.use(mountEditorPath, serveStatic(monacoEditorFolder));
    } else {
        _logger.warn(`initialize: cannot serve "monaco-editor". awesome-error-handler will not fully work`);
    }

    // This gets the request data so it can be output for debugging purposes
    if (!_opts.bodyParser.skip) {
        const bodyParser = require('body-parser');
        const rawBodySaver = _opts.rawBodySaverFn || rawBodySaverFnDefault;

        app.use(bodyParser.json({
            verify: rawBodySaver,
            limit: _opts.bodyParser.limit || '20mb'
        }));
        app.use(bodyParser.urlencoded({
            verify: rawBodySaver,
            limit: _opts.bodyParser.limit || '20mb',
            extended: false
        }));
        app.use(bodyParser.raw({
            verify: rawBodySaver,
            type: '*/*'
        }));
        _logger.debug('initialize: adding bodyParser');
    } else {
        _logger.debug('initialize: SKIPPING bodyParser');
    }

    if (!_opts.skipTryCatch) {
        setupTryCatch();
    } else {
        _logger.debug('initialize: SKIPPING trycatch');
    }

    // If you do not like trycatch in prod, you can just leave this middleware in,
    // and use skipTryCatch.
    // Later you may be able turn on trycatch if you have to debug a problem

    _logger.debug('initialize: installing trycatch middleware.');
    if (_opts.skipTryCatch) _logger.debug('initialize: since skipTryCatch=true the trycatch middleware will not do anything');
    installTrycatchMiddleware({ app });

    if (_opts.reflectionMiddlewarePath) {
        _logger.debug('initialize: installing reflection middleware');
        installReflectionMiddleware({ 
            app, 
            path: _opts.reflectionMiddlewarePath,
            reflectionExtraMiddlewares: _opts.reflectionExtraMiddlewares
        });
    } else {
        _logger.debug('initialize: SKIPPING reflection middleware');
    }

    // unless explicitly skipped, log unhandled promises
    if (!_opts.skipPromiseUnhandledRejection) {
        _logger.debug('initialize: installing unhandledRejection new handler');
        process.on('unhandledRejection', err => _logger.error(err));
    } else {
        _logger.debug('initialize: SKIPPING unhandledRejection new handler');
    }
}

function installReflectionMiddleware({ app, path, reflectionExtraMiddleware = []}) {
    if (!app) {
        throw new Error(`${moduleName}: installReflectionMiddleware requires "app"`);
    }

    if (!path) {
        throw new Error(`${moduleName}: installReflectionMiddleware requires "path"`);
    }

    _logger.debug('installReflectionMiddleware: installing on app');
    app.get(path, reflectionExtraMiddleware, (req, res) => {
        let result = req[moduleName].opts;
        _logger.debug(`reflectionMiddleware: 'get' on ${req.query.keys} keys`);
        if (req.query.keys) {
            const partialResult = {};
            req.query.keys.split(',').map((el) => {partialResult[el] = result[el]});
            result = partialResult;
        }
        res.json(result);
    });

    app.post(path, reflectionExtraMiddleware, (req, res) => {
        let opts;
        if (req.body.kv) {
            opts = req[moduleName].opts;
            let kv = req.body.kv;
            try {
                kv = JSON.parse(req.query.kv);
            } catch(err) {
                // Nothing to do
            }
            _logger.debug(`reflectionMiddleware: 'post' with  ${JSON.stringify(kv)}`);
            if (typeof(kv) == 'object') Object.assign(opts, kv);
        }
        if (req.body.setupTryCatch){
            _logger.debug(`reflectionMiddleware: setupTryCatch`);
            setupTryCatch(!app[moduleName].opts.noLongAsyncTrace);
        }
        res.json({ updated: opts });
    });
}

function setupTryCatch(noLongAsyncTrace) {
    _logger.debug('initialize: adding trycatch');
    _trycatch = require('trycatch');
    _trycatch.configure({ colors : {
      'node': 'gray'
    , 'node_modules': 'white'
    , 'default': 'bold' 
    }});

    if (!noLongAsyncTrace) {
        _logger.debug('initialize: Enabling long-stack-traces on trycatch');
        _trycatch.configure({ 'long-stack-traces': true });
    } else {
        _logger.debug('initialize: long-stack-traces on trycatch NOT ENABLED');
    }
}

function installTrycatchMiddleware({ app }) {
    if (!app) {
        throw new Error(`${moduleName}: installTrycatchMiddleware requires "app"`);
    }
    if (!_trycatch) {
        _logger.debug(`installTrycatchMiddleware (make sure with opts.skipTryCatch=false)`);
    }
    _logger.debug('installTrycatchMiddleware: installing trycatch on app');
    app.use(async function (req, res, next) {
        if (!_trycatch){
            _logger.debug('TrycatchMiddleware: trycatch not installed');
            next();
        } else {
            _trycatch(next, next);
        }
    });
}

function compactStack(stack, {
    filterLineFn, // If it returns true
    removeNativeAndModules,
}) {
    if (!filterLineFn && !removeNativeAndModules) {
       // Nothing ot do. 
       return stack; 
    } 

    // It expect a function that returns a function 
    const _filterLineFn = filterLineFn && filterLineFn();

    return (`${stack }\n`).replace(colorize.regEx, (matchedText, code) => {
        if (_filterLineFn && !_filterLineFn(matchedText)) return;
        // TODO: These are magic number that come from the trycatch ANSI colors 
        if (removeNativeAndModules && code == 37 || code == 90) return '';
        return matchedText;
    });

    // We may want ot add 
    /// Not enough info? You may find useful to have long stack trace ()  the server with:
    // $ LONG_STACK=1 node index.js` || '';
}

function logDataFnDefault({ 
    data, 
    req, 
    logFilter, 
    logShortTrace,
    filterLineFn // Undefined by default but reusable if you are building ypu own logDataFn
}) {
    let logData = data;

    if (logFilter) {
        try {
            // Careful not to modify data!
            logData = logFilter(data, req);
        } catch (err) {
            _logger.error('logFilter throw an error. Skipping', err);
        }
    }

    _logger.error(
        'ERROR', 
        logData.code, logData.type || '', 
        '- method:', logData.method,
        '- originalUrl:', logData.originalUrl
    );

    if (logData.headers) _logger.error('headers:', JSON.stringify(logData.headers));
    if (logData.rawBody) _logger.error('rawBody:', JSON.stringify(logData.rawBody));
    if (logShortTrace) {
        if (logData.stack) _logger.error('(short) Stack:', compactStack(logData.stack, {    
            filterLineFn, 
            removeNativeAndModules: logShortTrace
        }));
    } else {
        if (logData.stack) _logger.error('Stack:', logData.stack);
    }
    if (logData.curlRequest) _logger.error('CURL-AS-REQUEST', logData.curlRequest);
}

/*
   This function render an error. On local development it will render on the screen
   the error. On the server it logs the error and the request so it can be reproduced
   Use err.statusCode (or req.statusCode if you really cannot do better) to force the error code otherwise it will return 500.
*/

const renderError = async (err, req, res, { 
        type, 
        skipSendHtml,
        skipSendJson,
        skipShortenFolders,
        extraDataFn,
        redirectUrl,
        logDataFn,
        logShortTrace,
        logFilter, 
        isProd
}) => {
    if (!isProd && req.path === '/__aehf' && req.query.file) {
        // TODO: check for root!
        return sendFile(req.query.file, res);
    }

    const code = err.statusCode || req.statusCode || 500;
    let _redirectUrl = req.redirectUrl || redirectUrl;
    let message;
    try {
        message = httpStatusCode.getStatusText(code);
    } catch(err) {
        message = 'Unknown HTTP code';
        _logger.debug('httpStatusCode.getStatusText', err);
    }
    
    let error = (err.stack || err);
    if (!skipShortenFolders) error = error.replace(new RegExp(process.cwd(), 'g'), '.');

    // 500 errors should never happen. If they do, we want to be able to understand what happened.
    const rawBody = req && req.rawBody && (req.rawBodyEncoding ? req.rawBody.toString(req.rawBodyEncoding || 'utf8') :  req.rawBody);

    const data = {};
    if (type) {
        data.type = type;
        if (code !== 500) {
            data.code = code;
            data.message = message;
        } else {
            data.message = 'Custom Error';
        }
    } else {
        data.code = code;
        data.message = message;
    }

    const jsonDataProd = Object.assign({}, data);

    data.stack = error;
   
    if (req) {
        data.method = req.method.toUpperCase();
        data.path = req.path;
        data.originalUrl = req.originalUrl;
        data.headers = req.headers;
        if (rawBody) data.rawBody = rawBody;
        data.curlRequest = requestAsCurl(req, rawBody);
    }

    if (extraDataFn) {
        try {
            data.extraData = await extraDataFn(data, req);
        } catch (err) {
            _logger.error('extraDataFn throw an error. Skipping extraData', err);
        }
    }

    const _logDataFn = logDataFn || logDataFnDefault;
    _logDataFn({ data, req, logFilter, logShortTrace });

    // With forceAwesomeErrorHandlerHtmlRendering = true on the request you can still see the awesome handler error HTML page
    if (req.forceAwesomeErrorHandlerHtmlRendering ||  req.accepts('html')) {
        if (req.forceAwesomeErrorHandlerHtmlRendering || !skipSendHtml) {
            // Development message
            ejs.renderFile(`${__dirname}/../views/error.ejs`, {
                ...data, 
                error, 
                colorize, 
                moduleOpts: req[moduleName].opts,
                inspect: require('util').inspect
            }, {}, function(err, html){
                if (err) {
                    const errorStr = `${moduleName}: PROBLEM RENDERING HTML`;
                    _logger.error(errorStr, err);
                    res.status(555).send('<pre>' + escapeHTML(`${errorStr}\n${err}` + '</pre>'));
                    return;
                } else {
                    if (!res.headerSent) {
                        res.status(code);
                        res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    }
                    res.end(html);
                }
            });
        } else if(_redirectUrl) {
            if (typeof _redirectUrl == 'function') _redirectUrl = _redirectUrl({data, req});
            return res.redirect(_redirectUrl);
        }
    } else if (!skipSendJson && req.accepts('json')) {
        // Development message
        if (!res.headerSent) {
            res.status(code);
        }
        res.json(isProd ? jsonDataProd : data);
    }
};

function ErrorHandlerMiddlewareFn({ filterFn, app, logger, opts } = {}) {
    if (app) {
        if (!app.isAwesomeErrorHanderInitialized) initialize({ app, logger, opts });
    }
    _logger.debug('ErrorHandlerMiddleware: initialization ensured');


    // error handlers are syntax dependent, so cannot get rid of next even though it is never used
    let _filterFn = () => false;

    if (filterFn) {
        if (filterFn instanceof RegExp) {
            _logger.debug('ErrorHandlerMiddleware: using a regex for filtering');
            _filterFn = (req) => filterFn.test(req.path);
        } else {
            if (typeof filterFn === 'function') {
                _logger.debug('ErrorHandlerMiddleware: using a function for filtering');
                _filterFn = filterFn;
            } else {
                _logger.debug('ErrorHandlerMiddleware: filterFn provided but it was not a function or a regEx -> no filtering');
            }
        }
    } else {
        _logger.debug('ErrorHandlerMiddleware: no filtering');
    }

    return function ErrorHandlerMiddleware(error, request, response, next) {
        // Attach the app
        if (app && app[moduleName]) request[moduleName] = app[moduleName];
        const _opts = ((opts || app && app[moduleName] && app[moduleName].opts) || {});

        if (_filterFn(request)) {
            _logger.debug('ErrorHandlerMiddleware: filtered -> rethrowing');
            // if request is expecting a JSON response, respond with a JSON error
            response.throw(error);
        } else {
            _logger.debug('ErrorHandlerMiddleware: rendering the error');
            renderError(error, request, response, _opts);
            if (!_opts.skipNext) {
                if (!response.headerSent) {
                    _logger.debug('ErrorHandlerMiddleware: header already sent SKIPPING calling next(error)');
                } else {
                    _logger.debug('ErrorHandlerMiddleware: calling next(error)');
                    next(error);
                }
            } else {
                _logger.debug('ErrorHandlerMiddleware: _opts.skipNext=true, SKIPPING calling next(error)');
            }
        }
    };
}

module.exports = ErrorHandlerMiddlewareFn;

Object.assign(module.exports, {
    DefaultLogger,
    logDataFnDefault,
    rawBodySaverFnDefault,
    initialize,
    compactStack,
    setupTryCatch,
    installTrycatchMiddleware,
    installReflectionMiddleware,
    renderError
});
