const express = require('express');
require('express-async-errors');
const mountFiles = require('express-mount-files');
const bodyParser = require('body-parser');
const { resolve } = require('path');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const morgan = require('morgan');

const TEMPLATE_ENGINE_EXTENSION = 'pug';
const TEMPLATES_ROOT = 'templates';

exports.app = function (store) {
  const app = express();

  app.use(function configurePug(req, res, next) {
    res.locals.basedir = resolve(__dirname, TEMPLATES_ROOT);
    res.locals.plugins = [
      {
        resolve(filename) {
          return resolve(__dirname, TEMPLATES_ROOT, filename);
        },
      },
    ];
    next();
  });

  // Inject the store on the request
  // and response so other functions can use it
  app.use(function (req, res, next) {
    req.store = store;
    res.locals.store = store;
    next();
  });

  app.set('view engine', TEMPLATE_ENGINE_EXTENSION);

  // Add HTTP request logging
  app.use(
    morgan(
      morgan.compile(
        ':date[iso] - HTTP/:http-version :method :url :req[accept] - :status - :res[content-length]B in :response-time ms'
      )
    )
  );

  // Set up parsing of cookies for handling sessions
  const cookiesSecret = 'secret';
  app.use(cookieParser(cookiesSecret));

  // Add parsing of the requests's body both as URL encoded params
  // and as JSON
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // Allow overriding method through a _method param
  app.use(
    methodOverride(function (req) {
      if (req.body && typeof req.body === 'object' && '_method' in req.body) {
        // look in urlencoded POST bodies and delete it
        var method = req.body._method;
        delete req.body._method;
        return method;
      }
    })
  );

  // Add CSRF protection
  app.use(csurf({ cookie: true }));
  app.use(function (req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    next();
  });

  app.set('views', resolve(__dirname, 'routes'));
  app.use(
    mountFiles(resolve(__dirname, 'routes'), {
      viewExtensions: [TEMPLATE_ENGINE_EXTENSION],
    })
  );
  // Also serve the routes folder statically to help collocation
  // But filter access to avoid exposing the JS files
  const staticMw = express.static(resolve(__dirname, 'routes'));
  app.use(function (req, res, next) {
    if (/.js$/.exec(req.path)) {
      next();
    } else {
      staticMw(req, res, next);
    }
  });

  app.use(express.static(resolve(__dirname, 'public')));

  return app;
};
