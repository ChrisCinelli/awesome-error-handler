
const express = require('express');
const errorhandler = require('errorhandler');
const promisify = require('util').promisify;

let awesomeErrorHandler 
try {
    awesomeErrorHandler = require('awesome-error-handler');
    console.log('Using "awesome-error-handler"');
} catch (err) {
    awesomeErrorHandler = require('../lib/error-handler-mw');
    console.log('Using "../lib/error-handler-mw"');
}

const app = express();
const appAwesome = express();
const appExpressHandler = express();

const tryCatchOn = process.env.USE_TRYCATCH !== 'false';
console.log('process.env.USE_TRYCATCH', JSON.stringify(process.env.USE_TRYCATCH));
console.log('tryCatchOn', JSON.stringify(tryCatchOn));

awesomeErrorHandler.initialize({
    app: appAwesome,
    opts: {
        redirectUrl: '/oops',
        skipTryCatch: !tryCatchOn
    }
});

// Normal express config defaults
app.use(require('morgan')('dev', { skip: (req) => req.path.indexOf('/__aeh') === 0 }));
app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);
appAwesome.set('view engine', 'ejs');
appAwesome.set('views', `${__dirname}/views`);

app.get('/', (req, res) => {
    res.render('index', { tryCatchOn });
});

appAwesome.get('/syncError', (req, res) => {
    throw new Error('A sync error happened');
});

appAwesome.post('/syncErrorPost', (req, res) => {
    throw new Error('A sync error happened');
});

appAwesome.get('/asyncError', (req, res) => {
    setTimeout(() => {
        throw new Error('An async error happened -- This will crash the server if you skipTryCatch');
    }, 200);
});

function notZero(_n) {
    const n = +_n; // Coerce to number.
    if (!n) { // Matches +0, -0, NaN
        throw new Error(`Invalid dividend ${ n}`);
    }
    return n;
}

function divide(a, b, cb) {
    setTimeout(() => {
        const result = a / notZero(b);
        cb(null, result);
    }, 200);
}

function divideP(a, b) {
    return Promise.resolve(a / notZero(b));
}
const waitP = (t) => new Promise((resolve) => {
    setTimeout(() => resolve(true), t)
});


appAwesome.get('/divide', (req, res) => {
    setTimeout(() => {
        const a = req.query.a || 1;
        const b = req.query.b || 1;
        divide(a, b, (err, result) => {
            if (err) {
                res.statusCode(500);
                return res.json({ status: 'error', error: err });
            }
            res.json({ status: 'ok', a, b, result });
        });
    }, 200);
});

appAwesome.get('/asyncAwaitDivide', async (req, res) => {
    setTimeout(async () => {
        const a = req.query.a || 1;
        const b = req.query.b || 1;
        await waitP(100);
        const result = await divideP(a, b);
        res.json({ status: 'ok', a, b, result });
        // We willing ignore handling the error
    }, 200);
});

appAwesome.get('/promiseDivide', async (req, res) => {
    const a = req.query.a || 1;
    const b = req.query.b || 1;
    divideP(a, b).then((result) => {
        res.json({ status: 'ok', a, b, result });
        // We willing ignore handling the error
    });
});

appAwesome.get('/custom', (req, res) => {
    // You can use /custom?code= to test other codes
    req.statusCode = req.query.code || 501;
    throw new Error('A custom thingy');
});

appAwesome.get('/custom2', (req, res) => {
    const err = new Error('You can also attach custom codes to the error');
    err.statusCode = 502;
    throw err;
});

appAwesome.get('/api/ajax', (req, res) => {
    if (req.query.triggerError) {
        setTimeout(() => {
            throw new Error('An async error happened -- This will crash the server if you skipTryCatch');
        }, 200);
        return;
    }
    res.json({ response: 'We are good' });
});

appAwesome.get('/asyncErrorPromise', (req, res) => {
    setTimeout(() => {
        Promise.reject(new Error('An async error happened -- This will crash the server if you skipTryCatch'));
    }, 200);
});

appExpressHandler.get('/expressSyncErrorHandler', errorhandler(), (req, res) => {
    throw new Error('A sync error happened');
});

appExpressHandler.get('/expressAsyncErrorHandler', errorhandler(), (req, res) => {
    setTimeout(() => {
        throw new Error('An async error happened -- This will crash the server if you skipTryCatch');
    }, 200);
});

// The handler does not take care of "not found pages" you still need to manage them.
// You could still use the awesome error handler with err.statusCode = 404;
appAwesome.use((req, res) => {
    if (process.env.NODE_ENV !== 'production') {
        const err = new Error('We did not find any routes');
        err.statusCode = 404;
        throw err;
    } else {
        res.render('error404', { path: req.path });
    }
});

appAwesome.use(awesomeErrorHandler({ app: appAwesome }));

app.get('/oops', (req, res) => {
    res.render('error500');
});

app.use(appExpressHandler);
app.use(appAwesome);

// finally, let's start our server...
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${ server.address().port}`);
});
