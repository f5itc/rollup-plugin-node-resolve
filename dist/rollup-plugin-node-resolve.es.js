import { dirname, normalize, resolve } from 'path';
import builtins from 'builtin-modules';
import _nodeResolve from 'resolve';
import browserResolve from 'browser-resolve';

var COMMONJS_BROWSER_EMPTY = _nodeResolve.sync( 'browser-resolve/empty.js', __dirname );
var ES6_BROWSER_EMPTY = resolve( __dirname, '../src/empty.js' );
var CONSOLE_WARN = function () {
	var args = [], len = arguments.length;
	while ( len-- ) args[ len ] = arguments[ len ];

	return console.warn.apply( console, args );
}; // eslint-disable-line no-console

function nodeResolve ( options ) {
	if ( options === void 0 ) options = {};

	var skip = options.skip || [];
	var useJsnext = options.jsnext === true;
	var useModule = options.module !== false;
	var useMain = options.main !== false;
	var isPreferBuiltinsSet = options.preferBuiltins === true || options.preferBuiltins === false;
	var preferBuiltins = isPreferBuiltinsSet ? options.preferBuiltins : true;

	var onwarn = options.onwarn || CONSOLE_WARN;
	var resolveId = options.browser ? browserResolve : _nodeResolve;
	var paths = (
		options.paths ||
		(process.env.NODE_PATH || '').split(
			/^win/i.test(process.platform) ? ';' : ':'
		)
	);

	return {
		name: 'node-resolve',

		resolveId: function resolveId$1 ( importee, importer ) {
			if ( /\0/.test( importee ) ) return null; // ignore IDs with null character, these belong to other plugins

			// disregard entry module
			if ( !importer ) return null;

			var parts = importee.split( /[\/\\]/ );
			var id = parts.shift();

			if ( id[0] === '@' && parts.length ) {
				// scoped packages
				id += "/" + (parts.shift());
			} else if ( id[0] === '.' ) {
				// an import relative to the parent dir of the importer
				id = resolve( importer, '..', importee );
			}

			if ( skip !== true && ~skip.indexOf( id ) ) return null;

			return new Promise( function ( accept, reject ) {
				resolveId(
					importee,
					{
						basedir: dirname( importer ),
						packageFilter: function packageFilter ( pkg ) {
							if ( !useJsnext && !useMain && !useModule ) {
								if ( skip === true ) accept( false );
								else reject( Error( ("To import from a package in node_modules (" + importee + "), either options.jsnext, options.module or options.main must be true") ) );
							} else if ( useModule && pkg[ 'module' ] ) {
								pkg[ 'main' ] = pkg[ 'module' ];
							} else if ( useJsnext && pkg[ 'jsnext:main' ] ) {
								pkg[ 'main' ] = pkg[ 'jsnext:main' ];
							} else if ( ( useJsnext || useModule ) && !useMain ) {
								if ( skip === true ) accept( false );
								else reject( Error( ("Package " + importee + " (imported by " + importer + ") does not have a module or jsnext:main field. You should either allow legacy modules with options.main, or skip it with options.skip = ['" + importee + "'])") ) );
							}
							return pkg;
						},
						extensions: options.extensions,
						paths: paths
					},
					function ( err, resolved ) {
						if ( err ) {
							if ( skip === true ) accept( false );
							else reject( Error( ("Could not resolve '" + importee + "' from " + (normalize( importer ))) ) );
						} else {
							if ( resolved === COMMONJS_BROWSER_EMPTY ) {
								accept( ES6_BROWSER_EMPTY );
							} else if ( ~builtins.indexOf( resolved ) ) {
								accept( null );
							} else if ( ~builtins.indexOf( importee ) && preferBuiltins ) {
								if ( !isPreferBuiltinsSet ) {
									onwarn(
										"preferring built-in module '" + importee + "' over local alternative " +
										"at '" + resolved + "', pass 'preferBuiltins: false' to disable this " +
										"behavior or 'preferBuiltins: true' to disable this warning"
									);
								}
								accept( null );
							} else {
								accept( resolved );
							}
						}
					}
				);
			});
		}
	};
}

export default nodeResolve;
