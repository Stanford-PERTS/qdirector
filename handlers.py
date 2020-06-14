import cgi
import jinja2
import os
import string
import time
import urllib
import webapp2

from google.appengine.api import users
from google.appengine.ext import ndb

from main import *


JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)


class MainPage(webapp2.RequestHandler):
    """"""
    def get(self):

        if users.is_current_user_admin():
            self.redirect('/admin')
        else:
            if users.get_current_user():
                msg = "You are not an admin! Please request admin priveleges to use QDirector!"
                url = users.create_logout_url(self.request.uri)
                url_linktext = "Logout"
            else:
                msg = "Please sign in!"
                url = users.create_login_url(self.request.uri)
                url_linktext = 'Login'

            template_values = {
                'msg': msg,
                'url': url,
                'url_linktext': url_linktext,
            }

            template = JINJA_ENVIRONMENT.get_template('/templates/index.html')
            self.response.write(template.render(template_values))


class AdminPage(webapp2.RequestHandler):
    """

    """
    def get(self):
        user = users.get_current_user()
        if not users.is_current_user_admin():
            self.redirect('/')
        else:
            url = users.create_logout_url(self.request.uri)
            url_linktext = 'Logout'

            schools = School.query().fetch()

            template_values = {
                'schools': schools,
                'name': user.nickname(),
                'url': url,
                'url_linktext': url_linktext,
            }

            template = JINJA_ENVIRONMENT.get_template('/templates/admin.html')
            self.response.write(template.render(template_values))

    def post(self):
        """
        Add a school object.
        """
        school = School()

        school.name = self.request.get('name')
        school.url_name = self.request.get('url_name')
        school.survey = self.request.get('survey')
        school.variable = self.request.get('variable')
        school.salt = self.request.get('salt')
        school.put()

        time.sleep(1)
        self.redirect('/admin')


class DeleteSchool(webapp2.RequestHandler):
    """
    """
    def get(self, school_url):
        school_query = School.query().filter(School.url_name == school_url)
        school = school_query.fetch(1)[0]

        key = school.put()
        key.delete()

        time.sleep(1)
        self.redirect('/admin')


class EditSchool(webapp2.RequestHandler):
    """
    """
    def get(self, school_url):
        school_query = School.query().filter(School.url_name == school_url)
        school = school_query.fetch(1)[0]

        if school:
            msg = "Edit " + school.name

            template_values = {
                'msg': msg,
                'school': school,
            }

            template = JINJA_ENVIRONMENT.get_template('/templates/edit.html')
            self.response.write(template.render(template_values))

        else:
            self.response.write("<div>Sorry, that school doesn't exist!</div>")

    def post(self, school_url):

            school_query = School.query().filter(School.url_name == school_url)
            school = school_query.fetch(1)[0]

            school.name = self.request.get('name')
            school.url_name = self.request.get('url_name')
            school.survey = self.request.get('survey')
            school.variable = self.request.get('variable')
            school.salt = self.request.get('salt')
            school.put()

            time.sleep(1)
            self.redirect('/admin')


class RedirectLink(webapp2.RequestHandler):
    """
    Takes incoming link with variables, returns the salted
    and hashed value, combines with the anonymous qualtrics
    link, and redirects to the survey.
    """
    def get(self, url_name):

        school_query = School.query()
        school = school_query.filter(School.url_name == url_name).fetch(1)[0]

        v = self.request.GET.items()

        v_dict = {}
        for item in v:
            v_dict[item[0]] = item[1]

        if school.variable:
            var = v_dict[school.variable]
            var = ''.join(c for c in var.lower() if c in 'abcdefghijklmnopqrstuvwxyz1234567890')
            salted = var + school.salt
            hashed = hashlib.sha1(salted).hexdigest()
            v_dict[school.variable] = hashed

        redirect_link = str(school.survey + '&' + urllib.urlencode(v_dict))

        self.redirect(redirect_link)


app = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/admin', AdminPage),
    ('/r/(.*)/', RedirectLink),
    ('/edit/(.*)', EditSchool),
    ('/delete/(.*)', DeleteSchool),
], debug=True)
