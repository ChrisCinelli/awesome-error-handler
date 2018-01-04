import run from 'express-unit';
import _middleware from './middleware';

describe('Middleware', () => {
    it('Should call next', () => {
        const setup = jest.fn((req, res, next) => next());
        const middleware = jest.fn(_middleware());
        run(setup, middleware);
        expect(setup).toHaveBeenCalled();
        expect(middleware).toHaveBeenCalled();
    });
});
