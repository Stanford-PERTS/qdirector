from Crypto.Hash import SHA256
from google.appengine.api import users as app_engine_users
import jinja2
import json
import logging
import os
import re
import traceback
import webapp2

from mysql_api import Api
import config
import util


JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader('templates'),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)


# Make sure this is off in production, it exposes exception messages.
debug = util.is_development()


class ViewHandler(webapp2.RequestHandler):
    """Superclass for page-generating handlers."""

    def write(self, template_filename, template_path=None, **kwargs):
        if template_path is None:
            template_path = 'templates'
        jinja_environment = jinja2.Environment(
            autoescape=True,
            extensions=['jinja2.ext.autoescape'],
            loader=jinja2.FileSystemLoader(template_path),
        )

        # Jinja environment filters:

        @jinja2.evalcontextfilter
        def jinja_json_filter(eval_context, value):
            """Seralize value as JSON and mark as safe for jinja."""
            return jinja2.Markup(json.dumps(value))

        jinja_environment.filters['to_json'] = jinja_json_filter

        # default parameters that all views get
        kwargs['google_logout_url'] = app_engine_users.create_login_url()
        kwargs['hosting_domain'] = os.environ['HOSTING_DOMAIN']
        kwargs['is_localhost'] = util.is_localhost()

        # Try to load the requested template. If it doesn't exist, replace
        # it with a 404.
        try:
            template = jinja_environment.get_template(template_filename)
        except jinja2.exceptions.TemplateNotFound:
            return self.http_not_found()

        # Render the template with data and write it to the HTTP response.
        self.response.write(template.render(kwargs))

    def dispatch(self):
        try:
            # Call the overridden dispatch(), which has the effect of running
            # the get() or post() etc. of the inheriting class.
            webapp2.RequestHandler.dispatch(self)

        except Exception as error:
            trace = traceback.format_exc()
            # We don't want to tell the public about our exception messages.
            # Just provide the exception type to the client, but log the full
            # details on the server.
            logging.error("{}\n{}".format(error, trace))
            response = {
                'success': False,
                'message': error.__class__.__name__,
            }
            if debug:
                self.response.write('<pre>{}</pre>'.format(
                    traceback.format_exc()))
            else:
                self.response.write("We are having technical difficulties.")
            return

    def http_not_found(self):
        """Respond with a 404.

        Example use:

        class Foo(ViewHandler):
            def get(self):
                return self.http_not_found()
        """
        self.error(404)
        jinja_environment = jinja2.Environment(
            loader=jinja2.FileSystemLoader('templates'))
        template = jinja_environment.get_template('404.html')
        self.response.write(template.render())


class UnitTests(ViewHandler):
    def get(self):
        r = re.compile(r'^test_(\S+)\.py$')
        test_files = filter(lambda f: r.match(f), os.listdir('unit_testing'))
        test_suites = [r.match(f).group(1) for f in test_files]
        self.write('test.html', test_suites=test_suites)


class Deidentify(ViewHandler):
    """Does nothing but serve up the static deidentify page."""
    def get(self):
        self.write('deidentify.html')


class EmailSelection(ViewHandler):
    """Does nothing but serve up the static email selection tool."""
    def get(self):
        self.write('email_selection.html')


class PanelRedirectionMap(ViewHandler):
    def get(self):
        """Display PRM admin interface; see config.prm_admins."""

        gae_user = app_engine_users.get_current_user()
        if gae_user.email() not in config.prm_admins:
            self.response.write('Please request to be added to the list of '
                                'admins.')
            return

        # Get a complete list of cohorts for users to pick from.
        api = Api()  # interface to SQL instance
        cohorts = api.query('SELECT * FROM cohorts')
        self.write('panel_redirection_map.html', cohorts=cohorts)

    def post(self):
        """Takes student data and cohort info, and inserts into db."""
        api = Api()  # interface to SQL instance

        cohort_code = self.request.get('cohort_code')
        anonymous_link = self.request.get('anonymous_link')
        panel_string = self.request.get('panel')

        # Insert a new cohort.
        if cohort_code and anonymous_link:
            if re.match(config.cohort_code_regex, cohort_code) is None:
                self.response.write("Invalid cohort code.")
                return

            if re.match(config.anonymous_link_regex, anonymous_link) is None:
                self.response.write("Invalid link.")
                return

            success = api.insert('cohorts', {
                'cohort_code': cohort_code,
                'anonymous_link': anonymous_link,
            })

            self.response.write(success)  # 'True' or error message.
            return

        elif cohort_code and panel_string:
            # These come in as a tab-and-newline-separated string; convert to
            # list of dictionaries. The db will accept only certain fields.
            # Including others will cause an error (our js should provide clean
            # data).
            raw_row_dicts = api.csv_to_dicts(panel_string)

            # Add the cohort code to each token row, and convert each
            # expiration date from an american-style string to an iso standard
            # string.
            row_dicts = []
            for row in raw_row_dicts:
                row['cohort_code'] = cohort_code
                exp_datetime = util.parse_datetime(row['link_expiration'])
                row['link_expiration'] = exp_datetime.isoformat()
                row_dicts.append(row)

            success = api.insert('map', row_dicts)

            self.response.write(success)  # 'True' or error message.

        else:
            self.response.write("Invalid POST data.")

    def put(self):
        api = Api()  # interface to SQL instance

        cohort_code = self.request.get('cohort_code')
        anonymous_link = self.request.get('anonymous_link')

        if cohort_code and anonymous_link:
            if re.match(config.cohort_code_regex, cohort_code) is None:
                self.response.write("Invalid cohort code.")
                return

            if re.match(config.anonymous_link_regex, anonymous_link) is None:
                self.response.write("Invalid link.")
                return

            success = api.update_cohort(cohort_code, anonymous_link)

            self.response.write(success)  # 'True' or error message.
            return

        else:
            self.response.write("Invalid PUT data.")


class Redirector(ViewHandler):
    security_token_salt = 'H2qXAXVAm2gKuaMSqyO7'

    def get(self, cohort_code, token):
        logging.info("Redirecting student '{}' from cohort '{}'."
                     .format(token, cohort_code))

        api = Api()
        redirect = unique_link = anonymous_link = security_token = None

        # Attempt to look up the token, which may fail and return None.
        redirect = unique_link = api.get_redirect(cohort_code, token)

        if unique_link:
            logging.info("Token maps to link: {}".format(unique_link))

        else:
            # Token not found; use the cohort's anonymous link instead.
            redirect = anonymous_link = api.get_anonymous_link(cohort_code)

            if not anonymous_link:
                # This happens when the request cohort doesn't exist.
                return self.http_not_found()

            logging.info("No mapping found. Using anonymous link {}"
                         .format(anonymous_link))

            # We have an anonymous link to use. Now include the (username)
            # token so we know who this is, and security token so we can later
            # detect if people mess with the URL parameters.

            # Make sure that the token is at least a string, not None.
            token = str(token) if isinstance(token, basestring) else ''
            security_token = self.hash(token + self.security_token_salt)
            redirect = util.set_query_parameters(
                redirect, token=token, security_token=security_token)

        # Both kinds of redirect, using unique or anonymous links, need the
        # cohort code. Also, pass through any request params that may be
        # present, as long as they don't conflict with what we need.
        reserved_params = ['debug', 'cohort_code', 'token', 'security_token']
        GET_params = {k: v for k, v in self.request.GET.items()
                      if k not in reserved_params}
        logging.info("Passing through params: {}".format(GET_params))
        redirect = util.set_query_parameters(
            redirect, cohort_code=cohort_code, **GET_params)

        logging.info("Final redirct URL is: {}".format(redirect))

        if self.request.get('debug'):
            logging.info("Debug mode on. NOT redirecting.")
            self.write(
                'redirector.html',
                cohort_code=cohort_code,
                token=token,
                security_token=security_token,
                unique_link=unique_link,
                anonymous_link=anonymous_link,
                redirect=redirect,
            )
        else:
            logging.info("Redirecting to {}".format(redirect))
            # Links come back from the db as unicode, and this needs str.
            self.redirect(str(redirect))

    def hash(self, string):
        hasher = SHA256.new()
        hasher.update(string)
        return hasher.hexdigest()


class FourOhFour(ViewHandler):
    def get(self):
        return self.http_not_found()


app = webapp2.WSGIApplication([
    ('/deidentify/?', Deidentify),
    ('/email_selection/?', EmailSelection),
    ('/panel_redirection_map/?', PanelRedirectionMap),
    ('/prm/(?P<cohort_code>.*?)/(?P<token>[^/]+)/?', Redirector),
    ('/test', UnitTests),
    ('/.*', FourOhFour),
], debug=True)
