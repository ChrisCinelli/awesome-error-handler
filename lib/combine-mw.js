// Function to combine middleware in case you want to return
// one midldeware that combine 2 or more

// Ex: combineMiddleware([
//       mw1,
//       mw2
//     ]);

export function combineMiddleware(mids) {
    return mids.reduce((a, b) => function(req, res, next) {
        a(req, res, (err) => {
            if (err) {
                return next(err);
            }
            b(req, res, next);
        });
    });
}
