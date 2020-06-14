"""the api"""

import google.appengine.api.app_identity as app_identity
import logging
import MySQLdb
import collections

import util


class Api():
    connection = None
    cursor = None

    credentials = {
        'localhost': {
            'host': '127.0.0.1',
            'port': 3306,
            'db': 'test',
            'user': 'test',
            'passwd': 'testpassword',
        },
        'development': {
            'host': '127.0.0.1',
            'port': 3306,
            'db': 'test',
            'user': 'test',
            'passwd': 'testpassword',
        },
        'production': {
            'unix_socket': '/cloudsql/{app_id}:{db_instance}'.format(
                app_id=app_identity.get_application_id(),
                db_instance='prod-01'),
            'db': 'ctc',
            'user': 'root',
        },
    }

    def __init__(self):
        self.connect_to_db()
        self.cursor = self.connection.cursor()

    # This is safe as long as the class does not hold any circular references.
    # http://eli.thegreenplace.net/2009/06/12/safely-using-destructors-in-python
    def __del__(self):
        self.connection.close()

    def connect_to_db(self):
        """Establish connection to MySQL db instance.

        Either Google Cloud SQL or local MySQL server. Detects environment with
        functions from util module.
        """
        if util.is_localhost():
            env_type = 'localhost'
        elif util.is_development():
            env_type = 'development'
        else:
            env_type = 'production'

        creds = self.credentials[env_type]

        # Although the docs say you can specify a `cursorclass` keyword
        # here as an easy way to get dictionaries out instead of lists, that
        # only works in version 1.2.5, and App Engine only has 1.2.4b4
        # installed as of 2015-03-30. Don't use it unless you know the
        # production library has been updated.
        # tl;dr: the following not allowed!
        # self.connection = MySQLdb.connect(
        #     charset='utf8', cursorclass=MySQLdb.cursors.DictCursor, **creds)
        self.connection = MySQLdb.connect(charset='utf8', **creds)

    def query(self, query_string, param_tuple=tuple(), n=None):
        """Run a general-purpose query. Only tested for SELECT so far."""
        self.cursor.execute(query_string, param_tuple)
        if n is None:
            result = self.cursor.fetchall()
        else:
            result = self.cursor.fetchmany(n)

        # Results come back as a tuple of tuples. Discover the names of the
        # SELECTed columns and turn it into a list of dictionaries.
        fields = [f[0] for f in self.cursor.description]
        return [{fields[i]: v for i, v in enumerate(row)} for row in result]

    def query_single_value(self, query_string, param_tuple=tuple()):
        """Returns the first value of the first row of results."""
        self.cursor.execute(query_string, param_tuple)
        result = self.cursor.fetchone()

        # result is None if no rows returned, else a tuple.
        return result if result is None else result[0]

    def commit(self):
        """Must be called for INSERT and UPDATE queries or they won't work."""
        try:
            self.connection.commit()
        except MySQLdb.Error as e:
            logging.error("MySQLdb error on INSERT. Will be rolled back. "
                          "{}".format(e))
            logging.error("Last query run was:\n{}"
                          .format(self.cursor._last_executed))
            self.connection.rollback()
            success = str(e)
        else:
            success = True

        return success

    def insert(self, table, row_dicts):
        """Insert one record or many records.

        Accepts a dictionary of values to insert, or a list of such.

        Returns True on success and an error message string on error.
        """
        # Accepts a single dictionary or a list of them. Standardize to list.
        if type(row_dicts) is not list:
            row_dicts = [row_dicts]

        # Turn each row dictionary into an ordered dictionary
        ordered_rows = [collections.OrderedDict(
            sorted(d.items(), key=lambda t: t[0])) for d in row_dicts]

        # Make sure each dictionary has the same set of keys.
        correct_keys = ordered_rows[0].keys()
        if not all([row.keys() == correct_keys for row in ordered_rows]):
            raise Exception("Inconsistent fields: {}.".format(ordered_rows))

        # Backticks critical for avoiding collisions with MySQL reserved words,
        # e.g. 'condition'!
        query_string = 'INSERT INTO `{}` (`{}`) VALUES ({})'.format(
            table,
            '`, `'.join(correct_keys),
            ', '.join(['%s'] * len(correct_keys)),
        )

        # MySQLdb expects a tuple or a list of tuples for the values.
        value_tuples = [tuple(row.values()) for row in ordered_rows]
        if len(row_dicts) is 1:
            insert_method = 'execute'
            params = value_tuples[0]
        else:
            insert_method = 'executemany'
            params = value_tuples

        getattr(self.cursor, insert_method)(query_string, params)

        return self.commit()

    def update_cohort(self, cohort_code, anonymous_link):
        query_string = """
            UPDATE cohorts

            SET anonymous_link = %s

            WHERE cohort_code = %s
        """
        self.cursor.execute(query_string, (anonymous_link, cohort_code))
        return self.commit()

    def get_redirect(self, cohort_code, token):
        """Figure out where a given user is supposed to go."""
        query_string = """
            SELECT link

            FROM map

            WHERE cohort_code = %s
              AND token = %s

            ORDER BY created DESC

            LIMIT 1
        """
        return self.query_single_value(query_string, (cohort_code, token))

    def get_anonymous_link(self, cohort_code):
        query_string = """
            SELECT anonymous_link

            FROM cohorts

            WHERE cohort_code = %s
        """
        return self.query_single_value(query_string, (cohort_code,))

    @classmethod
    def csv_to_dicts(self, csv_string):
        csv_rows = csv_string.split('\n')
        cols = csv_rows[0].split('\t')
        csv_rows = csv_rows[1:]

        def row_to_dict(row):
            return {cols[i]: v for i, v in enumerate(row.split('\t'))}

        return map(row_to_dict, csv_rows)
