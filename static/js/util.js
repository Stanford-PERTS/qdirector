// System-wide javascript environment library.
//
// Concerns are utility functions and browser compatibility/polyfills.

// ** Polyfills ** //

(function () {
    'use strict';

    // Shallow copy. Elements which are non-primitive will by copied by
    // reference.
    Array.prototype.copy = function () {
        return this.slice(0);
    };

    // Production steps of ECMA-262, Edition 5, 15.4.4.18
    // Reference: http://es5.github.io/#x15.4.4.18
    // CAM stored this here (with the underscore) as reference to the standard
    // implementation. The next function extends the implementation slightly.
    Array.prototype._forEach = function(callback, thisArg) {

        var T, k;

        if (this == null) {
            throw new TypeError(' this is null or not defined');
        }

        // 1. Let O be the result of calling ToObject passing the |this| value
        // as the argument.
        var O = Object(this);

        // 2. Let lenValue be the result of calling the Get internal method of
        //     O with the argument "length".
        // 3. Let len be ToUint32(lenValue).
        var len = O.length >>> 0;

        // 4. If IsCallable(callback) is false, throw a TypeError exception.
        // See: http://es5.github.com/#x9.11
        if (typeof callback !== "function") {
            throw new TypeError(callback + ' is not a function');
        }

        // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (arguments.length > 1) {
            T = thisArg;
        }

        // 6. Let k be 0
        k = 0;

        // 7. Repeat, while k < len
        while (k < len) {

            var kValue;

            // a. Let Pk be ToString(k).
            //     This is implicit for LHS operands of the in operator
            // b. Let kPresent be the result of calling the HasProperty
            //     internal method of O with argument Pk. This step can be
            //     combined with c
            // c. If kPresent is true, then
            if (k in O) {

                // i. Let kValue be the result of calling the Get internal
                //     method of O with argument Pk.
                kValue = O[k];

                // ii. Call the Call internal method of callback with T as the
                //      this value and argument list containing kValue, k,
                //      and O.
                callback.call(T, kValue, k, O);
            }
            // d. Increase k by 1.
            k++;
        }
        // 8. return undefined
    };

    // For comments on the standard implementation, see above function. This
    // function overwrites native function (which might not be standard!) and
    // has modifications: it returns an array of all the values returned
    // by the iterated function, leaving out undefineds.
    Array.prototype.forEach = function (callback, thisArg) {
        var T, k, r, results = [];

        if (this == null) {
            throw new TypeError(' this is null or not defined');
        }

        var O = Object(this);
        var len = O.length >>> 0;
        if (typeof callback !== "function") {
            throw new TypeError(callback + ' is not a function');
        }

        if (arguments.length > 1) {
            T = thisArg;
        }

        k = 0;
        while (k < len) {
            var kValue;
            if (k in O) {
                kValue = O[k];
                r = callback.call(T, kValue, k, O);
                if (r !== undefined) {
                    results.push(r);
                }
            }
            k++;
        }

        return results;
    };

    if (typeof Array.prototype.filter !== 'function') {
        Array.prototype.filter = function (fun, thisp) {
            if (!this) {
                throw new TypeError();
            }
            var objects = Object(this);
            if (typeof fun !== 'function') {
                throw new TypeError();
            }
            var res = [], i;
            for (i in objects) {
                if (objects.hasOwnProperty(i)) {
                    if (fun.call(thisp, objects[i], i, objects)) {
                        res.push(objects[i]);
                    }
                }
            }
            return res;
        };
    }

    if (typeof Array.prototype.indexOf !== 'function') {
        Array.prototype.indexOf = function (element, from) {
            from = Number(from) || 0;
            from = (from < 0) ? Math.ceil(from) : Math.floor(from);
            if (from < 0) {
                from += this.length;
            }
            for (from; from < this.length; from += 1) {
                if (this[from] === element) {
                    return from;
                }
            }
            return -1;
        };
    }

    if (typeof Array.prototype.reduce !== 'function') {
        Array.prototype.reduce = function (callback, opt_initialValue) {
            if (null === this || 'undefined' === typeof this) {
                // At the moment all modern browsers, that support strict mode,
                // have  native implementation of Array.prototype.reduce. For
                // instance, IE8 does not support strict mode, so this check is
                // actually useless.
                throw new TypeError(
                    'Array.prototype.reduce called on null or undefined');
            }
            if (typeof callback !== 'function') {
                throw new TypeError(callback + ' is not a function');
            }
            var index, value,
                // the unsigned right shift operator, will convert any type to
                // a positive integer
                length = this.length >>> 0,
                isValueSet = false;
            if (1 < arguments.length) {
                value = opt_initialValue;
                isValueSet = true;
            }
            for (index = 0; length > index; index += 1) {
                if (this.hasOwnProperty(index)) {
                    if (isValueSet) {
                        value = callback(value, this[index], index, this);
                    }
                    else {
                        value = this[index];
                        isValueSet = true;
                    }
                }
            }
            if (!isValueSet) {
                throw new TypeError('Reduce of empty array with no initial value');
            }
            return value;
        };
    }

    // Hilariously, splice is broken in IE. Fix it.
    // http://stackoverflow.com/questions/8332969/ie-8-slice-not-working
    var originalSplice = Array.prototype.splice;
    Array.prototype.splice = function (start, deleteCount) {
        // convert arguments to a real Array
        var args = Array.prototype.slice.call(arguments);
        // IE requires deleteCount; set default value if it doesn't exist
        if (deleteCount === undefined) {
            args[1] = this.length - start;
        }
        // call the original function with the patched arguments
        return originalSplice.apply(this, args);
    };

    // Polyfill of Object.create for IE8. The real thing is much fancier,
    // including "property descriptors", which are some kind of crazy alien
    // species with strange powers. But we don't need to use them.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create
    if (typeof Object.create !== 'function') {
        var F = function () {};
        Object.create = function (o) {
            if (arguments.length > 1) {
                throw new Error('Second argument not supported');
            }
            if (typeof o !== 'object') {
                throw new TypeError('Argument must be an object');
            }
            F.prototype = o;
            return new F();
        };
    }

    // http://ejohn.org/blog/objectgetprototypeof/
    if (typeof Object.getPrototypeOf !== "function") {
        if (typeof "test".__proto__ === "object") {
            Object.getPrototypeOf = function (object) {
                return object.__proto__;
            };
        } else {
            Object.getPrototypeOf = function (object) {
                // May break if the constructor has been tampered with
                return object.constructor.prototype;
            };
        }
    }

    if (typeof String.prototype.trim !== 'function') {
        String.prototype.trim = function () {
            return this.replace(/^\s+|\s+$/g, '');
        };
    }

    // Not implemented in IE. Just like sanity isn't implemented in IE.
    // Note that this outputs the date in UTC! Might not produce what you expect!
    if (typeof Date.prototype.toISOString !== 'function') {
        var pad = function pad(number) {
            var r = String(number);
            if (r.length === 1) {
                r = '0' + r;
            }
            return r;
        };
        Date.prototype.toISOString = function () {
            return this.getUTCFullYear() +
                '-' + pad(this.getUTCMonth() + 1) +
                '-' + pad(this.getUTCDate()) +
                'T' + pad(this.getUTCHours()) +
                ':' + pad(this.getUTCMinutes()) +
                ':' + pad(this.getUTCSeconds()) +
                '.' + String((this.getUTCMilliseconds() / 1000).toFixed(3)).slice(2, 5) +
                'Z';
        };
    }

    if (typeof Function.prototype.bind !== 'function') {
        Function.prototype.bind = function (oThis) {
            'use strict';
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5
                // internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying " +
                    "to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                toBind = this,
                Noop = function () {},
                bound = function () {
                    return toBind.apply(
                        this instanceof Noop && oThis ? this : oThis,
                        aArgs.concat(Array.prototype.slice.call(arguments))
                    );
                };

            Noop.prototype = this.prototype;
            bound.prototype = new Noop();

            return bound;
        };
    }

    // IE doesn't always have console.log, and, like the piece of fossilized
    // dinosaur dung that it is, will break when it encounters one. So put in a
    // dummy.
    if (!window.console) {
        window.console = {
            error: function (msg) {
                alert('console.error(): ' + JSON.stringify(msg));
            },
            warn: function (msg) {
                alert('console.warn(): ' + JSON.stringify(msg));
            },
            log: function () {},
            debug: function () {}
        };
    } else if (!window.console.debug) {
        // in ie 10, console exists, but console.debug doesn't!!
        window.console.debug = function () {};
    }
}());

// ** Global Functions ** //

function forEach(o, f, thisObj) {
    'use strict';
    // Allows comprehension-like syntax for arrays and object-dictionaries.
    // Iterating functions have arguments (value, index) for arrays and
    // (propertyName, value) for objects. The values returned by the iterating
    // function are available as an array returned by forEach. If the iterating
    // function returns undefined then no value is pushed to the result.
    // Array example:
    // var evens = forEach([1,2,3,4], function (x) {
    //    if (x % 2 === 0) { return x; }
    // });
    // // evens equals [2, 4];
    // Object example:
    // var keys = forEach({key1: 'value1', key2: 'value2'}, function (k, v) {
    //    return k;
    // });
    // // keys equals ['key1', 'key2'];
    var p;
    var results = [];
    var returnValue;
    if (typeof f !== 'function') {
        throw new TypeError();
    }
    if (o instanceof Array) {
        return o.forEach(f, thisObj);
    }
    for (p in o) {
        if (Object.prototype.hasOwnProperty.call(o, p)) {
            returnValue = f.call(thisObj, p, o[p], o);
            if (returnValue !== undefined) {
                results.push(returnValue);
            }
        }
    }
    return results;
}

// ** Datatype extension ** //

// Functions that aren't in the spec, but are useful in native prototypes.

Array.prototype.contains = function (value) {
    'use strict';
    return this.indexOf(value) !== -1;
};

Array.prototype.last = function () {
    'use strict';
    return this[this.length - 1];
};

// Removes the first instance of x within a, matching done by Array.indexOf().
// If x is not found, does nothing.
Array.prototype.remove  = function (x) {
    'use strict';
    var i = this.indexOf(x);
    if (i !== -1) { this.splice(i, 1); }
    return this;
};

Date.intervals = {
    week: 1000 * 60 * 60 * 24 * 7,
    day: 1000 * 60 * 60 * 24,
    hour: 1000 * 60 * 60,
    minute: 1000 * 60
};

// The following three functions make it easier to translate between the date
// strings typically used by our server and javascript objects. These formats
// do not attempt to align with any ISO standards, nor are these methods
// polyfills for native ones.

// The critical thing to understand here is timezones. These string formats do
// not contain timezone information, while a javascript Date object does.
// Converting between one and the other without being explicit about the
// timezone leads to very confusing errors. Therefore these functions require
// you to specify whether the string in question is meant to be in the 'local'
// timezone, which is whatever the client's OS is set to, or in UTC, i.e.
// Greenwich Mean Time. Strings from the server are always in UTC.

// A 'DateString' is YYYY-MM-DD
// a 'DateTimeString' is YYYY-MM-DD HH:mm:SS
Date.prototype.toDateString = function (timezone, includeTime) {
    'use strict';
    if (timezone !== 'local' && timezone !== 'UTC') {
        throw new Error("Timezone must be 'local' or 'UTC'. Got " + timezone);
    }
    if (includeTime !== true) {
        includeTime = false;
    }

    // Turns integers less than 10 into two-character strings, e.g. 2 to '02'
    var pad = function pad(number) {
        var r = String(number);
        if (r.length === 1) {
            r = '0' + r;
        }
        return r;
    };

    var dateStr, timeStr;
    if (timezone === 'local') {
        dateStr = this.getFullYear() + '-' +
                  pad(this.getMonth() + 1) + '-' +  // month counts from zero
                  pad(this.getDate());
        timeStr = pad(this.getHours()) + ':' +
                  pad(this.getMinutes()) + ':' +
                  pad(this.getSeconds());
    }
    if (timezone === 'UTC') {
        dateStr = this.getUTCFullYear() + '-' +
                  pad(this.getUTCMonth() + 1) + '-' +
                  pad(this.getUTCDate());
        timeStr = pad(this.getUTCHours()) + ':' +
                  pad(this.getUTCMinutes()) + ':' +
                  pad(this.getUTCSeconds());
    }
    return includeTime ? dateStr + ' ' + timeStr : dateStr;
};

Date.prototype.toDateTimeString = function (timezone) {
    'use strict';
    return this.toDateString(timezone, true);
};

// Use this to interpret strings and not Date.parse(), which is not
// consistently implemented across browsers, and may even choose local vs. UTC
// capriciously based on browser and string format. See:
// * http://stackoverflow.com/questions/5802461/javascript-which-browsers-support-parsing-of-iso-8601-date-string-with-date-par
// * http://stackoverflow.com/questions/2587345/javascript-date-parse
Date.createFromString = function (string, timezone) {
    'use strict';
    // this function accepts formats with
    // * YYYY-MM-DD hh:mm:ss.msmsms (one to six decimal places)
    // * YYYY-MM-DD hh:mm:ss. (NOT ALLOWED)
    // * YYYY-MM-DD hh:mm:ss
    // * YYYY-MM-DD
    if (timezone !== 'local' && timezone !== 'UTC') {
        throw new Error("Timezone must be 'local' or 'UTC'. Got " + timezone);
    }
    var patterns = [
        // date only
        /^(\d\d\d\d)-(\d\d)-(\d\d)$/,
        // no fractional seconds
        /^(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/,
        // one to six decimals places
        /^(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\.(\d{1,6})$/
    ];
    var matches;
    forEach(patterns, function (p) {
        // at end of loop, most specific pattern matches are saved
        var m = p.exec(string);
        if (m) { matches = m; }
    });
    if (!matches) {
        throw new Error("Invalid string: " + string);
    }
    var year = matches[1];
    var month = matches[2] - 1;   // month counts from zero
    var day = matches[3];
    var hour = matches[4] || 0;
    var minute = matches[5] || 0;
    var second = matches[6] || 0;
    var decimalSeconds = matches[7] || false;
    var ms;
    if (decimalSeconds) {  // we can assume it's still a string
        ms = decimalSeconds / (Math.pow(10, decimalSeconds.length - 3));
    } else {
        ms = 0;
    }
    if (timezone === 'local') {
        return new Date(year, month, day, hour, minute, second, ms);
    }
    if (timezone === 'UTC') {
        // Date.UTC() returns milliseconds since the epoch. Wrapping in a Date
        // constructor returns an actual Date object, which is what we want.
        return new Date(Date.UTC(year, month, day, hour, minute, second, ms));
    }
};

Date.dayDifference = function (date1, date2) {
    'use strict';
    return (date1.getTime() - date2.getTime()) / 1000 / 60 / 60 / 24;
};

// See http://ejohn.org/blog/partial-functions-in-javascript/
Function.prototype.partial = function () {
    'use strict';
    var fn = this, args = Array.prototype.slice.call(arguments), i;
    return function () {
        var arg = 0;
        for (i = 0; i < args.length && arg < arguments.length; i += 1) {
            if (args[i] === undefined) {
                args[i] = arguments[arg];
                arg += 1;
            }
        }
        return fn.apply(this, args);
    };
};

String.prototype.contains = function (value) {
    'use strict';
    return this.indexOf(value) !== -1;
};

// To Title Case 2.1 – http://individed.com/code/to-title-case/
// Copyright © 2008–2013 David Gouch. Licensed under the MIT License.
String.prototype.toTitleCase = function () {
    'use strict';
    var smallWords = /^(a|an|and|as|at|but|by|en|for|if|in|nor|of|on|or|per|the|to|vs?\.?|via)$/i;

    return this.replace(/[A-Za-z0-9\u00C0-\u00FF]+[^\s-]*/g, function (match, index, title) {
        if (index > 0 && index + match.length !== title.length &&
            match.search(smallWords) > -1 && title.charAt(index - 2) !== ":" &&
            (title.charAt(index + match.length) !== '-' || title.charAt(index - 1) === '-') &&
            title.charAt(index - 1).search(/[^\s-]/) < 0) {
            return match.toLowerCase();
        }

        if (match.substr(1).search(/[A-Z]|\../) > -1) {
            return match;
        }

        return match.charAt(0).toUpperCase() + match.substr(1);
    });
};

// ** Util Module ** //

var util = (function () {
    'use strict';

    var util = {};  // to be returned/exported

    util.popup = function (url, dimensions) {
        var options = 'toolbar=no,location=no,status=no,menubar=no,' +
            'scrollbars=yes,resizable=yes';
        if (dimensions) {
            if (dimensions.width) {
                options += ',width=' + dimensions.width;
            }
            if (dimensions.height) {
                options += ',height=' + dimensions.height;
            }
        }
        var newWindow = window.open(url, 'popup', options);
        if (newWindow) {
            if (typeof newWindow.focus === 'function') {
                newWindow.focus();
            }
            return newWindow;
        } else {
            return null;
        }
    };

    // Check current URL for development or production 
    util.isDevelopment = function () {
        var loc = window.location.href;
        var match = loc.match(/^https?:\/\/p3\.perts\.net/);
        // If no matches, .match returns null
        if (match === null) {
            if (window.debug) {
                window.console.warn(
                    "Detected non-production environment. This function " +
                    "expects Pegasus to be hosted on p3.perts.net.");
            }
            return true;
        }
        else {
            return false;
        }
    };

    // Used in unit testing. If condition is anything other than boolean true,
    // throws an error, optionally with message.
    util.assert = function (condition, message) {
        if (condition !== true) {
            if (!message) {
                message = "Assertion failed.";
            }
            message += " Condition was " + condition +
                       " (" + (typeof condition) + ").";
            throw new Error(message);
        }
    };

    util.displayUserMessage = function (type, msg) {
        var map = {
            info: 'alert-info',
            success: 'alert-success',
            warning: 'alert-warning',
            error: 'alert-danger'
        };
        $(document).ready(function () {
            $('#user_message')
                .removeClass('alert-success')
                .removeClass('alert-info')
                .removeClass('alert-warning')
                .removeClass('alert-danger')
                .addClass(map[type]).html(msg).show();
        });
    };

    util.clearUserMessage = function (delay) {
        if (delay === undefined) {
            delay = 100;
        }
        setTimeout(function () {
            $('#user_message').fadeOut();
        }, delay);
    };

    util.arrayUnique = function (a) {
        var unique = [], i;
        for (i = 0; i < a.length; i += 1) {
            if (unique.indexOf(a[i]) === -1) {
                unique.push(a[i]);
            }
        }
        return unique;
    };

    util.arrayEqual = function (x, y) {
        if (x.length !== y.length) {
            return false;
        }
        var i;
        for (i = 0; i < x.length; i += 1) {
            if (x[i] !== y[i]) {
                return false;
            }
        }
        return true;
    };

    util.dictionaryDiff = function (x, y) {
        // Returns keys from x that have different values than y. Values are
        // compared by identity (which means by reference in some cases) except for
        // arrays. Because we often want to use arrays as lists of primitives (e.g.
        // progress_history), arrays are compared with the util.arrayEqual() function,
        // which is kind of like comparing arrays by value.
        //
        // covers some weird gotcha's in comparisons:
        // see stackoverflow.com/a/1144249/431079
        var differences = [];
        forEach(x, function (k, v) {
            var isNew = false;
            if (!y.hasOwnProperty(k)) {
                isNew = true;
            } else if (v instanceof Array) {
                isNew = !util.arrayEqual(x[k], y[k]);
            } else if (util.isDictionary(v)) {
                isNew = util.dictionaryDiff(x[k], y[k]).length > 0;
            } else {
                isNew = x[k] !== y[k];
            }
            if (isNew) {
                differences.push(k);
            }
        });
        return differences;
    };

    util.indexBy = function (arrayOfObjects, property) {
        var index = {};
        forEach(arrayOfObjects, function (o) {
            var v = o[property];
            index[v] = o;
        });
        return index;
    }

    util.listBy = function (arrayOfObjects, property) {
        var index = {};
        forEach(arrayOfObjects, function (o) {
            var v = o[property];
            util.initProp(index, v, []);
            index[v].push(o);
        });
        return index;
    }

    // Breaks on capital letters only. Not tested with numbers, etc.
    util.camelToSeparated = function (camel, separator) {
        var regexp = /[A-Z]/g,
            breakPoints = [],
            substrings = [],
            match;
        while ((match = regexp.exec(camel)) !== null) {
            breakPoints.push(regexp.lastIndex);
        }
        breakPoints.forEach(function (breakPoint, index) {
            var previousBreak = index ? breakPoints[index - 1] - 1 : 0;
            substrings.push(camel.slice(previousBreak, breakPoint - 1).toLowerCase());
        });
        substrings.push(camel.slice(breakPoints.last() - 1).toLowerCase());
        return substrings.join(separator);
    };

    // Breaks on given character only. Not tested with numbers, etc.
    util.separatedToCamel = function (s, separator) {
        var chunks = s.split(separator),
            x;
        for (x = 1; x < chunks.length; x += 1) {
            chunks[x] = chunks[x].charAt(0).toUpperCase() + chunks[x].substring(1);
        }
        return chunks.join("");
    };

    util.isDictionary = function (d) {
        // Lots of things in js are typeof 'object'. We're looking for objects
        // that are super boring, don't inherit from anything, and are "just"
        // associative arrays/hashes/dictionaries.
        return d !== null && d !== undefined && d.constructor === Object;
    };

    util.queryString = function (key, value) {
        // Use to access or write to the query string (search) of the current URL.
        // Note that writing will result in a page refresh. If no arguments are
        // given, returns the whole query string as a javascript object.
        var reviver = function (key, value) {
            return key === "" ? value : decodeURIComponent(value);
        };
        var search = window.location.search.substring(1);
        var queryDict = {};
        if (search) {
            var jsonString = '{"' +
                search.replace(/&/g, '","').replace(new RegExp('=', 'g'), '":"') +
                '"}';
            queryDict = JSON.parse(jsonString, reviver);
        }

        if (key === undefined) {
            return queryDict;
        } else if (value === undefined) {
            return queryDict[key];
        } else {
            queryDict[key] = value;
            window.location.search = '?' + forEach(queryDict, function (k, v) {
                return k + '=' + v;
            }).join('&');
        }
    };

    // Converts an object of key-value pairs into a url query string
    // (the part after the '?').
    util.buildQueryString = function (obj) {
        return forEach(obj, function (k, v) {
            return k + '=' + encodeURIComponent(v);
        }).join('&');
    };

    util.initProp = function (o, p, v) {
        if (o[p] === undefined) {
            o[p] = v;
        }
    };

    // See http://stackoverflow.com/questions/175739/is-there-a-built-in-way-in-javascript-to-check-if-a-string-is-a-valid-number
    // Example:
    // util.isStringNumeric('100', 'strict')  // true
    // util.isStringNumeric('100x', 'strict')  // false
    // util.isStringNumeric('100x', 'loose')  // true
    // util.isStringNumeric('x100x', 'loose')  // false
    util.isStringNumeric = function (s, looseOrStrict) {
        if (looseOrStrict === 'strict') {
            return s === '' ? false : !isNaN(s);
        } else if (looseOrStrict === 'loose') {
            return !isNaN(parseInt(s, 10));
        } else {
            throw new Error("Must specify 'strict' or 'loose'.");
        }
    };

    util.openInNewWindow = function (url) {
        var newWindow = window.open(url);
        if (newWindow && typeof newWindow.focus === 'function') {
            newWindow.focus();
        }
        return newWindow;
    };

    util.randomString = function (length) {
        // Code is ugly b/c cam originally wrote this in coffeescript.
        var chars, l, lowercase, n, numerals, uppercase;
        numerals = (function () {
            var _i, _results;
            _results = [];
            for (n = _i = 0; _i <= 9; n = _i, _i += 1) {
                _results.push(n);
            }
            return _results;
        }());
        uppercase = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
        lowercase = (function () {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = uppercase.length; _i < _len; _i += 1) {
                l = uppercase[_i];
                _results.push(l.toLowerCase());
            }
            return _results;
        }());
        chars = numerals.concat(uppercase).concat(lowercase);
        return (function () {
            var _i, _results;
            _results = [];
            for (_i = 1; _i <= length; _i += 1) {
                _results.push(chars[Math.floor(Math.random() * 62)]);
            }
            return _results;
        }()).join('');
    };

    util.range = function (min, max, step) {
        var args = Array.prototype.slice.call(arguments);
        if (args.length === 1) {
            min = 0;
            max = args[0];
            step = 1;
        } else if (args.length === 2) {
            step = 1;
        }
        var input = [];
        for (var i = min; i < max; i += step) {
            input.push(i);
        }
        return input;
    };

    util.generateId = function (prefix) {
        // Makes pegasus-like ids.
        // Example: prefix is 'User', returns 'User_dDxKjdgwXru4Uf2acy8Q'.
        return prefix + '_' + util.randomString(20);
    };

    // Displays date nicely
    // bmh 2013
    //
    // e.g.
    //     2013-01-01 -> "X months ago"
    // 
    // details
    //     http://stackoverflow.com/a/6207162/431079
    util.prettyDate = function (date_str) {
        var time_formats = [
            [60, 'just now', 1], // 60 
            [120, '1 minute ago', '1 minute from now'], // 60*2
            [3600, 'minutes', 60], // 60*60, 60
            [7200, '1 hour ago', '1 hour from now'], // 60*60*2
            [86400, 'hours', 3600], // 60*60*24, 60*60
            [172800, 'yesterday', 'tomorrow'], // 60*60*24*2
            [604800, 'days', 86400], // 60*60*24*7, 60*60*24
            [1209600, 'last week', 'next week'], // 60*60*24*7*4*2
            [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
            [4838400, 'last month', 'next month'], // 60*60*24*7*4*2
            [29030400, 'months', 2592000], // 60*60*24*365, 60*60*24*30
            [63072000, 'last year', 'next year'], // 60*60*24*365*2
            [3153600000, 'years', 31536000], // 60*60*24*365*100, 60*60*24*365
            [6307200000, 'last century', 'next century'], // 60*60*24*365*100*2
            [63072000000, 'centuries', 3153600000] // 60*60*24*365*100*20, 60*60*24*365*100
        ];
        var time = (date_str.toString()).replace(/-/g, "/").replace(/[TZ]/g, " ");
        var seconds = (new Date() - new Date(time + " UTC")) / 1000;
        var token = 'ago',
            list_choice = 1;
        if (seconds < 0) {
            seconds = Math.abs(seconds);
            token = 'from now';
            list_choice = 2;
        }
        var i = 0,
            format;
        do {
            format = time_formats[i];
            i += 1;
            if (seconds < format[0]) {
                if (typeof format[2] === 'string') {
                    return format[list_choice];
                } else {
                    return Math.floor(seconds / format[2]) + ' ' + format[1] +
                        ' ' + token;
                }
            }
        } while (format);
        return time;
    };

    // Blocks backspace key except in the case of textareas and text inputs to
    // prevent user navigation.
    // http://stackoverflow.com/questions/1495219/how-can-i-prevent-the-backspace-key-from-navigating-back#answer-7895814
    util.preventBackspaceNavigation = function () {
        $(document).keydown(function (e) {
            var preventKeyPress;
            if (e.keyCode === 8) {
                var d = e.srcElement || e.target;
                switch (d.tagName.toUpperCase()) {
                case 'TEXTAREA':
                    preventKeyPress = d.readOnly || d.disabled;
                    break;
                case 'INPUT':
                    preventKeyPress = d.readOnly || d.disabled ||
                        (d.attributes.type && $.inArray(d.attributes.type.value.toLowerCase(), ["radio", "checkbox", "submit", "button"]) >= 0);
                    break;
                case 'DIV':
                    preventKeyPress = d.readOnly || d.disabled || !(d.attributes.contentEditable && d.attributes.contentEditable.value === "true");
                    break;
                default:
                    preventKeyPress = true;
                    break;
                }
            } else {
                preventKeyPress = false;
            }

            if (preventKeyPress) {
                e.preventDefault();
            }
        });
    };

    util.weHas = {
        placeholder: function () {
            return ('placeholder' in document.createElement('input'));
        }
    };

    return util;
}());

// Make console.debug output dependent on a global debug boolean to clean up
// console output.
(function () {
    'use strict';
    var originalDebug = window.console.debug;
    window.console.debug = function () {
        if (window.debug) {
            // normal behavior
            originalDebug.apply(window.console, arguments);
        }
        // else do nothing
    };
}());
