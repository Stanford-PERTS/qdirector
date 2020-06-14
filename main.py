#
#
#
import hashlib
import urllib

from google.appengine.api import users
from google.appengine.ext import ndb


class School(ndb.Model):
    created = ndb.DateTimeProperty(auto_now_add=True)
    modified = ndb.DateTimeProperty(auto_now=True)

    # School Name
    name = ndb.StringProperty(required=True)
    # School nickname - max 2 or 3 chars
    url_name = ndb.StringProperty(required=True)
    # Qualtrics Anonymous Link
    survey = ndb.StringProperty(required=True)
    # Variables to be passed in from the incoming link
    variable = ndb.StringProperty()
    # User-supplied, perhaps auto-generated later on
    salt = ndb.StringProperty(required=True)
