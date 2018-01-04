# Awesome Error Handler for Express

Accelerate your development.

Stacktraces may be very long and noisy. Console output can also be too noisy.

Express default error handling is just ok but lets you define you own error handlers](https://expressjs.com/en/guide/error-handling.html)

The npm module [errorhandler](https://github.com/expressjs/errorhandler) improves it but does not fix it.

This module will make express error handling *awesome*.

Click on the video for a 2:30 minutes demo:

[![Awesome Error Handler SHORTER-GIFSICLE](https://user-images.githubusercontent.com/38021940/65649687-7584e480-dfbc-11e9-99f4-55b27e06c704.gif)](https://youtu.be/aumU0dolLUg)

## Intro

Awesome Error Handler wants to give engineers a faster and better development experience and be still usable in production.

## Simple use
``` javascript
const awesomeErrorHandler = require('awesome-error-handler');

const app = express();
// Initialize some middleware helpers
awesomeErrorHandler.initialize({ app });

///
/// ... All your middlewares and routes go here ...
///

// The error route in express needs to be registered last so "next(error)" can handle the error
app.use(awesomeErrorHandler({ app }));
```

## Features

During development it aims to dramatically speedup the development process using a browser and Visual Studio Code.
I wanted to keep it useful on the server side too but it needs work to make it generic enough.

### Catching asynchronous errors and coloring of trace line (with [trycatch](https://www.npmjs.com/package/trycatch))

Currently a lot of node modules still use asynchronous primitive with callbacks.
Unfortunately there is no simple way to intercept those error. 
The standard `try...catch` cannot catch these errors.

```
// Simple example
try { 
  setTimeout(() => throw new Error('Catch me if you can'), 0); // This will crash your server!
} catch (err) {
  // This will NOT execute!
  console.error('Error:', err);
}
```

In a better future when all modules will use `async/await` and the `Promise` API, error handling in Javascript will be a lot simpler. But at the moment this is the status quo.

[Trycatch](https://www.npmjs.com/package/trycatch):
- Prevent your sever from crashing wrapping all request. This is definitely good in dev mode. In production it would be good using `cluster` and gracefully shut down the worker and start a new one so memory is cleaned unless you do proper clean up.
- Colorizes the stack trace so it is easy to recognize the trace from the code in your repo.
- Give you a long stack trace that shows where the error originated in the chain of asynchronous calls.

It is doing some magic and wrap all node asynchronous Node APIs so it can catch those errors. I thought it was crazy but I learned to appreciate its monkey patching that save a lot of time in development. In these days the [`async_hooks`](https://nodejs.org/api/async_hooks.html) would be used. 

Another similar npm module you may be familiar with that does something similar is [longjohn](https://www.npmjs.com/package/longjohn).

### Errors in the browser
When you have an an unhandled error in a route, you will see a page with the detail about the HTTP error, stack trace and other data in the request.

#### Fully keyboard support
You can navigate the stack trace with the keyboard.

#### Full Integration with VSCode
Click on the stacktrace in terminal (integetion with iTerm2 on Mac) or double clicking on the editor in the browser will teleport you in the same spot in Visual Studio Code.

### Do not leak data to the clients in production
In production we want to avoid to return to the client (usually the browser) stack traces or other sensitive information. The default behavior is not to show the detailed error to the user but track everything in the logs.

### Request as curl 
An error will show and a CURL request that can easily be used from command line to replicate the call.

### Highly customizable
Awesome Error Handler try to use good defaults but giving the flexibility necessary for most use cases and customization. 
For example , you may want to use your own logger that use your own format.   


# Hotkeys
- <Esc> Close the editor
- <Arrow Up> and <Arrow Down> navigate the stack trace
- <Tab> switch between editor and stack trace. <Left> also move from the stack trace to the editor 
- <Enter> on the editor open VSCode on that specific position
- Navigation items have an underlined letter. Pressing that letter toggle them


# Other art and resources

I keep these here for me and whoever need reference about tools that make stack traces easier to use.

### Long Stack trace
- https://github.com/CrabDude/trycatch
  - [Trycatch problem with promise](https://github.com/CrabDude/trycatch/issues/47)
  - [Problem with generic errors](https://github.com/CrabDude/trycatch/issues/52)
  - [Chris Cinelli's fork](https://github.com/ccinelli/trycatch)
  - https://github.com/CrabDude/hookit
- Promise stack trace 
  - https://github.com/mvaldesdeleon/long-promise (use the https://nodejs.org/api/async_hooks.html node API)
  - https://gist.github.com/joeytwiddle/8c357b8a4ac6803a0f188d495901b6bc (Long Stack Support for ES6 Promises.js)
  - http://bluebirdjs.com/docs/api/promise.longstacktraces.html
  - [Node changes with `--async-stack-traces` in Feb 2019](https://v8.dev/blog/v8-release-73) 
- https://github.com/AndreasMadsen/trace - Very promising replacement but without async try...catch support
- `async_hooks` (`node -v > 8.9`)
  - https://www.npmjs.com/package/async-hook-domain Domains implemented with `async_hooks`
  - [Intro to `async_hooks`](https://itnext.io/a-pragmatic-overview-of-async-hooks-api-in-node-js-e514b31460e9)
  - https://airbrake.io/blog/nodejs-error-handling/err_async_callback
  - https://medium.com/autodesk-tlv/async-hooks-a-whole-new-world-of-opportunities-a1a6daf1990a

- Other `npm` modules
  - https://www.npmjs.com/package/trycatch
  - https://www.npmjs.com/package/nn-node-stacktrace
  - https://www.npmjs.com/package/erotic !!!
  - https://www.npmjs.com/package/async-stacktrace
  - https://github.com/olstenlarck/clean-stacktrace
  - https://www.npmjs.com/package/deepstack

### Stack formatting
- https://github.com/poppinss/youch
- https://github.com/AriaMinaei/pretty-error
- https://github.com/googlearchive/stacky
- https://www.npmjs.com/package/stack
- https://github.com/shinnn/neat-stack

### Frontend stack capturing
- https://github.com/stacktracejs/stacktrace.js/

### Awesome nodejs
- https://github.com/sindresorhus/awesome-nodejs#debugging--profiling
- https://github.com/valyouw/njstrace
- https://github.com/watson/stackman

### Error handlers
- https://github.com/expressjs/errorhandler
- https://gist.github.com/zcaceres/2854ef613751563a3b506fabce4501fd
- Alex Liu (Netflix) - To Err Is Human: https://vimeo.com/179274736 - Pretty good for beginners/intermediate

### Debugging node
- https://medium.com/netflix-techblog/debugging-node-js-in-production-75901bb10f2d

# Notes

- At the moment this is not the best code I wrote. It was not born as a one independent module. I used bit and pieces of this plugin on servers. The initial version of this code handler is pretty old and I did not have some tools/framework/modules I use today.
- Please be patient. This is my first attempt to make this available to everybody quickly. I added code to a template I was using for other things.
- I also wanted to keep it relatively independent of big framework. I am considering a refactoring of the frontend code to use Svelte.
- A good test suite is needed.
- Production mode is not perfect. And different companies have their own internal tools and peculiar ways on how exception are handled. Ideally this will set a good default but it is still a work in progress.

# Licence

[Mozilla Public License 2](https://www.mozilla.org/en-US/MPL/2.0/) 

What I really care about: 
- You can do what you want with the code. I will try to help to fix problems but I am NOT liable for it.
- If you make improvements, please share. Make your changes available to everybody. The best way is probably forking this repo so your changes can be easily found on Github. Prefer submitting a PR so everybody will be able to take advantage of your code.

# Contributors
- [Chris Cinelli](https://github.com/chriscinelli) ([alias](https://github.com/ccinelli))
- Maybe you ? =)
