"""Collection of utility functions."""

from dateutil import parser as dateutil_parser  # parse_datetime()
from google.appengine.api import users as app_engine_users  # is_god()
import google.appengine.api.app_identity as app_identity  # is_development()
import logging
import os  # is_development()
import urllib
import urlparse

import config
from simple_profiler import Profiler

# A 'global' profiler object that's used in BaseHandler.get. So, to profile
# any request handler, add events like this:
# util.profiler.add_event("did the thing")
# and when you're ready, print the results, perhaps like this:
# logging.info(util.profiler)
profiler = Profiler()

# Some poorly-behaved libraries screw with the default logging level,
# killing our 'info' and 'warning' logs. Make sure it's set correctly
# for our code.
logging.getLogger().setLevel(logging.DEBUG)


def is_development():
    """Localhost OR a '-staging' app are development.

    The qdirector app is production.
    """
    # see http://stackoverflow.com/questions/5523281/how-do-i-get-the-application-id-at-runtime
    return (is_localhost() or '-staging' in app_identity.get_application_id())


def is_localhost():
    """Is running on the development SDK, i.e. NOT deployed to app engine."""
    return os.environ['SERVER_SOFTWARE'].startswith('Development')


def parse_datetime(s, return_type='datetime'):
    """Takes just about any date/time string and returns a python object.
    Datetime objects are the default, but setting type to 'date' or 'time'
    returns the appropriate object.

    See http://labix.org/python-dateutil
    """

    if return_type not in ['datetime', 'date', 'time']:
        raise Exception("Invalid type: {}.".format(return_type))

    dt = dateutil_parser.parse(s)

    if return_type in ['date', 'time']:
        method = getattr(dt, return_type)
        return method()
    else:
        return dt


# Quick way of detecting if a kwarg was specified or not.
sentinel = object()


def set_query_parameters(url, new_fragment=sentinel, **new_params):
    """Given a URL, set a query parameter or fragment and return the URL.

    Setting to '' or None removes the parameter or hash/fragment.

    > set_query_parameter('http://me.com?foo=bar&biz=baz', foo='stuff', biz='')
    'http://me.com?foo=stuff'

    See: http://stackoverflow.com/questions/4293460/how-to-add-custom-parameters-to-an-url-query-string-with-python
    """
    scheme, netloc, path, query_string, fragment = urlparse.urlsplit(url)
    query_params = urlparse.parse_qs(query_string)

    query_params.update(new_params)
    query_params = {k: v for k, v in query_params.items()
                    if v not in ['', None]}
    new_query_string = urllib.urlencode(query_params, doseq=True)

    if new_fragment is not sentinel:
        fragment = new_fragment

    return urlparse.urlunsplit(
        (scheme, netloc, path, new_query_string, fragment))
