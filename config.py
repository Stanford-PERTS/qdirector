"""Hard coded configuration parameters."""

# Lowercase letters, numbers, and underscore.
cohort_code_regex = r'^[a-z0-9_]{4,}$'
anonymous_link_regex = r'^https?://.*'

unit_test_directory = 'unit_testing'

prm_admins = []

boolean_url_arguments = [
]

integer_url_arguments = [
]

# UTC timezone, in ISO date format: YYYY-MM-DD
date_url_arguments = [
    'scheduled_date',  # used in sending emails
]

# UTC timezone, in an ISO-like format (missing the 'T' character between
# date and time): YYYY-MM-DD HH:mm:SS
datetime_url_arguments = [
]

# Converted to JSON with json.dumps().
json_url_arugments = [
]

# JSON only allows strings as dictionary keys. But for these values, we want
# to interpret the keys as numbers (ints).
json_url_arugments_with_numeric_keys = [
]

# These arguments are meta-data and are never applicable to specific entities
# or api actions. They appear in url_handlers.BaseHandler.get().
ignored_url_arguments = [
]

# also, any normal url argument suffixed with _json will be interpreted as json

# Converted by util.get_request_dictionary()
# Problem: we want to be able to set null values to the server, but
# angular drops these from request strings. E.g. given {a: 1, b: null}
# angular creates the request string '?a=1'
# Solution: translate javascript nulls to a special string, which
# the server will again translate to python None. We use '__null__'
# because is more client-side-ish, given that js and JSON have a null
# value.
# javascript | request string | server
# -----------|----------------|----------
# p = null;  | ?p=__null__    | p = None
url_values = {
    '__null__': None,
}

# In URL query strings, only the string 'true' ever counts as boolean True.
true_strings = ['true']


# Email settings
#
# Platform generated emails can only be sent from email addresses that have
# viewer permissions or greater on app engine.  So if you are going to change
# this please add the sender as an application viewer on
# https://appengine.google.com/permissions?app_id=s~pegasusplatform
#
# There are other email options if this doesn't suit your needs check the
# google docs.
# https://developers.google.com/appengine/docs/python/mail/sendingmail
from_server_email_address = ""
# This address should forward to the development team
# Ben says: I could not use  directly because of
# limited permissions, so I created this gmail account which forwards all its
# mail there.
to_dev_team_email_address = ""
# * spam prevention *
# time between emails
# if we exceed this for a give to address, an error will be logged
suggested_delay_between_emails = 1      # 1 day
# whitelist
# some addessess we spam, like our own
# * we allow us to spam anyone at a *@perts.net domain so
# this is the best address for an admin
addresses_we_can_spam = [
    to_dev_team_email_address,
    from_server_email_address,
]
